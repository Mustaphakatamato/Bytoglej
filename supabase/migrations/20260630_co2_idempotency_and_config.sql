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

-- ============================================================
-- 4. METODE v1.1 — pakke-baseret transport + displacement 0,4
-- ============================================================
-- Transport modelleres nu som én konsolideret pakke (distance-uafhængig) i
-- stedet for privatbil tur/retur pr. km. Ny kolonne holder pakke-emissionen i
-- gram. Displacement sænkes til 0,4 på linje med Vinted/Vaayu (39–40%).
ALTER TABLE co2_methodology_versions
  ADD COLUMN IF NOT EXISTS parcel_emission_g integer;

-- v1.0 var aktiv; deaktivér den og indsæt v1.1 som aktiv.
UPDATE co2_methodology_versions SET active = false WHERE version = '1.0';

INSERT INTO co2_methodology_versions
  (version, displacement_rate, transport_emission_g_per_km, route_buffer_factor, default_distance_km, parcel_emission_g, notes, active)
VALUES
  ('1.1', 0.4, 0, 1.0, 0, 200,
   'Transport modelleret som konsolideret pakke (~200 g/forsendelse, last-mile pakkedata S10) i stedet for privatbil tur/retur — trukket fra én gang pr. handel. Displacement sænket fra 0,6 til 0,4 på linje med Vinted/Vaayu (39–40%, S6/S9). Produktionsfaktorer uændrede fra v1.0.',
   true)
ON CONFLICT (version) DO UPDATE
  SET displacement_rate = EXCLUDED.displacement_rate,
      parcel_emission_g = EXCLUDED.parcel_emission_g,
      notes             = EXCLUDED.notes,
      active            = true;
