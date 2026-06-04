-- Migration 004: Følg institution
create table if not exists institution_follows (
  id                 uuid primary key default gen_random_uuid(),
  follower_user_id   uuid not null,
  institution_name   text not null,
  created_at         timestamptz default now(),
  unique(follower_user_id, institution_name)
);

alter table institution_follows enable row level security;
create policy "follows_select" on institution_follows for select using (auth.uid() = follower_user_id);
create policy "follows_insert" on institution_follows for insert with check (auth.uid() = follower_user_id);
create policy "follows_delete" on institution_follows for delete using (auth.uid() = follower_user_id);
