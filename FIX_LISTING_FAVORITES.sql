-- Fix listing_favorites visibility for listing owners
-- Run this in Supabase SQL Editor

-- Step 1: Drop all existing policies on listing_favorites
DROP POLICY IF EXISTS "Users manage own favorites"              ON listing_favorites;
DROP POLICY IF EXISTS "Listing owners can read favorites"       ON listing_favorites;
DROP POLICY IF EXISTS "listing_owners_can_see_favoriters"       ON listing_favorites;
DROP POLICY IF EXISTS "institution_members_can_see_favoriters"  ON listing_favorites;
DROP POLICY IF EXISTS "users_manage_own_favorites"              ON listing_favorites;
DROP POLICY IF EXISTS "listing_owners_read_favorites"           ON listing_favorites;
DROP POLICY IF EXISTS "institution_members_read_favorites"      ON listing_favorites;
DROP POLICY IF EXISTS "authenticated_owners_read_favorites"     ON listing_favorites;

-- Step 2: Simple policies
-- 2a. Users manage their own favorites
CREATE POLICY "users_manage_own_favorites"
  ON listing_favorites FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2b. Authenticated users can read ALL favorites (we filter in the app + function)
CREATE POLICY "authenticated_read_favorites"
  ON listing_favorites FOR SELECT
  TO authenticated
  USING (true);

-- Step 3: Create a SECURITY DEFINER function to safely fetch favorites for a listing owner
DROP FUNCTION IF EXISTS get_listing_favorites_for_owner(uuid[]);

CREATE OR REPLACE FUNCTION get_listing_favorites_for_owner(p_listing_ids uuid[])
RETURNS TABLE(
  listing_id       uuid,
  institution_name text,
  institution_id   uuid,
  user_id          uuid,
  created_at       timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lf.listing_id,
    lf.institution_name,
    lf.institution_id,
    lf.user_id,
    lf.created_at
  FROM listing_favorites lf
  WHERE lf.listing_id = ANY(p_listing_ids)
  ORDER BY lf.created_at DESC;
END;
$$;

-- Step 4: Ensure fav_count column exists
ALTER TABLE listings ADD COLUMN IF NOT EXISTS fav_count integer DEFAULT 0;
