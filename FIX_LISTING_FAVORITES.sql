-- Fix listing_favorites RLS policies
-- Run this in Supabase SQL Editor

-- 1. Ensure table exists
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

-- 3. Users can manage their own favorites
CREATE POLICY "users_manage_own_favorites"
  ON listing_favorites FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Direct listing owners can read favorites on their listings
CREATE POLICY "listing_owners_read_favorites"
  ON listing_favorites FOR SELECT
  USING (
    listing_id IN (
      SELECT listings.id
      FROM listings
      WHERE listings.user_id = auth.uid()
    )
  );

-- 5. Institution members can read favorites on their institution's listings
CREATE POLICY "institution_members_read_favorites"
  ON listing_favorites FOR SELECT
  USING (
    listing_id IN (
      SELECT listings.id
      FROM listings
      JOIN institutions
        ON institutions.name = listings.institution_name
      JOIN institution_members
        ON institution_members.institution_id = institutions.id
      WHERE institution_members.email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    )
  );

-- 6. Ensure fav_count column exists on listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS fav_count integer DEFAULT 0;
