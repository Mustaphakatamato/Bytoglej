-- ════════════════════════════════════════════════════════════════════
-- Sikkerhedsaudit 2026-06-12 — kritiske RLS-fixes inden go-live
--
-- a) Bankkontodata: fjern fra public SELECT på institutions (view + kolonnerettigheder)
-- b) Beskeder: fjern "Public read" — kun deltagere må læse
-- c) Opslag: fjern "Public update/delete" — kun ejer må opdatere/slette
-- d) Institution members: kræv auth (kun institution/admin må indsætte/slette)
--
-- Køres i Supabase SQL Editor eller via `supabase db push`.
-- ════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────
-- a) BANKKONTODATA PÅ INSTITUTIONS
--
-- Problemet: bank_reg_nr og bank_account_nr kunne læses af alle via
-- public SELECT på institutions-tabellen.
--
-- Løsning:
--   1. Opret et view `institutions_public` UDEN bankfelterne, som
--      frontend kan bruge til offentlige institutionsdata.
--   2. Fjern tabel-niveau SELECT for anon/authenticated og giv i stedet
--      kolonne-niveau SELECT på alle kolonner UNDTAGEN bankfelterne.
--      (PostgREST/Supabase håndterer kolonnerettigheder: `select=*`
--      returnerer kun de kolonner rollen har adgang til.)
--   Service role (API-routes, fx create-intent) er upåvirket og kan
--   stadig læse bankfelterne.
-- ────────────────────────────────────────────────────────────────────

-- 1) View uden bankfelter — bygges dynamisk så det altid matcher tabellens
--    aktuelle kolonner (minus bankfelterne).
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'institutions'
    AND column_name NOT IN ('bank_reg_nr', 'bank_account_nr');

  EXECUTE format(
    'CREATE OR REPLACE VIEW public.institutions_public WITH (security_invoker = on) AS SELECT %s FROM public.institutions',
    cols
  );
END $$;

GRANT SELECT ON public.institutions_public TO anon, authenticated;

-- 2) Kolonne-niveau rettigheder: fjern tabel-SELECT og giv kun adgang
--    til ikke-følsomme kolonner for anon og authenticated.
REVOKE SELECT ON public.institutions FROM anon, authenticated;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'institutions'
    AND column_name NOT IN ('bank_reg_nr', 'bank_account_nr');

  EXECUTE format('GRANT SELECT (%s) ON public.institutions TO anon, authenticated', cols);
END $$;


-- ────────────────────────────────────────────────────────────────────
-- c) OPSLAG (LISTINGS): kun ejer må opdatere/slette
--
-- Problemet: "Public update" og "Public delete" policies tillod alle
-- (også uautentificerede) at ændre eller slette andres opslag.
-- ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public update" ON listings;
DROP POLICY IF EXISTS "Public delete" ON listings;

CREATE POLICY "Owner updates listing" ON listings
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Owner deletes listing" ON listings
  FOR DELETE
  USING (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────────────
-- b) BESKEDER: kun deltagere må læse samtaler og chatbeskeder
--
-- Problemet: "Public read" policies gjorde alle samtaler og beskeder
-- læsbare for enhver — inkl. private aftaler og kontaktoplysninger.
-- ────────────────────────────────────────────────────────────────────

-- Conversations: kun initiator eller ejer (de to deltagere) må læse
DROP POLICY IF EXISTS "Public read conversations" ON conversations;

CREATE POLICY "Participants read conversation" ON conversations
  FOR SELECT
  USING (
    initiator_id = auth.uid() OR owner_id = auth.uid()
  );

-- Chat messages: kun deltagere i den tilhørende samtale må læse
DROP POLICY IF EXISTS "Public read chat_messages" ON chat_messages;

CREATE POLICY "Participants read messages" ON chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.initiator_id = auth.uid() OR c.owner_id = auth.uid())
    )
  );


-- ────────────────────────────────────────────────────────────────────
-- d) INSTITUTION MEMBERS: kræv auth ved insert/delete
--
-- Problemet: members_insert/members_delete havde intet auth-tjek, så
-- enhver kunne tilføje sig selv til (eller fjerne andre fra) en
-- institution.
--
-- Nu må kun:
--   - institutionens egen e-mail eller lederens e-mail, ELLER
--   - et eksisterende medlem med rollen 'admin'
-- indsætte eller slette medlemmer.
-- ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "members_insert" ON institution_members;
DROP POLICY IF EXISTS "members_delete" ON institution_members;

CREATE POLICY "Admin inserts members" ON institution_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM institutions i
      WHERE i.id = institution_id
        AND (i.email = auth.email() OR i.leader_email = auth.email())
    )
    OR EXISTS (
      SELECT 1 FROM institution_members m
      WHERE m.institution_id = institution_id
        AND m.email = auth.email()
        AND m.role = 'admin'
    )
  );

CREATE POLICY "Admin deletes members" ON institution_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM institutions i
      WHERE i.id = institution_id
        AND (i.email = auth.email() OR i.leader_email = auth.email())
    )
    OR EXISTS (
      SELECT 1 FROM institution_members m
      WHERE m.institution_id = institution_id
        AND m.email = auth.email()
        AND m.role = 'admin'
    )
  );
