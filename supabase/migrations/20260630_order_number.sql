-- ── Kortere, kundevendte ordrenumre ─────────────────────────────
-- Tidligere viste vi det rå UUID (fx 15738bbc-538d-4f41-bd47-681f195bd5ee)
-- som ordrenummer i mails og app. Det er ulæseligt og giver ingen mening for
-- kunden. order_number er nu en fortløbende, menneskelæselig sekvens, som
-- formateres til fx "BL-1042" i front­enden (se lib/order-number.js).

create sequence if not exists public.order_number_seq start with 1000;

alter table public.orders
  add column if not exists order_number bigint;

-- Backfill eksisterende ordrer i oprettelsesrækkefølge, så de ældste ordrer
-- får de laveste numre.
do $$
declare r record;
begin
  for r in
    select id from public.orders
    where order_number is null
    order by created_at, id
  loop
    update public.orders
      set order_number = nextval('public.order_number_seq')
      where id = r.id;
  end loop;
end $$;

-- Nye ordrer får automatisk næste nummer ved insert.
alter table public.orders
  alter column order_number set default nextval('public.order_number_seq');

alter sequence public.order_number_seq owned by public.orders.order_number;

create unique index if not exists orders_order_number_key
  on public.orders (order_number);
