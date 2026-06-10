-- Admin system: replaces hardcoded ADMIN_EMAIL with a proper admins table
create table if not exists admins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  email      text not null,
  name       text,
  created_at timestamptz default now(),
  unique(user_id)
);

alter table admins enable row level security;

-- Admins can only read their own row (prevents non-admins from listing all admins)
create policy "admin_read_own" on admins for select using (auth.uid() = user_id);

-- Only service role can insert/update/delete (admins are managed via SQL editor)
create policy "admin_service_only_write" on admins for all using (false);
