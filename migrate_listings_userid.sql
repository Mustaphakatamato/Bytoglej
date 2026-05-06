-- Migration: tilføj user_id til listings så man altid kan finde egne opslag
-- Kør dette i Supabase SQL Editor

alter table listings
  add column if not exists user_id uuid references auth.users(id);
