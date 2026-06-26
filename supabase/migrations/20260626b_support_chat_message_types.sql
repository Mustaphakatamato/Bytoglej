-- Udvider support-chatten: beskedtyper (text/image/system) + 'system'-rolle til
-- afslut/genåbn-events, samt last_user_at til inaktivitets-auto-luk.
-- (Afspejler ændringer anvendt på prod; idempotent.)

ALTER TABLE support_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text';

ALTER TABLE support_messages DROP CONSTRAINT IF EXISTS support_messages_role_check;
ALTER TABLE support_messages
  ADD CONSTRAINT support_messages_role_check
  CHECK (role IN ('user', 'bot', 'admin', 'system'));

ALTER TABLE support_messages DROP CONSTRAINT IF EXISTS support_messages_message_type_check;
ALTER TABLE support_messages
  ADD CONSTRAINT support_messages_message_type_check
  CHECK (message_type IN ('text', 'image', 'system'));

ALTER TABLE support_conversations
  ADD COLUMN IF NOT EXISTS last_user_at TIMESTAMPTZ;
