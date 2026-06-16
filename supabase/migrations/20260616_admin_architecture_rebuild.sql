-- ============================================================
-- ADMIN ARKITEKTUR GENOPBYGNING
-- ============================================================
-- Denne migration er allerede kørt direkte i Supabase dashboard.
-- Filen er gemt her til reference og versionsstyring.

-- 1. admin_audit_log – log over alle admin-handlinger
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email text NOT NULL,
  action      text NOT NULL,
  target_type text,
  target_id   text,
  target_name text,
  details     jsonb,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_audit_log_select" ON public.admin_audit_log
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "admin_audit_log_insert" ON public.admin_audit_log
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- 2. listing_reports – rapporterede opslag
CREATE TABLE IF NOT EXISTS public.listing_reports (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id                uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  reporter_email            text,
  reporter_institution_name text,
  reason                    text NOT NULL,
  details                   text,
  status                    text NOT NULL DEFAULT 'pending',
  reviewed_by               text,
  reviewed_at               timestamptz,
  created_at                timestamptz DEFAULT now()
);
ALTER TABLE public.listing_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listing_reports_insert" ON public.listing_reports
  FOR INSERT WITH CHECK (true);
CREATE POLICY "listing_reports_select" ON public.listing_reports
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "listing_reports_update" ON public.listing_reports
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- 3. admin_notes kolonne på feedback
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS admin_notes text;

-- 4. Fjern live.dk fra admins-tabellen
DELETE FROM public.admins WHERE email = 'mustaphakatamato@live.dk';

-- 5. Opdater RLS på institutions
DROP POLICY IF EXISTS "Platform admin can read all institutions" ON public.institutions;
DROP POLICY IF EXISTS "Platform admin can update all institutions" ON public.institutions;
CREATE POLICY "Admin can read all institutions" ON public.institutions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "Admin can update all institutions" ON public.institutions
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- 6. Opdater RLS på listings
DROP POLICY IF EXISTS "Platform admin can delete all listings" ON public.listings;
DROP POLICY IF EXISTS "Platform admin can read all listings" ON public.listings;
DROP POLICY IF EXISTS "Platform admin can update all listings" ON public.listings;
DROP POLICY IF EXISTS "admin_read_all_listings" ON public.listings;
CREATE POLICY "Admin can read all listings" ON public.listings
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "Admin can update all listings" ON public.listings
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "Admin can delete all listings" ON public.listings
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- 7-9. Opdater RLS på CO2-tabeller
DROP POLICY IF EXISTS "admin_read_audit" ON public.co2_audit_log;
DROP POLICY IF EXISTS "admin_write_audit" ON public.co2_audit_log;
DROP POLICY IF EXISTS "insert_audit" ON public.co2_audit_log;
CREATE POLICY "admin_read_audit" ON public.co2_audit_log
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "admin_write_audit" ON public.co2_audit_log
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_manage_factors" ON public.co2_emission_factors;
DROP POLICY IF EXISTS "admin_write_factors" ON public.co2_emission_factors;
CREATE POLICY "admin_manage_factors" ON public.co2_emission_factors
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_manage_versions" ON public.co2_methodology_versions;
DROP POLICY IF EXISTS "admin_write_versions" ON public.co2_methodology_versions;
CREATE POLICY "admin_manage_versions" ON public.co2_methodology_versions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- 10. Opdater consent_log SELECT
DROP POLICY IF EXISTS "consent_log_select" ON public.consent_log;
CREATE POLICY "consent_log_select" ON public.consent_log
  FOR SELECT USING (
    institution_id IN (
      SELECT id FROM public.institutions WHERE email = auth.email()
      UNION
      SELECT im.institution_id FROM public.institution_members im WHERE im.email = auth.email()
    )
    OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

-- 11. Admin-adgang til orders
CREATE POLICY "Admin can read all orders" ON public.orders
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "Admin can update all orders" ON public.orders
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- 12. Admin-adgang til shipments
CREATE POLICY "Admin can read all shipments" ON public.shipments
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "Admin can update all shipments" ON public.shipments
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- 13. Admin-adgang til notifications
CREATE POLICY "admin_notifications_select" ON public.notifications
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- 14. Admin-adgang til shipping_invoices
CREATE POLICY "Admin can read all shipping invoices" ON public.shipping_invoices
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "Admin can update all shipping invoices" ON public.shipping_invoices
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- 15. Admin-adgang til transaction_reviews
CREATE POLICY "Admin can read all reviews" ON public.transaction_reviews
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));

-- 16. Feedback: kun admins kan læse (fjern generel authenticated adgang)
DROP POLICY IF EXISTS "feedback_read_authenticated" ON public.feedback;
CREATE POLICY "admin_read_feedback" ON public.feedback
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()));
