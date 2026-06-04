-- Migration 003: Kan sendes
alter table listings add column if not exists can_ship boolean default false;
