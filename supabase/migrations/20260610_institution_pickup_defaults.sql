-- Default pickup hours and notes saved on the institution
alter table institutions
  add column if not exists default_pickup_hours text,
  add column if not exists default_pickup_notes  text;
