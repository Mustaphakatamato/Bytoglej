-- Tilføj logo_url til institutions
-- Kør dette i Supabase SQL Editor

alter table institutions
  add column if not exists logo_url text;
