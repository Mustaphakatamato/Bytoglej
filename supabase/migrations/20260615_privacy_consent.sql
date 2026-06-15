-- ── Fortrolighed & samtykke (GDPR Fase 1) ───────────────────────────
--
-- Tilføjer privacy-præferencer til institutions + en append-only
-- samtykke-log. Datatilsynet kræver at man kan DOKUMENTERE samtykke:
-- hvornår det blev givet/trukket, til hvad, og af hvem. Derfor logges
-- hver ændring i consent_log med timestamp + IP, mens den aktuelle
-- effektive værdi spejles på institutions for hurtig læsning i fx
-- mail-flows og den offentlige profilside.
--
-- Vigtige compliance-valg:
--   • marketing_consent DEFAULT false  → ingen forhåndsafkrydsning (opt-in)
--   • profile_public    DEFAULT true   → præference, ikke samtykke
--   • consent_log er kun skrivbar via service role (API) → kan ikke forfalskes
--
-- Køres i Supabase SQL Editor.

-- 1) Præference-/samtykkefelter på institutions (hurtig læsning)
alter table public.institutions
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists profile_public    boolean not null default true;

-- 2) Append-only samtykke-log (audit-trail til Datatilsynet)
create table if not exists public.consent_log (
  id              uuid primary key default gen_random_uuid(),
  institution_id  uuid not null references public.institutions(id) on delete cascade,
  consent_type    text not null,            -- 'marketing' | 'profile_public'
  granted         boolean not null,
  changed_by      uuid references auth.users(id),
  ip_address      text,
  user_agent      text,
  changed_at      timestamptz not null default now()
);

create index if not exists consent_log_institution_idx
  on public.consent_log (institution_id, consent_type, changed_at desc);

-- 3) RLS: ingen policies for anon/authenticated.
--    Kun service role (API-routes) må læse og skrive. Det sikrer at
--    samtykke altid registreres server-side og ikke kan manipuleres
--    fra klienten.
alter table public.consent_log enable row level security;
