-- Run this in Supabase SQL Editor
-- Creates listing_favorites table to track which institutions save listings

CREATE TABLE IF NOT EXISTS listing_favorites (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id       uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id   uuid REFERENCES institutions(id) ON DELETE SET NULL,
  institution_name text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, user_id)
);

-- Allow authenticated users to manage their own favorites
ALTER TABLE listing_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own favorites"
  ON listing_favorites FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Listing owners can see who favorited their listings
CREATE POLICY "Listing owners can read favorites"
  ON listing_favorites FOR SELECT
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE user_id = auth.uid()
    )
  );
