-- Migration 002: Bekræft modtagelse + Tillid
-- Kør i Supabase SQL Editor

-- 1. Reviews-tabel
create table if not exists transaction_reviews (
  id                        uuid primary key default gen_random_uuid(),
  conversation_id           uuid references conversations(id) on delete cascade,
  reviewer_institution_id   uuid,
  reviewer_institution_name text not null,
  reviewed_institution_name text not null,
  description_score         int check (description_score between 1 and 3),
  contact_score             int check (contact_score between 1 and 3),
  trade_again               text check (trade_again in ('ja', 'måske', 'nej')),
  comment                   text,
  created_at                timestamptz default now(),
  unique(conversation_id, reviewer_institution_name)
);

create index if not exists reviews_reviewed_idx on transaction_reviews(reviewed_institution_name);

alter table transaction_reviews enable row level security;
create policy "reviews_select" on transaction_reviews for select using (true);
create policy "reviews_insert" on transaction_reviews for insert with check (true);

-- 2. Marker samtaler som bekræftet (buyer_confirmed)
alter table conversations add column if not exists buyer_confirmed boolean default false;
alter table conversations add column if not exists buyer_confirmed_at timestamptz;
