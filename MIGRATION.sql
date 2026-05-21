-- Run this in Supabase SQL Editor
ALTER TABLE listings ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS subcategory text;
