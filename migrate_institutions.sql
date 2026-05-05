-- Migration: udvid institutions-tabellen med flere felter
-- Kør dette i Supabase SQL Editor

alter table institutions
  add column if not exists institution_type text,
  add column if not exists ownership_type   text,
  add column if not exists zipcode          text,
  add column if not exists children_count   integer,
  add column if not exists phone            text,
  add column if not exists website          text,
  add column if not exists leader_name      text,
  add column if not exists leader_phone     text,
  add column if not exists leader_email     text,
  add column if not exists contact_name     text;
