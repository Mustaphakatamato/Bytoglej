-- Bundle discount settings per institution
ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS bundle_discount_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bundle_discount_tiers   jsonb   DEFAULT '[{"min_items":2,"percent":5},{"min_items":3,"percent":10},{"min_items":5,"percent":20}]'::jsonb;
