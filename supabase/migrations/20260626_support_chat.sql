-- ── Kundesupport-chat ──────────────────────────────────────────────────────────
-- AI-bot + menneske-overdragelse, integreret i den eksisterende chat-boble.
-- Denne fil afspejler den FÆRDIGE tilstand i prod (tabeller + RLS-lockdown +
-- realtime + eskaleringslog). Klienter skriver ALDRIG direkte til disse tabeller —
-- al persistering går gennem service-role API'et (/api/support-chat), der bruger
-- samtale-UUID'en som capability-token. Se memory: support-chat.

-- Support conversations (én pr. bruger/session)
CREATE TABLE IF NOT EXISTS support_conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name         TEXT,
  user_email        TEXT,
  institution_name  TEXT,
  status            TEXT NOT NULL DEFAULT 'bot'
                    CHECK (status IN ('bot', 'waiting_human', 'open', 'closed')),
  last_message      TEXT,
  last_message_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admin_unread      INT NOT NULL DEFAULT 0,
  user_unread       INT NOT NULL DEFAULT 0
);

-- Support messages
CREATE TABLE IF NOT EXISTS support_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  conversation_id  UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'bot', 'admin')),
  content          TEXT NOT NULL
);

-- Hver gang botten eskalerer ("det ved jeg ikke") logges det her til finetuning
CREATE TABLE IF NOT EXISTS support_bot_escalations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  conversation_id  UUID REFERENCES support_conversations(id) ON DELETE SET NULL,
  question         TEXT NOT NULL,
  bot_reply        TEXT,
  history          JSONB,
  reason           TEXT,                            -- 'escalate' | 'error' | 'no_key'
  reviewed         BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS support_conversations_user_id_idx     ON support_conversations(user_id);
CREATE INDEX IF NOT EXISTS support_conversations_status_idx      ON support_conversations(status);
CREATE INDEX IF NOT EXISTS support_messages_conv_idx             ON support_messages(conversation_id);
CREATE INDEX IF NOT EXISTS support_bot_escalations_reviewed_idx  ON support_bot_escalations(reviewed);
CREATE INDEX IF NOT EXISTS support_bot_escalations_created_idx   ON support_bot_escalations(created_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────────
ALTER TABLE support_conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_bot_escalations  ENABLE ROW LEVEL SECURITY;

-- Loggede brugere må kun læse (og realtime-abonnere på) deres EGEN samtale.
DROP POLICY IF EXISTS "owner select support conv" ON support_conversations;
CREATE POLICY "owner select support conv" ON support_conversations
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "owner select support msg" ON support_messages;
CREATE POLICY "owner select support msg" ON support_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM support_conversations c
            WHERE c.id = support_messages.conversation_id AND c.user_id = auth.uid())
  );

-- Admins har fuld adgang til ALLE samtaler/beskeder (også loggede institutioners).
DROP POLICY IF EXISTS "admin all support conv" ON support_conversations;
CREATE POLICY "admin all support conv" ON support_conversations
  FOR ALL
  USING (EXISTS (SELECT 1 FROM admins a WHERE a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin all support msg" ON support_messages;
CREATE POLICY "admin all support msg" ON support_messages
  FOR ALL
  USING (EXISTS (SELECT 1 FROM admins a WHERE a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin read escalations" ON support_bot_escalations;
CREATE POLICY "admin read escalations" ON support_bot_escalations
  FOR SELECT USING (EXISTS (SELECT 1 FROM admins a WHERE a.user_id = auth.uid()));

DROP POLICY IF EXISTS "admin update escalations" ON support_bot_escalations;
CREATE POLICY "admin update escalations" ON support_bot_escalations
  FOR UPDATE USING (EXISTS (SELECT 1 FROM admins a WHERE a.user_id = auth.uid()));

-- Bemærk: ingen client INSERT/UPDATE-policies. Service-role-nøglen (API'et) omgår RLS.

-- ── Realtime ────────────────────────────────────────────────────────────────────
-- Loggede brugere + admin får live beskeder. (Anonyme poller API'et i stedet.)
ALTER PUBLICATION supabase_realtime ADD TABLE support_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
