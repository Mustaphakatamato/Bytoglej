-- C1: Klokke-notifikationer hos institutioner var usynlige.
--
-- Rodårsag: RLS-hardeningen (20260616) begrænsede SELECT/UPDATE til
-- institution_id IN (...), men klienten (klokke + /notifikationer) læser med
-- .eq('institution_name', ...). Rækker uden institution_id (fx auto-match-søges)
-- blev derfor filtreret væk af RLS og kunne aldrig vises.
--
-- Fix: gør policyen tolerant for BEGGE nøgler (institution_id ELLER
-- institution_name), så en notifikation vises uanset om den er nøglet på id,
-- navn eller begge. Inserts opdateres samtidig til altid at sætte institution_id.

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (
    institution_id IN (
      SELECT id FROM public.institutions WHERE email = auth.email()
      UNION
      SELECT im.institution_id FROM public.institution_members im WHERE im.email = auth.email()
    )
    OR institution_name IN (
      SELECT name FROM public.institutions WHERE email = auth.email()
      UNION
      SELECT i.name FROM public.institutions i
        JOIN public.institution_members im ON im.institution_id = i.id
        WHERE im.email = auth.email()
    )
  );

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE USING (
    institution_id IN (
      SELECT id FROM public.institutions WHERE email = auth.email()
      UNION
      SELECT im.institution_id FROM public.institution_members im WHERE im.email = auth.email()
    )
    OR institution_name IN (
      SELECT name FROM public.institutions WHERE email = auth.email()
      UNION
      SELECT i.name FROM public.institutions i
        JOIN public.institution_members im ON im.institution_id = i.id
        WHERE im.email = auth.email()
    )
  );

-- Valgfrit (kør hvis ønsket): backfill institution_id på gamle rækker ud fra navnet,
-- så fremtidige id-baserede forespørgsler også fanger dem.
-- UPDATE public.notifications n
--   SET institution_id = i.id
--   FROM public.institutions i
--   WHERE n.institution_id IS NULL AND n.institution_name = i.name;
