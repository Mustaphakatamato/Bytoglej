-- ── Bilag & moms-fundament (Model B — byt&leg som mellemhandler) ─────
-- byt&leg udsteder alle bilag i eget fortløbende nummersystem:
--   • Købsfaktura til køber (pr. ordre)
--   • Afregningsbilag til sælger (pr. salg, selvfakturering §52a)
--   • Udbetalingsbilag til sælger (pr. udbetaling)
-- Denne migration lægger KUN datafundamentet: kolonner, documents-arkiv,
-- gapless nummerering og momskode pr. opslag. Selve bilagsgenerering (PDF)
-- og oprettelses-hooks bygges i app-laget.
--
-- VIGTIGT: den formelle momsklassificering (brugtmoms vs. formidling i eget
-- navn, momsloven §4 stk. 4) er endnu IKKE revisor-underskrevet. vat_treatment
-- er derfor bevidst en fri kode, så modellen kan låses senere uden nyt skema.

-- ── Institutioner: EAN, momsstatus, selvfaktureringsaftale ───────────
alter table public.institutions
  add column if not exists ean                       text,           -- 13 cifre; kun offentlige (EAN/OIOUBL)
  add column if not exists vat_registered            boolean not null default false,
  add column if not exists self_billing_accepted_at  timestamptz,    -- §52a: aftale accepteret ved onboarding
  add column if not exists self_billing_terms_version text;          -- hvilken betingelses-version blev accepteret

-- ── Opslag: momskode pr. vare (afledt af sælgers momsstatus) ─────────
-- Anbefalet default: 'no_vat_reseller' = varelinje uden synlig moms (ikke-
-- momsregistreret sælger). Låses endeligt af revisor.
alter table public.listings
  add column if not exists vat_treatment text not null default 'no_vat_reseller'
    check (vat_treatment in ('no_vat_reseller','margin_scheme','standard_25','exempt'));

-- ── Bilagsarkiv (append-only; bevares min. 5 år jf. bogføringsloven) ─
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  doc_type        text not null check (doc_type in (
                    'koebsfaktura','afregningsbilag','udbetalingsbilag','kreditnota','byttebevis')),
  doc_number      text not null unique,               -- BL-F/A/U/K/B-ÅÅÅÅ-NNNNN (tildeles ved udstedelse)
  institution_id  uuid not null references public.institutions(id) on delete restrict,  -- modtager
  counterparty_id uuid references public.institutions(id),          -- modpart i handlen
  reference_type  text,                               -- 'order' | 'wallet_ledger' | 'payout' | 'swap'
  reference_id    text,
  amount_dkk      numeric(10,2) not null default 0,   -- bruttobeløb inkl. moms
  vat_dkk         numeric(10,2) not null default 0,   -- heraf moms
  currency        text not null default 'DKK',
  payload         jsonb,                              -- linje-snapshot til (re)generering af PDF
  pdf_path        text,                               -- sti i Supabase Storage
  issued_at       timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists documents_inst_idx on public.documents(institution_id, issued_at desc);
create index if not exists documents_type_idx on public.documents(doc_type, issued_at desc);
create index if not exists documents_ref_idx  on public.documents(reference_type, reference_id);

-- ── Fortløbende, gapless nummerering pr. bilagstype og år ────────────
-- Ikke en rå SEQUENCE (efterlader huller ved rollback). Tæller-rækken
-- inkrementeres i SAMME transaktion som bilaget oprettes, så et nummer kun
-- forbruges når bilaget faktisk gemmes.
create table if not exists public.document_counters (
  doc_type text not null,
  year     int  not null,
  last_no  int  not null default 0,
  primary key (doc_type, year)
);

create or replace function public.next_doc_number(_type text)
returns text language plpgsql security definer set search_path = public as $$
declare _year int := extract(year from now())::int; _no int; _prefix text;
begin
  _prefix := case _type
    when 'koebsfaktura'     then 'BL-F'
    when 'afregningsbilag'  then 'BL-A'
    when 'udbetalingsbilag' then 'BL-U'
    when 'kreditnota'       then 'BL-K'
    when 'byttebevis'       then 'BL-B'
    else 'BL-X' end;
  insert into public.document_counters(doc_type, year, last_no) values (_type, _year, 1)
    on conflict (doc_type, year)
    do update set last_no = public.document_counters.last_no + 1
    returning last_no into _no;
  return _prefix || '-' || _year || '-' || lpad(_no::text, 5, '0');
end $$;

-- ── RLS: institutioner kan LÆSE egne bilag; skrivning kun via service-role ─
alter table public.documents         enable row level security;
alter table public.document_counters enable row level security;   -- deny-all (ingen policy) — kun service-role

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select using (public.user_in_institution(institution_id));
