-- ================================================================
-- BESKEDER: deltager-bevidst RLS-hardening (2026-06-15)
--
-- Lukker tre sikkerhedshuller fundet i beskedmodulet:
--   #2  conversations UPDATE var "using (true)" → enhver kunne ændre
--       enhver samtale (markér læst, arkivér, deal_completed ...).
--   #3  chat_messages INSERT var "with check (true)" → beskeder kunne
--       skrives i fremmede samtaler og sender kunne spoofes.
--   #4  conversations SELECT fra 12. juni var for stram
--       (kun initiator_id/owner_id = auth.uid()) → institutions-
--       deltagere og modtagere af direkte beskeder (owner_id null)
--       kunne ikke læse deres egne samtaler.
--
-- Retter desuden et latent bug: chat_messages havde INGEN UPDATE-policy,
-- så bud-status-opdateringer (bid_status) fejlede tavst og rullede
-- tilbage ved reload. Tilføjer en deltager-scopet UPDATE-policy.
--
-- Selve sletning sker server-side via /api/delete-conversation (service
-- role); disse policies er den håndhævede sikkerhedsmodel for alt andet.
--
-- Køres i Supabase SQL Editor.
-- ================================================================


-- ----------------------------------------------------------------
-- Hjælpefunktion: er den aktuelle bruger deltager i en samtale?
-- SECURITY DEFINER, så den kan slå institutions/medlemskab op uanset
-- RLS på de tabeller. Matcher præcis appens deltager-logik:
--   - direkte bruger-match (initiator_id / owner_id)
--   - direkte besked via e-mail (initiator_name / owner_name = e-mail)
--   - institution man ejer/leder (institutions.email / leader_email)
--   - institution man er medlem af (institution_members.email)
--   - admin (fuld adgang)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.conv_is_participant(
  _initiator_id              uuid,
  _owner_id                  uuid,
  _initiator_institution_id  uuid,
  _owner_institution_id      uuid,
  _initiator_name            text,
  _owner_name                text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _initiator_id = auth.uid()
    OR _owner_id = auth.uid()
    OR _initiator_name = auth.email()
    OR _owner_name = auth.email()
    OR EXISTS (SELECT 1 FROM admins a WHERE a.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM institutions i
      WHERE (i.email = auth.email() OR i.leader_email = auth.email())
        AND (i.id   = _owner_institution_id
          OR i.id   = _initiator_institution_id
          OR i.name = _owner_name
          OR i.name = _initiator_name)
    )
    OR EXISTS (
      SELECT 1
      FROM institution_members m
      JOIN institutions i2 ON i2.id = m.institution_id
      WHERE m.email = auth.email()
        AND (i2.id   = _owner_institution_id
          OR i2.id   = _initiator_institution_id
          OR i2.name = _owner_name
          OR i2.name = _initiator_name)
    );
$$;


-- ----------------------------------------------------------------
-- conversations
-- ----------------------------------------------------------------
-- Ryd alle tidligere policy-varianter (idempotent).
DROP POLICY IF EXISTS "Public read conversations"        ON conversations;
DROP POLICY IF EXISTS "Public insert conversations"      ON conversations;
DROP POLICY IF EXISTS "Public update conversations"      ON conversations;
DROP POLICY IF EXISTS "Public delete conversations"      ON conversations;
DROP POLICY IF EXISTS "Participants read conversation"   ON conversations;
DROP POLICY IF EXISTS "Participants update conversation" ON conversations;
DROP POLICY IF EXISTS "Participants insert conversation" ON conversations;
DROP POLICY IF EXISTS "Participants delete conversation" ON conversations;

CREATE POLICY "Participants read conversation" ON conversations
  FOR SELECT
  USING (public.conv_is_participant(initiator_id, owner_id, initiator_institution_id, owner_institution_id, initiator_name, owner_name));

-- Opretteren skal være en af parterne (initiator eller owner) — eller admin.
CREATE POLICY "Participants insert conversation" ON conversations
  FOR INSERT
  WITH CHECK (
    initiator_id = auth.uid()
    OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM admins a WHERE a.user_id = auth.uid())
  );

CREATE POLICY "Participants update conversation" ON conversations
  FOR UPDATE
  USING (public.conv_is_participant(initiator_id, owner_id, initiator_institution_id, owner_institution_id, initiator_name, owner_name))
  WITH CHECK (public.conv_is_participant(initiator_id, owner_id, initiator_institution_id, owner_institution_id, initiator_name, owner_name));

CREATE POLICY "Participants delete conversation" ON conversations
  FOR DELETE
  USING (public.conv_is_participant(initiator_id, owner_id, initiator_institution_id, owner_institution_id, initiator_name, owner_name));


-- ----------------------------------------------------------------
-- chat_messages — deltagelse afgøres af forælder-samtalen
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Public read chat_messages"      ON chat_messages;
DROP POLICY IF EXISTS "Public insert chat_messages"    ON chat_messages;
DROP POLICY IF EXISTS "Public delete chat_messages"    ON chat_messages;
DROP POLICY IF EXISTS "Participants read messages"     ON chat_messages;
DROP POLICY IF EXISTS "Participants insert messages"   ON chat_messages;
DROP POLICY IF EXISTS "Participants update messages"   ON chat_messages;
DROP POLICY IF EXISTS "Participants delete messages"   ON chat_messages;

CREATE POLICY "Participants read messages" ON chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND public.conv_is_participant(c.initiator_id, c.owner_id, c.initiator_institution_id, c.owner_institution_id, c.initiator_name, c.owner_name)
    )
  );

-- Indsæt kun i egne samtaler, og kun som dig selv (ingen sender-spoofing).
CREATE POLICY "Participants insert messages" ON chat_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND public.conv_is_participant(c.initiator_id, c.owner_id, c.initiator_institution_id, c.owner_institution_id, c.initiator_name, c.owner_name)
    )
  );

-- NY: deltagere må opdatere beskeder i egne samtaler (fx bid_status).
CREATE POLICY "Participants update messages" ON chat_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND public.conv_is_participant(c.initiator_id, c.owner_id, c.initiator_institution_id, c.owner_institution_id, c.initiator_name, c.owner_name)
    )
  );

CREATE POLICY "Participants delete messages" ON chat_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND public.conv_is_participant(c.initiator_id, c.owner_id, c.initiator_institution_id, c.owner_institution_id, c.initiator_name, c.owner_name)
    )
  );
