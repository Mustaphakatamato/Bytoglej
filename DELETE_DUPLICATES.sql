-- ============================================================
-- Slet dubletter i listings
-- Beholder det ÆLDSTE opslag (laveste id) af hvert duplikat
-- Identificerer dubletter ud fra samme titel + institution_name
-- ============================================================

-- Se hvor mange dubletter der er FØR sletning
SELECT title, institution_name, COUNT(*) AS antal
FROM listings
GROUP BY title, institution_name
HAVING COUNT(*) > 1
ORDER BY antal DESC, title;

-- Slet dubletter (beholder det med lavest id)
DELETE FROM listings
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY title, institution_name
        ORDER BY id ASC  -- behold den første (laveste id)
      ) AS rn
    FROM listings
  ) sub
  WHERE rn > 1
);

-- Bekræftelse
SELECT institution_name, city, COUNT(*) AS antal_opslag
FROM listings
GROUP BY institution_name, city
ORDER BY institution_name;
