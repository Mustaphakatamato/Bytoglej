-- Allow listing owners to see who has favorited their own listings.
-- Without this, RLS only lets users see their OWN favorites (user_id = auth.uid()),
-- so the dashboard "Interesserede" section returns empty for listing owners.

-- Policy for direct listing owners
CREATE POLICY "listing_owners_can_see_favoriters"
ON listing_favorites
FOR SELECT
USING (
  listing_id IN (
    SELECT id FROM listings WHERE user_id = auth.uid()
  )
);

-- Policy for institution members (listings owned by institution_name)
CREATE POLICY "institution_members_can_see_favoriters"
ON listing_favorites
FOR SELECT
USING (
  listing_id IN (
    SELECT l.id
    FROM listings l
    JOIN institutions inst ON l.institution_name = inst.name
    JOIN institution_members mem ON mem.institution_id = inst.id
    WHERE mem.email = auth.email()
  )
);
