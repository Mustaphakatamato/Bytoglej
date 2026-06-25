-- ================================================================
-- Redesign af køb-/byd-/bytteflow — datamodel (Trin 1)  (2026-06-17)
--
-- Indfører to førsteklasses entiteter som afløser den nuværende
-- chat-baserede bud- og byttelogik:
--
--   offers          Vinted-stil tilbud på ALLE køb-opslag. Afløser
--                   chat_messages.bid_status som sandhedskilde.
--   swap_proposals  Bundt-for-bundt bytteforslag med tosidet escrow,
--                   kontant mellemlag og 48-timers betalingsfrist.
--                   Afløser conversations.swap_*-kolonnerne (1:1-låst).
--
-- Tilføjer desuden hård reservation på listings (beslutning 1.5).
--
-- Beløb gemmes i KRONER (numeric(10,2)) for at matche resten af
-- skemaet (listings.price, orders.grand_total, chat_messages.bid_amount).
-- Konvertering til øre sker udelukkende ved Stripe-grænsen i API-laget.
--
-- Idempotent. Køres i Supabase SQL Editor.
-- ================================================================


-- ----------------------------------------------------------------
-- Hjælpefunktion: tilhører den aktuelle bruger en given institution?
-- SECURITY DEFINER, så den kan slå institutions/medlemskab op uanset
-- RLS på de tabeller. Matcher appens dual-identity-model:
--   - ejer/leder af institution (institutions.email / leader_email)
--   - medlem (institution_members.email)
--   - admin (fuld adgang)
-- ----------------------------------------------------------------
create or replace function public.user_in_institution(_inst_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _inst_id is not null and (
    exists (
      select 1 from institutions i
      where i.id = _inst_id
        and (i.email = auth.email() or i.leader_email = auth.email())
    )
    or exists (
      select 1 from institution_members m
      where m.institution_id = _inst_id
        and m.email = auth.email()
    )
    or exists (select 1 from admins a where a.user_id = auth.uid())
  );
$$;


-- ================================================================
-- 1) LISTINGS: hård reservation (beslutning 1.5)
-- Et accepteret tilbud / et bytte under checkout reserverer varen,
-- så andre ikke kan nå at købe den. Sættes server-side (service role).
-- reserved_until i fortiden = ikke længere reserveret (læses som ledig).
-- ================================================================
alter table public.listings
  add column if not exists reserved_until            timestamptz,
  add column if not exists reserved_for_institution_id uuid references public.institutions(id) on delete set null;

create index if not exists idx_listings_reserved_until on public.listings(reserved_until)
  where reserved_until is not null;


-- ================================================================
-- 2) OFFERS — tilbud på køb-opslag (Vinted-stil)
-- ================================================================
create table if not exists public.offers (
  id                     uuid primary key default gen_random_uuid(),
  listing_id             uuid not null references public.listings(id) on delete cascade,
  conversation_id        uuid references public.conversations(id) on delete set null, -- til chat-visning/tråd
  buyer_id               uuid references auth.users(id),
  buyer_institution_id   uuid references public.institutions(id) on delete set null,
  seller_institution_id  uuid references public.institutions(id) on delete set null,
  amount                 numeric(10,2) not null,            -- tilbudt pris (kr)
  counter_amount         numeric(10,2),                     -- sælgers modbud (kr)
  -- pending | accepted | rejected | countered | expired | cancelled | completed
  status                 text not null default 'pending',
  order_id               uuid references public.orders(id) on delete set null, -- sættes når checkout fuldføres
  note                   text,                              -- valgfri besked / afvisningsbegrundelse
  created_at             timestamptz not null default now(),
  responded_at           timestamptz,                       -- da sælger svarede
  expires_at             timestamptz                        -- tilbuddets gyldighed (auto-expire af pending)
);

alter table public.offers enable row level security;

-- Deltager-scopet adgang (køber- eller sælger-institution). API-routes
-- bruger service role og er upåvirkede af disse policies.
drop policy if exists "offers_select" on public.offers;
create policy "offers_select" on public.offers
  for select using (
    public.user_in_institution(buyer_institution_id)
    or public.user_in_institution(seller_institution_id)
  );

drop policy if exists "offers_insert" on public.offers;
create policy "offers_insert" on public.offers
  for insert with check (
    public.user_in_institution(buyer_institution_id)
  );

drop policy if exists "offers_update" on public.offers;
create policy "offers_update" on public.offers
  for update using (
    public.user_in_institution(buyer_institution_id)
    or public.user_in_institution(seller_institution_id)
  );

create index if not exists idx_offers_listing          on public.offers(listing_id);
create index if not exists idx_offers_conversation      on public.offers(conversation_id);
create index if not exists idx_offers_seller_status     on public.offers(seller_institution_id, status);
-- Dagligt loft (20/dag): udledes via count på (buyer_institution_id, created_at::date).
create index if not exists idx_offers_buyer_created      on public.offers(buyer_institution_id, created_at);


-- ================================================================
-- 3) SWAP_PROPOSALS — bundt-for-bundt bytte med tosidet escrow
-- Afløser conversations.swap_*-kolonnerne. Understøtter flere varer
-- pr. side (enkeltvare = array med ét element).
-- ================================================================
create table if not exists public.swap_proposals (
  id                        uuid primary key default gen_random_uuid(),
  conversation_id           uuid references public.conversations(id) on delete cascade,
  initiator_id              uuid references auth.users(id),            -- bruger der oprettede forslaget
  initiator_institution_id  uuid references public.institutions(id) on delete set null,
  owner_institution_id      uuid references public.institutions(id) on delete set null,

  -- Begge sider som JSONB-arrays (genbruger bundle-besked-formen):
  -- [{ listing_id, title, price, image, emoji, color }]
  offered_items             jsonb not null default '[]',  -- initiators side (det initiator giver)
  requested_items           jsonb not null default '[]',  -- ejers side (det initiator ønsker)
  offered_value             numeric(10,2) not null default 0,  -- snapshot-sum, til "fair?"-visning
  requested_value           numeric(10,2) not null default 0,

  -- Kontant mellemlag (beslutning 2.5): part 'cash_payer' betaler oveni.
  cash_adjustment           numeric(10,2) not null default 0,
  cash_payer                text,  -- 'initiator' | 'owner' | null

  -- Fast byttebeskyttelse pr. part (beslutning 2.7).
  protection_fee            numeric(10,2) not null default 10,

  -- pending | accepted | rejected | cancelled
  status                    text not null default 'pending',
  -- Escrow-tilstand (beslutning 2.6):
  -- none | awaiting_both | awaiting_initiator | awaiting_owner
  --      | both_paid_released | cancelled_timeout
  escrow_status             text not null default 'none',

  initiator_paid            boolean not null default false,
  owner_paid                boolean not null default false,
  initiator_delivery        text,   -- 'shipping' | 'custom'
  owner_delivery            text,
  initiator_pickup          jsonb,  -- { id, name, address, carrier_code }
  owner_pickup              jsonb,
  initiator_shipment_id     uuid,   -- ingen FK (matcher eksisterende swap_*_shipment_id-konvention)
  owner_shipment_id         uuid,
  initiator_order_id        uuid references public.orders(id) on delete set null,
  owner_order_id            uuid references public.orders(id) on delete set null,

  accepted_at               timestamptz,
  payment_deadline          timestamptz,  -- accepted_at + 48t; efter dette: auto-annullér + refundér
  completed_at              timestamptz,
  created_at                timestamptz not null default now(),

  constraint swap_cash_payer_chk check (cash_payer in ('initiator', 'owner') or cash_payer is null),
  constraint swap_cash_nonneg_chk check (cash_adjustment >= 0)
);

alter table public.swap_proposals enable row level security;

drop policy if exists "swap_select" on public.swap_proposals;
create policy "swap_select" on public.swap_proposals
  for select using (
    public.user_in_institution(initiator_institution_id)
    or public.user_in_institution(owner_institution_id)
  );

drop policy if exists "swap_insert" on public.swap_proposals;
create policy "swap_insert" on public.swap_proposals
  for insert with check (
    public.user_in_institution(initiator_institution_id)
  );

drop policy if exists "swap_update" on public.swap_proposals;
create policy "swap_update" on public.swap_proposals
  for update using (
    public.user_in_institution(initiator_institution_id)
    or public.user_in_institution(owner_institution_id)
  );

create index if not exists idx_swap_conversation on public.swap_proposals(conversation_id);
create index if not exists idx_swap_initiator     on public.swap_proposals(initiator_institution_id);
create index if not exists idx_swap_owner          on public.swap_proposals(owner_institution_id);
create index if not exists idx_swap_status         on public.swap_proposals(status);
-- Til frist-sweep (auto-annullering af ubetalte bytter efter 48t).
create index if not exists idx_swap_deadline       on public.swap_proposals(payment_deadline)
  where escrow_status in ('awaiting_both', 'awaiting_initiator', 'awaiting_owner');
