-- Migration: tilføj user_id til listings så man altid kan finde egne opslag
-- Kør dette i Supabase SQL Editor

alter table listings
  add column if not exists user_id uuid references auth.users(id);

-- Tillad brugere at opdatere og slette egne opslag
create policy if not exists "Owner update" on listings
  for update using (auth.uid() = user_id);

create policy if not exists "Owner delete" on listings
  for delete using (auth.uid() = user_id);
