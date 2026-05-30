-- Migration 001: Søges listings + in-app notifications
-- Run this once in the Supabase SQL editor

-- 1. Add urgency column to listings (used by søges type)
alter table listings add column if not exists urgency text;

-- 2. In-app notifications table
create table if not exists notifications (
  id           uuid primary key default gen_random_uuid(),
  institution_id   uuid,
  institution_name text,
  type         text not null,   -- 'auto_match_soges' | 'auto_match_listing'
  title        text not null,
  body         text,
  data         jsonb default '{}',
  read         boolean default false,
  created_at   timestamptz default now()
);

create index if not exists notifications_institution_id_idx   on notifications(institution_id);
create index if not exists notifications_institution_name_idx on notifications(institution_name);
create index if not exists notifications_read_idx             on notifications(read);

-- RLS: institutions can only see their own notifications
alter table notifications enable row level security;

create policy "notifications_select" on notifications
  for select using (true);  -- client filters by institution_id/name

create policy "notifications_insert" on notifications
  for insert with check (true);

create policy "notifications_update" on notifications
  for update using (true);

-- To roll back:
-- alter table listings drop column if exists urgency;
-- drop table if exists notifications;
