-- ================================================================
-- INVITATIONER: stram RLS på institution_invitations (2026-07-07)
--
-- Baggrund (readiness-review):
--   invitations_select var "USING (true)" → enhver logget-ind bruger kunne
--   dumpe ALLE åbne invitationer (e-mails + tokens) og dermed tilslutte sig
--   fremmede institutioner. invitations_update var tilsvarende "USING (true)".
--
--   Accept-flowet er nu flyttet server-side (/api/invite/lookup + /api/invite/
--   accept, begge service role), så klienten ikke længere behøver hverken
--   SELECT eller UPDATE på tabellen for at acceptere. Tilbage står KUN
--   ejer/leder/admins behov for at se og administrere egne invitationer
--   (siden /medarbejdere) — og det scoper vi til.
--
-- INSERT- og DELETE-policyerne fra 20260616 er allerede korrekt scopede til
-- ejer/leder/admin og røres ikke her.
--
-- Køres i Supabase SQL Editor.
-- ================================================================

-- SELECT: kun invitationer for institutioner man ejer/leder eller er admin i.
DROP POLICY IF EXISTS "invitations_select" ON public.institution_invitations;
CREATE POLICY "invitations_select" ON public.institution_invitations
  FOR SELECT USING (
    institution_id IN (
      SELECT id FROM public.institutions
        WHERE email = auth.email() OR leader_email = auth.email()
      UNION
      SELECT im.institution_id FROM public.institution_members im
        WHERE im.email = auth.email() AND im.role = 'admin'
    )
  );

-- UPDATE: accept-markeringen sker nu server-side (service role, som omgår RLS).
-- Klient-UPDATE begrænses derfor til ejer/leder/admin (samme scope som SELECT).
DROP POLICY IF EXISTS "invitations_update" ON public.institution_invitations;
CREATE POLICY "invitations_update" ON public.institution_invitations
  FOR UPDATE
  USING (
    institution_id IN (
      SELECT id FROM public.institutions
        WHERE email = auth.email() OR leader_email = auth.email()
      UNION
      SELECT im.institution_id FROM public.institution_members im
        WHERE im.email = auth.email() AND im.role = 'admin'
    )
  )
  WITH CHECK (
    institution_id IN (
      SELECT id FROM public.institutions
        WHERE email = auth.email() OR leader_email = auth.email()
      UNION
      SELECT im.institution_id FROM public.institution_members im
        WHERE im.email = auth.email() AND im.role = 'admin'
    )
  );
