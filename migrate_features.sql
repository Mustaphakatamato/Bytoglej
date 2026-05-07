-- Feature 13: Archive conversations
alter table conversations
  add column if not exists archived_by_initiator boolean default false,
  add column if not exists archived_by_owner boolean default false;

-- Feature 16: Bid messages
alter table chat_messages
  add column if not exists message_type text default 'text',
  add column if not exists bid_amount numeric,
  add column if not exists bid_status text,
  add column if not exists bid_note text;

-- Feature 19: Multi-user institutions
create table if not exists institution_members (
  id uuid default gen_random_uuid() primary key,
  institution_id uuid references institutions(id) on delete cascade,
  email text not null,
  role text default 'member',
  created_at timestamptz default now(),
  unique(institution_id, email)
);
alter table institution_members enable row level security;
create policy "members_select" on institution_members for select using (true);
create policy "members_insert" on institution_members for insert with check (true);
create policy "members_delete" on institution_members for delete using (true);
