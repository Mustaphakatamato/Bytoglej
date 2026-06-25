-- ================================================================
-- Anslået værdi på byt-opslag  (2026-06-24)
--
-- Byt-opslag har ingen pris (price = NULL), så værdi-sammenligningen
-- og det kontante mellemlag i bundt-bytte (SwapProposalModal) var
-- reelt "0 mod 0". Vi indfører en obligatorisk anslået værdi på
-- byt-opslag, gemt i kroner ligesom resten af skemaet.
--
-- Køb-/søges-opslag bruger fortsat `price`. `estimated_value` er kun
-- udfyldt for byt. Værdi-beregningen i swap-flowet bruger
-- COALESCE(price, estimated_value).
--
-- Idempotent. Køres i Supabase SQL Editor.
-- ================================================================

ALTER TABLE listings ADD COLUMN IF NOT EXISTS estimated_value numeric(10,2);

COMMENT ON COLUMN listings.estimated_value IS
  'Anslået værdi for byt-opslag (kroner). NULL for køb/søges (de bruger price). Bruges til værdi-sammenligning i bundt-bytte.';
