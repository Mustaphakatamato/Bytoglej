# Readiness-review — klar til at gå live med rigtige institutioner?

**Dato:** 2026-07-07
**Metode:** Kodegennemgang af de højeste-risiko-flows (betaling, dataisolation/RLS,
admin-auth, cron, onboarding) + lokal produktionsbuild. Live-database og Vercel-miljø
kunne **ikke** verificeres fra denne session — det er markeret eksplicit nedenfor
(jf. CLAUDE.md: gæt aldrig).

**Samlet vurdering: BETINGET GO for en lille, overvåget pilot** — men **ikke** grønt
lys til uovervåget onboarding, før de fire verifikationspunkter under "Skal lukkes
før live" er kvitteret. Selve **koden** er i god stand; de resterende risici ligger i
*live-konfiguration og datahygiejne*, som ikke kan tjekkes fra kildekoden alene.

---

## ✅ Det der er solidt (verificeret i kode)

- **Stripe-webhook** (`app/api/webhooks/stripe/route.js`): signatur verificeres
  (`constructEvent`), kvitterer straks 2xx og kører fulfillment i baggrunden
  (`waitUntil`), og idempotens håndhæves med et **atomisk `pending → paid`-claim**.
  Retry efter nedbrud genkøres sikkert; shipment-id'er persisteres før fuldførelse,
  så intet dobbelt-bookes. Stærkt bygget.
- **Beløb beregnes server-side** (`app/api/payments/create-intent/route.js`): alle
  priser hentes fra DB — aldrig fra klienten. Køber verificeres som medlem af
  institutionen, og der er en godkendelses-gate (`is_approved !== true` → 403).
- **Admin-routes**: samtlige routes i `app/api/admin/*` (+ `admin-approve-institution`)
  slår kalderen op i `admins`-tabellen server-side og afviser med 403 ellers.
- **Cron-routes**: alle fire tjekker `CRON_SECRET`.
- **Beskeder/samtaler-RLS** (`20260615_message_rls_hardening.sql`): deltager-scopet
  via `conv_is_participant()` (SECURITY DEFINER). Ingen sender-spoofing, ingen
  fremmed-samtale-adgang. Dette er kernen i GDPR-dataisolationen — og den er stram.
- **RLS-hardening bredt** (`20260612_security_rls_fixes.sql`,
  `20260616_security_rls_hardening.sql`): åbne `USING(true)`-policies på
  institutions, listings, notifications, feedback, bids m.fl. er strammet.
- **Middleware** ekskluderer webhooks fra body-manipulation.
- **Juridiske sider** findes med reelt indhold: `/vilkaar` (122 linjer),
  `/privatlivspolitik` (107 linjer); faktureringsvilkår (Model B) er publiceret
  (jf. git-historik).
- **Build kompilerer rent** ("✓ Compiled successfully"). De eneste warnings er den
  kendte, ufarlige Supabase/Edge-runtime-advarsel.

---

## 🔴 KRITISK — bør lukkes/verificeres før onboarding

### K1. Invitér-medarbejder-flowet kan fejle tavst under RLS
`app/invitasjon/[token]/page.js` linker den nye medarbejder til institutionen med et
**klientside self-upsert** som *invitéen selv*:
```js
await db.from('institution_members').upsert({ institution_id, email, role: 'member' }, ...)
```
Men INSERT-policyen på `institution_members`
(`20260612_security_rls_fixes.sql`, "Admin inserts members") tillader **kun**
ejer/leder/eksisterende admin at indsætte. Invitéen er ingen af delene → RLS **blokerer**
insertet, og der er **ingen fejlhåndtering** på kaldet. Resultat: den inviterede kollega
får en konto, men bliver **ikke** knyttet til institutionen — uden fejlbesked.

**Fix:** flyt medlems-linkningen server-side (service role) i invite-accept-endpointet,
**eller** verificér i live-DB'en at en policy faktisk tillader token-baseret self-insert.
*(Skal verificeres mod live-DB før konklusion — se datahygiejne nedenfor.)*

---

## 🟡 BØR FIKSES

### B1. `institution_invitations` SELECT er `USING(true)`
Enhver logget-ind bruger kan `select *` og dumpe **alle** åbne invitationer (e-mails +
tokens). Kombineret med accept-flowet betyder et lækket token, at man kan tilslutte sig
en fremmed institution. Stram til token-scoped opslag eller flyt opslaget server-side.
(`invitations_update`/`_delete` er tilsvarende `USING(true)`.)

### B2. Åbne TODO'er fra sidste handover (`CLAUDE-HANDOVER.md`)
- **Privacy-consent-migration** (`20260615_privacy_consent.sql`): hvis den ikke er kørt
  i prod, fejler Fortrolighed-toggles med 500. **Verificér.**
- **Søge-autocomplete** lækker skjulte institutionsnavne (Privacy by Design). Åben.

---

## ❓ Verifikationshuller — KAN IKKE tjekkes fra kode (gæt ikke — tjek manuelt)

Disse er ikke fejl, men **ukendte** der skal kvitteres før live:

1. **Live-RLS-tilstand.** Migrationsfilerne er stærke, men "faktisk anvendt i prod på
   ALLE tabeller" er uverificeret herfra. Kør Supabase **security advisor**
   (`get_advisors`, type `security`) eller tjek manuelt at RLS er *enabled* på hver
   tabel. **Dette er den vigtigste enkeltstående før-launch-kontrol.**
2. **Vercel-miljøvariabler.** 30 `process.env.*` bruges. Bekræft at ALLE er sat i
   prod — især `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `GROQ_API_KEY`,
   VAPID-nøglerne, `CRON_SECRET`, `SHIPMONDO_*` og `BYTLEG_*` (issuer-stamdata til
   fakturaer). Mangler én → betaling/mail/AI/cron/bilag fejler i prod.
3. **Test-/seed-data i prod-DB.** Ryd dummy-opslag/-konti før rigtige brugere slippes ind.
4. **CO₂-modulet.** `CO2_LAUNCH_CHECKLIST.md` er stort set ukvitteret. Ikke launch-
   blokerende hvis CO₂-tal vises blødt ("estimeret/ca."), men bekræft `CO2_SETUP.sql`
   er kørt, ellers viser modulet 0/fejl.

---

## Anbefalet før-launch-tjekliste (rækkefølge)

1. [ ] Kør Supabase security advisor → bekræft RLS enabled på alle tabeller (huller #1)
2. [ ] Bekræft alle Vercel-env-variabler er sat (huller #2)
3. [ ] Fix/verificér invitér-medarbejder-linkningen (K1)
4. [ ] Kør evt. manglende migrationer (privacy_consent, CO2_SETUP) (B2, huller #4)
5. [ ] Ryd test-/seed-data (huller #3)
6. [ ] Stram `institution_invitations`-policies (B1)
7. [ ] Kør én ægte end-to-end handel i prod med to testinstitutioner:
       signup → godkendelse → opslag → køb + byt → betaling → forsendelse → kvittering

Når 1–5 er kvitteret: **go for en lille, overvåget pilot** (få kendte institutioner,
tæt opfølgning). Bred, uovervåget onboarding først når hele listen er grøn.

---

## Tillæg (2026-07-07): Supabase security advisor — kørt + rettet

Advisoren blev kørt mod prod. Følgende er **rettet og verificeret** (migration
`20260707_security_advisor_hardening.sql`, anvendt i prod):

- 🛑→✅ **Wallet-RPC-hul (show-stopper):** `wallet_credit` / `wallet_debit`
  (saldo-mutation) + `next_doc_number` var eksekverbare af `anon`/`authenticated`
  via PostgREST RPC — enhver kunne kreditere sig selv saldo med anon-nøglen.
  EXECUTE trukket fra anon/authenticated/public; `service_role` beholdt. Verificeret
  `anon=false, authed=false, service_role=true`.
- 🔴→✅ **Storage-listing (GDPR):** fjernet brede SELECT-policies på de fire public
  buckets (fragtlabels m. navne+adresser, chat-billeder, feedback-screenshots,
  listing-billeder) — stopper `list()`-enumerering. Visning via `getPublicUrl` uberørt.
- 🟡→✅ **`notifications` INSERT-spoofing:** droppet den permissive `WITH CHECK(true)`
  INSERT-policy; notifikationer laves kun server-side.
- 🟢 **`institutions_public`-view (advisor: ERROR):** gennemgået — eksponerer kun
  kuraterede offentlige felter (navn, by, postnr, kommune, logo, koordinater, børnetal)
  og kun for `profile_public = true`. Ingen e-mail/adresse/CVR/bank. Bevidst, sikkert
  mønster — bevaret.

**Resterende advisor-punkter (bevidste / lavrisiko — ikke blokerende):**
- SECURITY DEFINER RLS-hjælpefunktioner (`conv_is_participant`, `user_can_manage_members`,
  `user_in_institution`, `user_institution_approved`) er RPC-kaldbare, men returnerer kun
  bool ud fra kalderens egen identitet og **skal** kunne kaldes af `authenticated` (bruges
  i RLS-policies). `match_listings` (søgning), `institution_email_exists` (signup),
  `get_listing_favorites_for_owner`, `bump_conv_unread` er legitime klient-RPC'er.
- Åbne INSERT-policies på `feedback`, `listing_reports`, `scan_rejection_logs`,
  `transaction_co2_savings` — indsendelses-/log-endpoints, lav risiko (spam/dataintegritet).
- `data_export_log` / `document_counters`: RLS uden policies = **deny-all** (sikkert).
- Hardening: `set_updated_at` mangler `search_path`; `vector`-extension i public-schema.

**Manuelle punkter (kan ikke sættes via SQL):**
- [ ] **Aktivér "Leaked Password Protection"** i Supabase → Auth (HaveIBeenPwned-tjek).
- [ ] **Follow-up (kræver kodeændring):** gør `shipping-labels` + `feedback-screenshots`
  til *private* buckets + signed URLs (`lib/shipmondo/client.js`, `FeedbackWidget.js`).
  Listing er nu lukket, men public buckets er stadig læsbare med direkte URL.
