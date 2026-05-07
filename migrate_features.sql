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

-- Feature: Share listings with team members
create table if not exists listing_shares (
  id uuid default gen_random_uuid() primary key,
  listing_id uuid,
  listing_title text,
  listing_image text,
  listing_type text,
  listing_price numeric,
  listing_emoji text,
  listing_color text,
  listing_institution_name text,
  listing_city text,
  from_user_id uuid,
  from_name text,
  to_email text not null,
  note text,
  read boolean default false,
  created_at timestamptz default now()
);
alter table listing_shares enable row level security;
drop policy if exists "shares_select" on listing_shares;
drop policy if exists "shares_insert" on listing_shares;
drop policy if exists "shares_update" on listing_shares;
create policy "shares_select" on listing_shares for select using (true);
create policy "shares_insert" on listing_shares for insert with check (true);
create policy "shares_update" on listing_shares for update using (true);

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
drop policy if exists "members_select" on institution_members;
drop policy if exists "members_insert" on institution_members;
drop policy if exists "members_delete" on institution_members;
create policy "members_select" on institution_members for select using (true);
create policy "members_insert" on institution_members for insert with check (true);
create policy "members_delete" on institution_members for delete using (true);
