-- Onboarding hardening migration (2026-06-27)
-- Fixes: institutions/institution_members PII exposure (show-stopper #1),
--        approval gate enforcement (show-stopper #2),
--        institution_members tautology write bug (critical #7),
--        prepaid flag on shipments for swap double-billing fix (show-stopper #3).
-- Safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- Helper functions (SECURITY DEFINER → bypass RLS, no recursion)
-- ─────────────────────────────────────────────────────────────

-- True if the current user belongs to an APPROVED institution (or is a platform admin).
CREATE OR REPLACE FUNCTION public.user_institution_approved()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM admins a WHERE a.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM institutions i
        WHERE (i.email = auth.email() OR i.leader_email = auth.email())
          AND i.is_approved IS TRUE
      )
      OR EXISTS (
        SELECT 1 FROM institution_members m
        JOIN institutions i ON i.id = m.institution_id
        WHERE m.email = auth.email() AND i.is_approved IS TRUE
      );
$$;

-- True if the current user may manage members of the given institution
-- (institution owner/leader, an admin-role member of THAT institution, or a platform admin).
CREATE OR REPLACE FUNCTION public.user_can_manage_members(_inst_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _inst_id IS NOT NULL AND (
       EXISTS (SELECT 1 FROM institutions i
               WHERE i.id = _inst_id AND (i.email = auth.email() OR i.leader_email = auth.email()))
    OR EXISTS (SELECT 1 FROM institution_members m
               WHERE m.institution_id = _inst_id AND m.email = auth.email() AND m.role = 'admin')
    OR EXISTS (SELECT 1 FROM admins a WHERE a.user_id = auth.uid())
  );
$$;

-- Anon-safe existence check for signup duplicate-email validation.
CREATE OR REPLACE FUNCTION public.institution_email_exists(p_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM institutions WHERE lower(email) = lower(p_email));
$$;
GRANT EXECUTE ON FUNCTION public.institution_email_exists(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- #1  institutions: stop exposing the full row (CVR, P-nr, bank,
--     leader contact, email/phone) to the public anon key.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public read" ON public.institutions;

CREATE POLICY "institutions_owner_member_admin_read" ON public.institutions
  FOR SELECT USING (
        email = auth.email()
     OR leader_email = auth.email()
     OR id IN (SELECT institution_id FROM public.institution_members WHERE email = auth.email())
     OR EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid())
  );
-- ("Admin can read all institutions" / "Own institution update" / insert policies stay as-is.)

-- Public directory view: only non-sensitive marketplace fields, only for
-- institutions that opted into a public profile. SECURITY DEFINER view (default)
-- so it bypasses the base-table RLS and exposes ONLY these columns.
DROP VIEW IF EXISTS public.institutions_public;
CREATE VIEW public.institutions_public AS
  SELECT id, name, type, institution_type, ownership_type, city, zipcode,
         kommune, logo_url, website, latitude, longitude, children_count,
         profile_public, created_at
  FROM public.institutions
  WHERE profile_public IS TRUE;
GRANT SELECT ON public.institutions_public TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- #1b institution_members: stop public read of all member emails.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "members_select" ON public.institution_members;
CREATE POLICY "members_select" ON public.institution_members
  FOR SELECT USING (
        email = auth.email()
     OR public.user_in_institution(institution_id)
  );

-- ─────────────────────────────────────────────────────────────
-- #7  institution_members write: fix tautology bug
--     (old policy: m.institution_id = m.institution_id → always true →
--      any admin-member could manage ANY institution's members).
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin inserts members" ON public.institution_members;
DROP POLICY IF EXISTS "Admin deletes members" ON public.institution_members;
CREATE POLICY "Admin inserts members" ON public.institution_members
  FOR INSERT WITH CHECK (public.user_can_manage_members(institution_id));
CREATE POLICY "Admin deletes members" ON public.institution_members
  FOR DELETE USING (public.user_can_manage_members(institution_id));

-- ─────────────────────────────────────────────────────────────
-- #2  Approval gate: an unapproved institution may not list or transact.
--     (All 40 existing institutions are is_approved = true, so no lockout.)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owner inserts listing" ON public.listings;
CREATE POLICY "Owner inserts listing" ON public.listings
  FOR INSERT WITH CHECK (user_id = auth.uid() AND public.user_institution_approved());

DROP POLICY IF EXISTS "offers_insert" ON public.offers;
CREATE POLICY "offers_insert" ON public.offers
  FOR INSERT WITH CHECK (public.user_in_institution(buyer_institution_id) AND public.user_institution_approved());

DROP POLICY IF EXISTS "swap_insert" ON public.swap_proposals;
CREATE POLICY "swap_insert" ON public.swap_proposals
  FOR INSERT WITH CHECK (public.user_in_institution(initiator_institution_id) AND public.user_institution_approved());

-- ─────────────────────────────────────────────────────────────
-- #3  shipments.prepaid: swap labels are pre-paid at checkout and must
--     NOT be re-billed by the monthly shipping-invoice cron.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS prepaid boolean NOT NULL DEFAULT false;
