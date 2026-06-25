-- ================================================================
-- "Modtaget"-bekræftelse pr. part i bundt-bytte  (2026-06-25)
--
-- Hver part kan bekræfte at de har modtaget modpartens bundt, så
-- "Mine køb" kan vise en "✅ Marker som modtaget"-knap for bytter
-- (på linje med almindelige køb-ordrers delivered-status).
--
-- Idempotent. Køres i Supabase SQL Editor (eller via MCP apply_migration).
-- ================================================================

ALTER TABLE public.swap_proposals
  ADD COLUMN IF NOT EXISTS initiator_received boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_received boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.swap_proposals.initiator_received IS 'Initiator har bekræftet modtagelse af modpartens (owners) bundt.';
COMMENT ON COLUMN public.swap_proposals.owner_received IS 'Owner har bekræftet modtagelse af modpartens (initiators) bundt.';
