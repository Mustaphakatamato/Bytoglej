-- Add min_bid to listings (optional minimum bid amount)
alter table listings add column if not exists min_bid integer;
