-- ── Tilføj bankkontofelter til institutions ──────────────────────
alter table public.institutions
  add column if not exists bank_reg_nr     text,
  add column if not exists bank_account_nr text;

-- ── Opret orders-tabel ───────────────────────────────────────────
create table if not exists public.orders (
  id                    uuid primary key default gen_random_uuid(),
  payment_intent_id     text unique not null,
  buyer_id              uuid references auth.users(id),
  buyer_institution_id  uuid references public.institutions(id),
  buyer_address         text,
  buyer_zip             text,
  buyer_city            text,
  buyer_email           text,
  buyer_phone           text,
  buyer_name            text,
  grand_total           numeric(10,2) not null,
  status                text not null default 'pending',  -- pending | paid | shipped | delivered | refunded
  order_groups          jsonb not null default '[]',       -- array of seller groups with items, prices, tracking
  shipmondo_shipment_id text,
  tracking_number       text,
  tracking_url          text,
  label_pdf_url         text,
  created_at            timestamptz not null default now(),
  paid_at               timestamptz,
  shipped_at            timestamptz
);

-- Row Level Security
alter table public.orders enable row level security;

-- Køber kan se egne ordrer
create policy "Køber ser egne ordrer"
  on public.orders for select
  using (buyer_id = auth.uid());

-- Service role (API routes) kan alt — håndteres via service key bypass
