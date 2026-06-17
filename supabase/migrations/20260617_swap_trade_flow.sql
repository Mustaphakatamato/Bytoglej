-- Byttehandel (byt) med gensidig forsendelse og escrow.
-- Et bytteforslag kan accepteres af ejeren; derefter betaler begge parter
-- en fast byttebeskyttelse (10 kr) + egen udgående porto. Når BEGGE har
-- betalt, bookes to forsendelser (A→B og B→A). Indtil da holdes labels.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS swap_accepted             boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS swap_initiator_listing_id uuid,
  ADD COLUMN IF NOT EXISTS swap_owner_listing_id     uuid,
  ADD COLUMN IF NOT EXISTS swap_initiator_paid        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS swap_owner_paid            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS swap_initiator_delivery    text,
  ADD COLUMN IF NOT EXISTS swap_owner_delivery        text,
  ADD COLUMN IF NOT EXISTS swap_initiator_shipment_id uuid,
  ADD COLUMN IF NOT EXISTS swap_owner_shipment_id     uuid;
