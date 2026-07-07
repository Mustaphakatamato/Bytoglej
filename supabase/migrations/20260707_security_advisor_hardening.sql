-- ================================================================
-- SIKKERHEDSHARDENING efter Supabase security advisor (2026-07-07)
-- Anvendt i prod via MCP; her committet så repo og prod matcher.
-- ================================================================

-- 1) SHOW-STOPPER: wallet_credit/wallet_debit (saldo-mutation) + next_doc_number
--    (bilagsnummerering) var eksekverbare af anon/authenticated via PostgREST RPC.
--    Enhver kunne kalde /rest/v1/rpc/wallet_credit med anon-nøglen og kreditere
--    vilkårlig saldo. Alle tre kaldes KUN server-side via service role.
-- ----------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.wallet_credit(uuid,numeric,text,text,text,text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.wallet_debit(uuid,numeric,text,text,text,text)  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.next_doc_number(text)                            FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.wallet_credit(uuid,numeric,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_debit(uuid,numeric,text,text,text,text)  TO service_role;
GRANT EXECUTE ON FUNCTION public.next_doc_number(text)                            TO service_role;


-- 2) notifications INSERT havde WITH CHECK(true): enhver klient kunne indsætte
--    notifikationer til en vilkårlig institution (spoofing). Alle notifikationer
--    laves server-side via service role (lib/notify.js, auto-match-soges), som
--    omgår RLS. Drop den permissive policy.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;


-- 3) Offentlige storage-buckets havde brede SELECT-policies der lod anon/authenticated
--    LISTE alle filer (enumerering af fragtlabels m. navne+adresser, chat-billeder osv.).
--    Bucket'erne er public=true, så visning via getPublicUrl bruger public-CDN-stien og
--    konsulterer ikke RLS — at droppe SELECT-policyerne stopper list()-enumerering uden
--    at bryde visning. Upload (INSERT) og sletning er separate policies og røres ikke.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Public read access for chat images" ON storage.objects;
DROP POLICY IF EXISTS "Public read listing images"        ON storage.objects;
DROP POLICY IF EXISTS "Public read shipping labels"       ON storage.objects;
DROP POLICY IF EXISTS "feedback_screenshots_select"       ON storage.objects;
