-- CO2 Besparelsesmodul — Database Setup (v1.0)
-- Kør dette i Supabase SQL Editor ÉN gang.
-- Opdateret: 2026-05-30

-- ============================================================
-- 1. EMISSION FACTORS (kilde-sandhed for beregninger)
-- ============================================================
CREATE TABLE IF NOT EXISTS co2_emission_factors (
  id                   text PRIMARY KEY,
  name_da              text NOT NULL,
  co2_kg_per_unit      numeric(8,2) NOT NULL,
  source_ids           jsonb DEFAULT '[]',
  methodology_version  text NOT NULL DEFAULT '1.0',
  active               boolean NOT NULL DEFAULT true,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

ALTER TABLE co2_emission_factors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_factors" ON co2_emission_factors FOR SELECT USING (true);
CREATE POLICY "admin_manage_factors" ON co2_emission_factors FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'mustaphakatamato@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'mustaphakatamato@gmail.com');

INSERT INTO co2_emission_factors (id, name_da, co2_kg_per_unit, source_ids) VALUES
  ('books',               'Bøger',                       1.0,  '["S1","S5"]'),
  ('puzzles',             'Puslespil',                   1.5,  '["S5"]'),
  ('board-games',         'Brætspil',                    2.0,  '["S1","S5"]'),
  ('plush-small',         'Bamser & plysdyr (lille)',     2.5,  '["S1","S2"]'),
  ('plush-large',         'Bamser & plysdyr (stor)',      5.0,  '["S1","S2"]'),
  ('wooden-toys',         'Trælegetøj & klodser',         2.0,  '["S1","S5"]'),
  ('plastic-toys-small',  'Plastiklegetøj (lille)',       1.5,  '["S1","S2"]'),
  ('plastic-toys-medium', 'Plastiklegetøj (medium)',      3.0,  '["S1","S2"]'),
  ('plastic-toys-large',  'Plastiklegetøj (stor)',        8.0,  '["S1","S2"]'),
  ('construction-toys',   'Konstruktionslegetøj',         4.0,  '["S1"]'),
  ('outdoor-toys',        'Udelegetøj',                   4.0,  '["S1","S2"]'),
  ('ride-on-toys',        'Cykler, løbehjul & lign.',    30.0,  '["S4","S5"]'),
  ('electronic-toys',     'Elektronisk legetøj',         12.0,  '["S1","S2"]'),
  ('children-furniture',  'Børnemøbler',                 20.0,  '["S4","S5"]'),
  ('baby-equipment',      'Babyudstyr',                  15.0,  '["S4","S5"]'),
  ('musical-instruments', 'Musikinstrumenter',            4.0,  '["S5"]'),
  ('sports-equipment',    'Sportsudstyr',                 3.0,  '["S5"]'),
  ('costumes-roleplay',   'Kostumer & rollespil',         3.0,  '["S2"]'),
  ('art-craft-supplies',  'Kreativt & hobby',             1.5,  '["S5"]'),
  ('other',               'Andet',                        2.0,  '[]')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. METHODOLOGY VERSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS co2_methodology_versions (
  version                     text PRIMARY KEY,
  effective_from              timestamptz NOT NULL DEFAULT now(),
  displacement_rate           numeric(4,3) NOT NULL,
  transport_emission_g_per_km integer NOT NULL,
  route_buffer_factor         numeric(4,3) NOT NULL DEFAULT 1.3,
  default_distance_km         integer NOT NULL DEFAULT 25,
  notes                       text,
  active                      boolean NOT NULL DEFAULT false,
  created_at                  timestamptz DEFAULT now()
);

ALTER TABLE co2_methodology_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_versions" ON co2_methodology_versions FOR SELECT USING (true);
CREATE POLICY "admin_manage_versions" ON co2_methodology_versions FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'mustaphakatamato@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'mustaphakatamato@gmail.com');

INSERT INTO co2_methodology_versions
  (version, displacement_rate, transport_emission_g_per_km, route_buffer_factor, default_distance_km, notes, active)
VALUES
  ('1.0', 0.6, 170, 1.3, 25,
   'Initial version. Displacement rate 0.6 (conservative low-end of 0.5–0.9 range, S3/S6/S7). Transport: EU average petrol car real-world 170 g/km (EEA 2024, S8). Route buffer 1.3× haversine distance.',
   true)
ON CONFLICT (version) DO NOTHING;

-- ============================================================
-- 3. TRANSACTION CO2 SAVINGS (immutable after insert)
-- ============================================================
CREATE TABLE IF NOT EXISTS transaction_co2_savings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id        uuid NOT NULL,          -- FK to conversations.id
  listing_category_id   text NOT NULL,
  net_saved_kg          numeric(8,3) NOT NULL,
  breakdown             jsonb NOT NULL,
  methodology_version   text NOT NULL,
  calculated_at         timestamptz NOT NULL,
  seller_institution_id uuid,
  buyer_institution_id  uuid,
  seller_name           text,
  buyer_name            text,
  created_at            timestamptz DEFAULT now()
);

-- CRITICAL: no UPDATE or DELETE policies — records are immutable
ALTER TABLE transaction_co2_savings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert_own_savings" ON transaction_co2_savings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "read_own_savings" ON transaction_co2_savings FOR SELECT TO authenticated
  USING (
    seller_institution_id IN (SELECT id FROM institutions WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR buyer_institution_id IN (SELECT id FROM institutions WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    OR auth.jwt() ->> 'email' = 'mustaphakatamato@gmail.com'
  );

-- ============================================================
-- 4. ADD CO2 SUMMARY COLUMNS TO CONVERSATIONS
-- ============================================================
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS co2_net_saved_kg numeric(8,3),
  ADD COLUMN IF NOT EXISTS co2_breakdown     jsonb;

-- ============================================================
-- 5. CO2 AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS co2_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name   text NOT NULL,
  record_id    text NOT NULL,
  action       text NOT NULL,  -- 'insert', 'update', 'version_activated'
  changed_by   text,
  reason       text NOT NULL,
  old_value    jsonb,
  new_value    jsonb,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE co2_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_audit" ON co2_audit_log FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'email' = 'mustaphakatamato@gmail.com');
CREATE POLICY "insert_audit" ON co2_audit_log FOR INSERT TO authenticated WITH CHECK (true);
