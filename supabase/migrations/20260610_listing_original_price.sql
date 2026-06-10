-- Track original price so listings can show a price reduction
alter table listings
  add column if not exists original_price integer;
