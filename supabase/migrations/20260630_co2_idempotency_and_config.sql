-- CO2 — idempotens + konsistens (2026-06-30)
--
-- Baggrund: CO2 blev kun registreret for nogle handelsflows, og der var ingen
-- beskyttelse mod dobbelt-registrering af samme samtale. Denne migration:
--   1. Fjerner evt. eksisterende dubletter (beholder ældste række pr. samtale).
--   2. Tilføjer UNIQUE(transaction_id), så hver handel kun kan tælle én gang.
--   3. Retter default_distance_km på metode v1.0 fra 25 → 10, så DB matcher
--      koden (lib/co2/calculator.js) og metode-siden (10 km).
--
-- Kør i Supabase SQL Editor ÉN gang.

-- ============================================================
-- 1. Fjern dubletter (behold ældste pr. transaction_id)
-- ============================================================
DELETE FROM transaction_co2_savings t
USING transaction_co2_savings d
WHERE t.transaction_id = d.transaction_id
  AND t.created_at > d.created_at;

-- Hvis to rækker har præcis samme created_at, behold laveste id.
DELETE FROM transaction_co2_savings t
USING transaction_co2_savings d
WHERE t.transaction_id = d.transaction_id
  AND t.created_at = d.created_at
  AND t.id > d.id;

-- ============================================================
-- 2. UNIQUE(transaction_id) — backstop mod dobbelt-tælling
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transaction_co2_savings_transaction_id_key'
  ) THEN
    ALTER TABLE transaction_co2_savings
      ADD CONSTRAINT transaction_co2_savings_transaction_id_key UNIQUE (transaction_id);
  END IF;
END $$;

-- ============================================================
-- 3. Ret default-afstand så DB matcher kode + metode-side
-- ============================================================
UPDATE co2_methodology_versions
SET default_distance_km = 10
WHERE version = '1.0' AND default_distance_km <> 10;
