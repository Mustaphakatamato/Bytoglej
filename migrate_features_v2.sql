-- Migration: Features v2 - Sold listings, handled conversations, deals
-- Kør i Supabase SQL Editor

-- 1. Tilføj solgt-status til listings
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS is_sold boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sold_at timestamptz,
  ADD COLUMN IF NOT EXISTS sold_to text,
  ADD COLUMN IF NOT EXISTS sold_to_institution_id uuid REFERENCES institutions(id) ON DELETE SET NULL;

-- 2. Tilføj is_handled til conversations (fjerner fra indkommende når besvaret)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS is_handled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS handled_at timestamptz,
  ADD COLUMN IF NOT EXISTS handled_action text; -- 'accepted', 'rejected', 'countered'

-- 3. Tilføj deal-tracking til conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS deal_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deal_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS deal_type text; -- 'køb', 'byd', 'byt'

-- 4. Indeks for hurtige opslag
CREATE INDEX IF NOT EXISTS idx_listings_is_sold ON listings(is_sold);
CREATE INDEX IF NOT EXISTS idx_listings_sold_to_inst ON listings(sold_to_institution_id);
CREATE INDEX IF NOT EXISTS idx_conversations_is_handled ON conversations(is_handled);
CREATE INDEX IF NOT EXISTS idx_conversations_deal_completed ON conversations(deal_completed);

-- 5. Bekræft
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'listings'
  AND column_name IN ('is_sold', 'sold_at', 'sold_to', 'sold_to_institution_id')
ORDER BY column_name;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'conversations'
  AND column_name IN ('is_handled', 'handled_at', 'handled_action', 'deal_completed', 'deal_completed_at', 'deal_type')
ORDER BY column_name;
