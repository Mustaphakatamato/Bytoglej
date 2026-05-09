-- Migration: Institution-ID baseret samtalesystem
-- Løser: admin impersonation, owner_id=NULL for demo-opslag, fragil name-matching
-- Kør i Supabase SQL Editor

-- 1. Tilføj institution-ID kolonner til conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS owner_institution_id uuid REFERENCES institutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS initiator_institution_id uuid REFERENCES institutions(id) ON DELETE SET NULL;

-- 2. Tilføj platform-admin flag til institutions (erstatter hardkodet email i klientkode)
ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS is_platform_admin boolean DEFAULT false;

-- 3. Sæt platform-admin flag (tilpas email hvis nødvendigt)
UPDATE institutions SET is_platform_admin = true
WHERE email ILIKE 'mustaphakatamato@live.dk';

-- 4. Backfill eksisterende conversations med institution-ID'er
UPDATE conversations c
SET owner_institution_id = i.id
FROM institutions i
WHERE c.owner_name = i.name
  AND c.owner_institution_id IS NULL;

UPDATE conversations c
SET initiator_institution_id = i.id
FROM institutions i
WHERE c.initiator_name = i.name
  AND c.initiator_institution_id IS NULL;

-- 5. Indeks for hurtige opslag
CREATE INDEX IF NOT EXISTS idx_conversations_owner_inst
  ON conversations(owner_institution_id);
CREATE INDEX IF NOT EXISTS idx_conversations_initiator_inst
  ON conversations(initiator_institution_id);

-- 6. Bekræft
SELECT
  COUNT(*) FILTER (WHERE owner_institution_id IS NOT NULL) AS conv_med_owner_inst_id,
  COUNT(*) FILTER (WHERE initiator_institution_id IS NOT NULL) AS conv_med_initiator_inst_id,
  COUNT(*) AS total_conversations
FROM conversations;

SELECT name, is_platform_admin FROM institutions WHERE is_platform_admin = true;
