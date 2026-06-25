-- ================================================================
-- offers.proposed_by — hvem fremsatte tilbuddet (2026-06-17)
--
-- Nødvendigt for modbud (counter): når sælger sender et modbud,
-- oprettes en ny offers-række proposed_by='seller', så modparten
-- (køber) kan acceptere/afvise/modbyde netop dét tilbud. Uden feltet
-- kan vi ikke afgøre hvem der må svare på et givent pending-tilbud.
--
-- Idempotent. Køres i Supabase SQL Editor.
-- ================================================================
alter table public.offers
  add column if not exists proposed_by text not null default 'buyer';

alter table public.offers
  drop constraint if exists offers_proposed_by_chk;
alter table public.offers
  add constraint offers_proposed_by_chk check (proposed_by in ('buyer', 'seller'));
