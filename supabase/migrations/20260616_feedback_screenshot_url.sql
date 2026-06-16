-- Opretter feedback-tabellen (idempotent) og tilføjer screenshot_url-kolonnen
-- som manglede fra den originale manuelle tabel-opsætning.

create table if not exists public.feedback (
  id               uuid primary key default gen_random_uuid(),
  category         text not null default 'general',
  message          text not null,
  institution_name text,
  user_email       text,
  page             text,
  screenshot_url   text,
  is_read          boolean not null default false,
  status           text not null default 'new',
  created_at       timestamptz not null default now()
);

-- Tilføj kolonnen hvis tabellen allerede eksisterer uden den
alter table public.feedback
  add column if not exists screenshot_url text;

alter table public.feedback enable row level security;

-- Kun service role må læse/skrive feedback (admin-panel bruger service role)
-- Ingen authenticated/anon policies = kun service role har adgang
