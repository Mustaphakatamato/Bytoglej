-- ── Bytte-fulfillment: samme model som køb (adskil sendt fra label) ──
-- Bytter havde et 'received'-flag pr. part, men intet 'sent'-flag. Derfor
-- kunne modtageren se "På vej til dig", før modparten faktisk havde sendt.
-- Nu markerer hver part sin UDGÅENDE bundt afsendt — parallelt med købs-
-- flowets seller-mark-sent.

alter table public.swap_proposals
  add column if not exists initiator_sent boolean not null default false,
  add column if not exists owner_sent     boolean not null default false;

-- Kobler bytte-forsendelser til forslaget, så Shipmondo-webhooken kan sætte
-- modtagerens received-flag automatisk ved levering (som køb-ordrer via order_id).
alter table public.shipments
  add column if not exists swap_proposal_id uuid;

create index if not exists shipments_swap_proposal_id_idx
  on public.shipments(swap_proposal_id) where swap_proposal_id is not null;
