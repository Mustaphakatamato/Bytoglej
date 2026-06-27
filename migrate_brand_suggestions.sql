-- ============================================================
-- Brugerforeslåede varemærker (custom brands)
-- Når en institution skriver et mærke der ikke er på listen,
-- lander det her som forslag. Admin godkender → mærket bliver
-- fremadrettet en del af den fælles liste (status='approved').
-- AI-vurderingen (ai_recognized + ai_note) er kun en hjælp til admin.
-- ============================================================

create table if not exists brand_suggestions (
  id                uuid primary key default gen_random_uuid(),
  brand_name        text not null,                 -- som brugeren skrev det (vises på listen)
  normalized_name   text not null,                 -- lower(trim) til dedup
  status            text not null default 'pending', -- pending | approved | rejected
  ai_recognized     boolean,                        -- true = AI genkender mærket
  ai_note           text,                           -- meget kort AI-beskrivelse / begrundelse
  institution_name  text,                           -- hvem foreslog det
  user_id           uuid,
  listing_id        uuid,                           -- opslaget der udløste forslaget
  created_at        timestamptz not null default now(),
  reviewed_at       timestamptz,
  reviewed_by       text
);

-- Ét forslag pr. unikt mærke (uanset status) — API'en dedup'er mod dette.
create unique index if not exists brand_suggestions_normalized_uniq
  on brand_suggestions (normalized_name);

create index if not exists brand_suggestions_status_idx
  on brand_suggestions (status);

alter table brand_suggestions enable row level security;

-- Læsning: alle godkendte brugere kan se GODKENDTE mærker (til BrandPicker-listen).
drop policy if exists "read approved brands" on brand_suggestions;
create policy "read approved brands"
  on brand_suggestions for select
  to authenticated
  using (status = 'approved');

-- Admins kan læse ALT (pending/rejected medregnet) — bruges til admin-fanen + badge.
drop policy if exists "admins read all brand suggestions" on brand_suggestions;
create policy "admins read all brand suggestions"
  on brand_suggestions for select
  to authenticated
  using (exists (select 1 from admins where admins.user_id = auth.uid()));

-- Indsæt + opdater sker udelukkende via API-ruter med service-role-nøgle,
-- så der er bevidst ingen INSERT/UPDATE-policy for almindelige brugere.
