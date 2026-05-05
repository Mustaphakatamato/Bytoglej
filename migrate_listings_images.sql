-- Migration: tilføj billeder til listings
-- Kør dette i Supabase SQL Editor

alter table listings
  add column if not exists images text[] default '{}';
