-- ================================================================
-- VÆGTBASERET PAKKEVALG: konverter shipping_size_category fra enum → text
--
-- Den nye vægt-vælger i opret-opslag gemmer pakkevægt i gram (fx "1000").
-- Kolonnen shipping_size_category var en enum (small/medium/large/xlarge),
-- så insert af vægt-værdier fejlede tavst → opslag fik can_ship=true men
-- INGEN shipping_options-række (vægten gik tabt).
--
-- Konverterer de tre kolonner der bruger enum'en til text. Eksisterende
-- legacy-værdier ('small'/'medium'/…) bevares som tekst og håndteres fortsat
-- af sizeToLegacy/sizeToParcel/getShippingPrice (begge formater understøttes).
-- ================================================================

ALTER TABLE shipping_options
  ALTER COLUMN shipping_size_category TYPE text USING shipping_size_category::text;

ALTER TABLE shipments
  ALTER COLUMN size_category TYPE text USING size_category::text;

ALTER TABLE shipmondo_price_cache
  ALTER COLUMN size_category TYPE text USING size_category::text;

-- Enum-typen er nu forældreløs men efterlades (harmløst).
