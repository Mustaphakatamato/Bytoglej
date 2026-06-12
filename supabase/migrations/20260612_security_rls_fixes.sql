-- Sikkerhedsaudit 2026-06-12 - kritiske RLS-fixes inden go-live
--
-- a) Bankkontodata: fjern fra public SELECT paa institutions
-- b) Beskeder: kun deltagere maa laese samtaler og beskeder
-- c) Opslag: kun ejer maa opdatere/slette
-- d) Institution members: kraev auth ved insert/delete
--
-- Koeres i Supabase SQL Editor.


-- ================================================================
-- a) BANKKONTODATA PAA INSTITUTIONS
-- Fjerner bank_reg_nr og bank_account_nr fra public SELECT.
-- Service role (API-routes) er upaavirkede.
-- ================================================================

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
    'CREATE OR REPLACE VIEW public.institutions_public AS SELECT %s FROM public.institutions',
    cols
  );
END $$;

GRANT SELECT ON public.institutions_public TO anon, authenticated;

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


-- ================================================================
-- c) OPSLAG (LISTINGS): kun ejer maa opdatere/slette
-- ================================================================

DROP POLICY IF EXISTS "Public update" ON listings;
DROP POLICY IF EXISTS "Public delete" ON listings;

CREATE POLICY "Owner updates listing" ON listings
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Owner deletes listing" ON listings
  FOR DELETE
  USING (user_id = auth.uid());


-- ================================================================
-- b) BESKEDER: kun deltagere maa laese samtaler og chatbeskeder
-- ================================================================

DROP POLICY IF EXISTS "Public read conversations" ON conversations;

CREATE POLICY "Participants read conversation" ON conversations
  FOR SELECT
  USING (
    initiator_id = auth.uid() OR owner_id = auth.uid()
  );

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


-- ================================================================
-- d) INSTITUTION MEMBERS: kraev auth ved insert/delete
-- ================================================================

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
