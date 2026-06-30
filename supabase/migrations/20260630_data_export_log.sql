-- ── Downloadhistorik for data-eksport (GDPR) ─────────────────────────
--
-- Hver gang en bruger henter en kopi af sine data ("Download mine data",
-- GDPR art. 15 & 20) appender vi en række her. Det giver institutionen en
-- synlig historik over hvornår data er hentet, og hvilket format, og giver
-- os en audit-trail på indsigtsanmodninger.
--
-- Samme compliance-mønster som consent_log:
--   • append-only (vi opdaterer/sletter aldrig rækker)
--   • kun skrivbar via service role (API) → kan ikke forfalskes fra klienten
--   • RLS slået til uden policies for anon/authenticated
--
-- Køres i Supabase SQL Editor.

create table if not exists public.data_export_log (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  exported_by     uuid references auth.users(id),
  format          text not null default 'html',   -- 'html' | 'json'
  ip_address      text,
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index if not exists data_export_log_institution_idx
  on public.data_export_log (institution_id, created_at desc);

-- RLS: ingen policies for anon/authenticated. Kun service role (API-routes)
-- må læse og skrive, så historikken altid registreres server-side og ikke
-- kan manipuleres fra klienten.
alter table public.data_export_log enable row level security;
