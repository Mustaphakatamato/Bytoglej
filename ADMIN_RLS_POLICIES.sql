-- ============================================================
-- Admin bypass policies — giver mustaphakatamato@live.dk
-- fuld læseadgang til listings, institutions og institution_members
-- Kør dette i Supabase → SQL Editor
-- ============================================================

-- 1. Listings: admin kan læse ALLE opslag
CREATE POLICY "Platform admin can read all listings"
ON listings FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'mustaphakatamato@live.dk'
);

-- 2. Listings: admin kan opdatere ALLE opslag
CREATE POLICY "Platform admin can update all listings"
ON listings FOR UPDATE
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'mustaphakatamato@live.dk'
);

-- 3. Listings: admin kan slette ALLE opslag
CREATE POLICY "Platform admin can delete all listings"
ON listings FOR DELETE
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'mustaphakatamato@live.dk'
);

-- 4. Institutions: admin kan læse alle institutioner
CREATE POLICY "Platform admin can read all institutions"
ON institutions FOR SELECT
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'mustaphakatamato@live.dk'
);

-- 5. Institutions: admin kan opdatere alle institutioner
CREATE POLICY "Platform admin can update all institutions"
ON institutions FOR UPDATE
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'mustaphakatamato@live.dk'
);

-- Bekræftelse — vis alle policies på listings
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'listings' ORDER BY cmd;
