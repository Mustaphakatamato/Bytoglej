-- FAVORITES_V2.sql
-- Run this in Supabase SQL Editor

-- Step 1: Drop ALL existing policies on listing_favorites
DROP POLICY IF EXISTS "Users manage own favorites"             ON listing_favorites;
DROP POLICY IF EXISTS "Listing owners can read favorites"      ON listing_favorites;
DROP POLICY IF EXISTS "listing_owners_can_see_favoriters"      ON listing_favorites;
DROP POLICY IF EXISTS "institution_members_can_see_favoriters" ON listing_favorites;
DROP POLICY IF EXISTS "users_manage_own_favorites"             ON listing_favorites;
DROP POLICY IF EXISTS "listing_owners_read_favorites"          ON listing_favorites;
DROP POLICY IF EXISTS "institution_members_read_favorites"     ON listing_favorites;
DROP POLICY IF EXISTS "authenticated_owners_read_favorites"    ON listing_favorites;
DROP POLICY IF EXISTS "authenticated_read_favorites"           ON listing_favorites;
DROP POLICY IF EXISTS "manage_own"                             ON listing_favorites;
DROP POLICY IF EXISTS "read_all"                               ON listing_favorites;
DROP POLICY IF EXISTS "read_all_favorites"                     ON listing_favorites;
DROP POLICY IF EXISTS "own_favorites"                          ON listing_favorites;

-- Step 2: Make sure RLS is enabled
ALTER TABLE listing_favorites ENABLE ROW LEVEL SECURITY;

-- Step 3: Two simple policies

-- 3a. Authenticated users manage their own rows (insert, update, delete)
CREATE POLICY "manage_own_favorites"
  ON listing_favorites
  FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3b. Any authenticated user can read all rows (dashboard owners need this)
CREATE POLICY "read_all_favorites"
  ON listing_favorites
  FOR SELECT
  TO authenticated
  USING (true);

-- Step 4: Ensure fav_count column exists on listings
ALTER TABLE listings ADD COLUMN IF NOT EXISTS fav_count integer DEFAULT 0;
