-- Add tags array column to listings
alter table listings add column if not exists tags text[] default '{}'::text[];
