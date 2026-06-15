-- Sletning af samtaler: erstat usikre "using (true)" delete-policies med
-- deltager-scopede policies. Selve sletningen i appen sker server-side via
-- service role (/api/delete-conversation), men disse policies er forsvar i
-- dybden, så en evt. direkte client-delete kun rammer egne samtaler.
--
-- Køres i Supabase SQL Editor.

-- Fjern de gamle, alt-tilladende delete-policies hvis de findes.
DROP POLICY IF EXISTS "Public delete conversations" ON conversations;
DROP POLICY IF EXISTS "Public delete chat_messages"  ON chat_messages;

-- Kun deltagere må slette deres egne samtaler.
CREATE POLICY "Participants delete conversation" ON conversations
  FOR DELETE
  USING (
    initiator_id = auth.uid() OR owner_id = auth.uid()
  );

-- Kun deltagere må slette beskeder i deres egne samtaler.
CREATE POLICY "Participants delete messages" ON chat_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.initiator_id = auth.uid() OR c.owner_id = auth.uid())
    )
  );
