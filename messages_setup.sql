-- Beskedmodul: samtaler og beskeder
-- Kør dette i Supabase SQL Editor

create table if not exists conversations (
  id               uuid default uuid_generate_v4() primary key,
  listing_id       uuid references listings(id) on delete set null,
  listing_title    text not null,
  listing_emoji    text default '🧸',
  listing_color    text default '#FFD166',
  listing_image    text,
  initiator_id     uuid,
  initiator_name   text not null,
  owner_id         uuid,
  owner_name       text not null,
  last_message     text,
  last_message_at  timestamptz default now(),
  initiator_unread integer default 0,
  owner_unread     integer default 0,
  created_at       timestamptz default now(),
  unique(listing_id, initiator_id)
);

create table if not exists chat_messages (
  id              uuid default uuid_generate_v4() primary key,
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id       uuid,
  sender_name     text not null,
  content         text not null,
  created_at      timestamptz default now()
);

alter table conversations enable row level security;
alter table chat_messages  enable row level security;

create policy "Public read conversations"   on conversations for select using (true);
create policy "Public insert conversations" on conversations for insert with check (true);
create policy "Public update conversations" on conversations for update using (true);
create policy "Public read chat_messages"   on chat_messages for select using (true);
create policy "Public insert chat_messages" on chat_messages for insert with check (true);
