-- Fix listing_favorites: clean up duplicate policies and ensure correct RLS
-- Run this in Supabase SQL Editor

-- 1. Ensure table exists with correct structure
CREATE TABLE IF NOT EXISTS listing_favorites (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id       uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id   uuid REFERENCES institutions(id) ON DELETE SET NULL,
  institution_name text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, user_id)
);

ALTER TABLE listing_favorites ENABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies (clean slate)
DROP POLICY IF EXISTS "Users manage own favorites"              ON listing_favorites;
DROP POLICY IF EXISTS "Listing owners can read favorites"       ON listing_favorites;
DROP POLICY IF EXISTS "listing_owners_can_see_favoriters"       ON listing_favorites;
DROP POLICY IF EXISTS "institution_members_can_see_favoriters"  ON listing_favorites;
DROP POLICY IF EXISTS "users_manage_own_favorites"              ON listing_favorites;
DROP POLICY IF EXISTS "listing_owners_read_favorites"           ON listing_favorites;
DROP POLICY IF EXISTS "institution_members_read_favorites"      ON listing_favorites;

-- 3. Policy: users can insert/delete/select their OWN favorites
CREATE POLICY "users_manage_own_favorites"
  ON listing_favorites FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Policy: listing owner (user_id on listing) can see favorites
CREATE POLICY "listing_owners_read_favorites"
  ON listing_favorites FOR SELECT
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE user_id = auth.uid()
    )
  );

-- 5. Policy: institution members can see favorites on their institution's listings
CREATE POLICY "institution_members_read_favorites"
  ON listing_favorites FOR SELECT
  USING (
    listing_id IN (
      SELECT l.id
      FROM listings l
      JOIN institutions inst ON inst.name = l.institution_name
      JOIN institution_members mem ON mem.institution_id = inst.id
      WHERE mem.email = auth.email()
    )
  );

-- 6. Ensure fav_count column exists on listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS fav_count integer DEFAULT 0;
