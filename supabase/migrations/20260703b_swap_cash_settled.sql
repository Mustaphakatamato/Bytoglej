-- Kontant mellemlag i byttehandler afregnes nu til modtagerens byt&leg-konto
-- (i stedet for manuel udbetaling). Idempotens-flag så et webhook-retry af
-- færdiggørelsen ikke krediterer kontanten to gange.
alter table public.swap_proposals
  add column if not exists cash_settled boolean not null default false;
