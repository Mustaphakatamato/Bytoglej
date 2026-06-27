-- Draft-opslag for ikke-godkendte institutioner (2026-06-27)
-- Lader en institution forberede sit lager mens den afventer godkendelse:
-- den må oprette/redigere opslag, men KUN som kladde (is_active=false). Aktivering
-- (is_active=true) kræver godkendelse — eller sker automatisk når admin godkender
-- (se app/api/admin-approve-institution/route.js). Safe at re-run.

DROP POLICY IF EXISTS "Owner inserts listing" ON public.listings;
CREATE POLICY "Owner inserts listing" ON public.listings
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND (public.user_institution_approved() OR is_active IS NOT TRUE)
  );

DROP POLICY IF EXISTS "Owner updates listing" ON public.listings;
CREATE POLICY "Owner updates listing" ON public.listings
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid() AND (public.user_institution_approved() OR is_active IS NOT TRUE)
  );
