-- Add fav_count column to listings
alter table listings add column if not exists fav_count integer default 0;
