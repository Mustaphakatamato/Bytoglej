-- ── Ordre-fulfillment: adskil label-booking fra afsendelse ────────
-- Status-modellen strammes op: 'shipped' betyder nu at SÆLGER har afsendt
-- (eller Shipmondo har meldt in_transit) — ikke at labelen blev booket.
-- Køberens modtag-bekræftelse sker via API-route (service role), så orders
-- får ingen nye RLS-policies her.

-- Sættes når ordren bekræftes leveret (Shipmondo-webhook eller køber).
alter table public.orders
  add column if not exists delivered_at timestamptz;

-- Kobler shipments til ordrer, så Shipmondo-webhooken kan opdatere
-- ordre-status ved in_transit/delivered. Købs-forsendelser lå tidligere
-- KUN i orders.order_groups (jsonb) og blev aldrig ramt af webhooken.
alter table public.shipments
  add column if not exists order_id uuid references public.orders(id);

create index if not exists shipments_order_id_idx
  on public.shipments(order_id) where order_id is not null;
