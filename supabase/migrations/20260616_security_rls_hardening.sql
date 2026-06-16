-- ============================================================
-- SIKKERHEDSMIGRATION: RLS hardening
-- ============================================================

-- 1. saved_searches: Aktiver RLS + tilføj policies (KRITISK)
-- ============================================================
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_searches_select" ON public.saved_searches
  FOR SELECT USING (email = auth.email());

CREATE POLICY "saved_searches_insert" ON public.saved_searches
  FOR INSERT WITH CHECK (email = auth.email());

CREATE POLICY "saved_searches_update" ON public.saved_searches
  FOR UPDATE USING (email = auth.email()) WITH CHECK (email = auth.email());

CREATE POLICY "saved_searches_delete" ON public.saved_searches
  FOR DELETE USING (email = auth.email());


-- 2. consent_log: Tilføj policies (RLS aktiveret men ingen policies)
-- ============================================================
CREATE POLICY "consent_log_insert" ON public.consent_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "consent_log_select" ON public.consent_log
  FOR SELECT USING (
    institution_id IN (
      SELECT id FROM public.institutions WHERE email = auth.email()
      UNION
      SELECT im.institution_id FROM public.institution_members im WHERE im.email = auth.email()
    )
    OR auth.email() = 'mustaphakatamato@gmail.com'
  );


-- 3. institution_invitations: Tilføj policies (RLS aktiveret men ingen policies)
-- ============================================================
CREATE POLICY "invitations_select" ON public.institution_invitations
  FOR SELECT USING (true);

CREATE POLICY "invitations_insert" ON public.institution_invitations
  FOR INSERT WITH CHECK (
    institution_id IN (
      SELECT id FROM public.institutions
        WHERE email = auth.email() OR leader_email = auth.email()
      UNION
      SELECT im.institution_id FROM public.institution_members im
        WHERE im.email = auth.email() AND im.role = 'admin'
    )
  );

CREATE POLICY "invitations_update" ON public.institution_invitations
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "invitations_delete" ON public.institution_invitations
  FOR DELETE USING (
    institution_id IN (
      SELECT id FROM public.institutions
        WHERE email = auth.email() OR leader_email = auth.email()
      UNION
      SELECT im.institution_id FROM public.institution_members im
        WHERE im.email = auth.email() AND im.role = 'admin'
    )
  );


-- 4. chat_messages: Fjern den redundante åbne UPDATE policy
-- ============================================================
DROP POLICY "Public update chat_messages" ON public.chat_messages;


-- 5. institutions: Fjern de for åbne UPDATE policies, tilsæt korrekt
-- ============================================================
DROP POLICY "Public update" ON public.institutions;
DROP POLICY "Public update institutions" ON public.institutions;

CREATE POLICY "Own institution update" ON public.institutions
  FOR UPDATE
  USING (
    email = auth.email()
    OR leader_email = auth.email()
    OR id IN (
      SELECT institution_id FROM public.institution_members WHERE email = auth.email()
    )
  )
  WITH CHECK (
    email = auth.email()
    OR leader_email = auth.email()
    OR id IN (
      SELECT institution_id FROM public.institution_members WHERE email = auth.email()
    )
  );


-- 6. institutions: Kræv login for at oprette institution
-- ============================================================
DROP POLICY "Public insert" ON public.institutions;

CREATE POLICY "Authenticated insert institution" ON public.institutions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- 7. listings: Kræv login + eget user_id for at oprette opslag
-- ============================================================
DROP POLICY "Public insert" ON public.listings;

CREATE POLICY "Owner inserts listing" ON public.listings
  FOR INSERT WITH CHECK (user_id = auth.uid());


-- 8. messages (legacy-tabel): Kræv login for INSERT
-- ============================================================
DROP POLICY "Public insert" ON public.messages;

CREATE POLICY "Authenticated insert messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- 9. notifications: Begræns SELECT + UPDATE til brugerens egne institution
-- ============================================================
DROP POLICY "notifications_select" ON public.notifications;
DROP POLICY "notifications_update" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (
    institution_id IN (
      SELECT id FROM public.institutions WHERE email = auth.email()
      UNION
      SELECT im.institution_id FROM public.institution_members im WHERE im.email = auth.email()
    )
  );

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE USING (
    institution_id IN (
      SELECT id FROM public.institutions WHERE email = auth.email()
      UNION
      SELECT im.institution_id FROM public.institution_members im WHERE im.email = auth.email()
    )
  );


-- 10. feedback: Fjern den alt for åbne ALL-policy, tilsæt admin UPDATE
-- ============================================================
DROP POLICY "read_feedback" ON public.feedback;

CREATE POLICY "admin_update_feedback" ON public.feedback
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));


-- 11. listing_shares: Stram INSERT, UPDATE og SELECT
-- ============================================================
DROP POLICY "shares_insert" ON public.listing_shares;
DROP POLICY "shares_update" ON public.listing_shares;
DROP POLICY "shares_select" ON public.listing_shares;

CREATE POLICY "shares_select" ON public.listing_shares
  FOR SELECT USING (to_email = auth.email() OR from_user_id = auth.uid());

CREATE POLICY "shares_insert" ON public.listing_shares
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "shares_update" ON public.listing_shares
  FOR UPDATE USING (to_email = auth.email()) WITH CHECK (to_email = auth.email());


-- 12. transaction_reviews: Kræv login for INSERT
-- ============================================================
DROP POLICY "reviews_insert" ON public.transaction_reviews;

CREATE POLICY "reviews_insert" ON public.transaction_reviews
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- 13. bids: Kræv login for INSERT
-- ============================================================
DROP POLICY "Public insert" ON public.bids;

CREATE POLICY "Authenticated insert bids" ON public.bids
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
