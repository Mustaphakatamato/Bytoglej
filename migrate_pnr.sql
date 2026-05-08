-- Migration: Tilføj P-nummer support til institutions-tabellen
-- Offentlige institutioner under kommunen har P-nummer (10 cifre) i stedet for CVR (8 cifre)
-- Kør dette i Supabase SQL Editor

-- 1. Gør cvr nullable (offentlige institutioner behøver ikke CVR)
ALTER TABLE institutions ALTER COLUMN cvr DROP NOT NULL;

-- 2. Tilføj pnr og kommune kolonner
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS pnr text;
ALTER TABLE institutions ADD CONSTRAINT institutions_pnr_unique UNIQUE (pnr);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS kommune text;

-- 3. Sikr at mindst ét af cvr eller pnr altid er udfyldt
ALTER TABLE institutions ADD CONSTRAINT cvr_or_pnr_required
  CHECK (cvr IS NOT NULL OR pnr IS NOT NULL);

-- 4. Bekræft ændringerne
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'institutions'
  AND column_name IN ('cvr', 'pnr')
ORDER BY column_name;
