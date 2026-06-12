-- Fix: Restore SELECT on institutions.
--
-- The previous migration (20260612_security_rls_fixes.sql) revoked SELECT on
-- institutions for anon/authenticated, which broke the entire app: AppProvider,
-- profile page, and 20+ other client-side queries all return null.
--
-- We restore SELECT here. Bank field protection is handled at the application
-- level (API routes never expose bank_reg_nr / bank_account_nr to clients).
-- The institutions_public view remains available for forward-compatible use.
--
-- Run in Supabase SQL Editor.

GRANT SELECT ON public.institutions TO anon, authenticated;
