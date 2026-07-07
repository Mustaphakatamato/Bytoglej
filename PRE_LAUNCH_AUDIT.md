# PRE-LAUNCH AUDIT — byt&leg

**Dato:** 2026-07-07 · **Go-live:** i morgen · **Type:** Read-only end-to-end audit (ingen kodeændringer)
**Supabase-projekt:** `fhnizihpdensqfdpgcgn` (ACTIVE_HEALTHY) · **Stack:** Next.js 14 App Router · Supabase · Stripe · Shipmondo · Vercel

> Denne rapport er ren analyse. Der er ikke ændret kode. Alle fund er verificeret ved genlæsning af den citerede fil/linje. Prioritering: penge → data → sikkerhed på dag 1.

---

## 1. Executive summary

**Vurdering: IKKE klar til go-live endnu — men tæt på.** Kodebasen er moden, gennemtænkt og har markant flere sikkerhedsforanstaltninger end forventet (fail-closed webhooks, idempotente betalinger, atomisk wallet, deltager-scopet RLS på beskeder, server-side prisvalidering). Applikationslogikken er solid.

De blokerende problemer handler **ikke** om buggy kode, men om **miljøkonfiguration ved prod-skiftet** — og de er farlige, fordi flere af dem **fejler stille**: systemet fortsætter tilsyneladende, men tager imod rigtige penge uden at levere en rigtig ydelse.

De tre vigtigste risici på dag 1:

1. **Shipmondo kan køre i mock-mode i produktion uden at nogen opdager det.** Mangler `SHIPMONDO_API_USER`/`SHIPMONDO_API_KEY`, bookes ingen rigtige pakker — kunden betaler via Stripe, men får en fake tracking-URL og ingen label. (BLOCKER 1)
2. **Service-role-nøglen falder stille tilbage til anon-nøglen.** Uden `SUPABASE_SERVICE_ROLE_KEY` degraderer alle betalings-, webhook-, wallet- og admin-routes. (BLOCKER 2)
3. **Stripe skal skiftes til live inkl. et nyt webhook-secret**, ellers går ingen betaling igennem — eller værre: den går igennem i testmode. (BLOCKER 3)

Dertil et data-blocker: **admin-rækken og reference-data må ikke ryge med i testdata-sletningen** (BLOCKER 4/5), ellers fryser hele godkendelses-flowet.

Når blockers i §2 og skift-listen i §3 er håndteret og verificeret, vurderes platformen klar.

---

## 2. BLOCKERS (skal fixes/verificeres før go-live)

### BLOCKER 1 — Shipmondo falder stille tilbage til MOCK i produktion
**Fil:** `lib/shipmondo/client.js:9` · også `app/api/shipping/pickup-points/route.js:7` og `pickup-points-all/route.js:12`
```js
const IS_MOCK = (!API_USER || !API_KEY) || process.env.SHIPMONDO_MOCK === 'true';
```
**Problem:** Hvis `SHIPMONDO_API_USER` eller `SHIPMONDO_API_KEY` ikke er sat i Vercel (eller `SHIPMONDO_MOCK=true` er glemt), kører hele forsendelsesmotoren i mock. `createShipment()` (`client.js:203-211`) returnerer så et falsk `MOCK-…`-shipment-id, `tracking_url` peger på en tilfældig PostNord-URL, og `label_pdf_url` er `null`.
**Konsekvens (dag 1, penge+data):** Køber gennemfører en **ægte Stripe-betaling**, `finalizePurchase` markerer varen solgt og sender "du har solgt"-mails — men **ingen fysisk pakke er booket**, sælger har ingen label, og køber får en død tracking-URL. Fejlen er tavs: intet i UI'et afslører mock-mode.
**Anbefalet fix:** Verificér i Vercel at `SHIPMONDO_API_USER` + `SHIPMONDO_API_KEY` er sat til **prod-credentials**, at `SHIPMONDO_MOCK` **ikke** er `true`, og at `SHIPMONDO_TEST_MODE` **ikke** er `true` (se BLOCKER 3-note). Overvej som opfølgning at logge en tydelig advarsel ved opstart hvis `IS_MOCK` er sandt i prod-miljø.

### BLOCKER 2 — Service-role-nøgle falder stille tilbage til anon-nøgle
**Fil:** `lib/supabase-server.js:10-13` (og samme mønster i `app/api/support-chat/route.js:16`, `support-chat/upload/route.js:8`)
```js
if (!SERVICE_KEY) { console.warn('… falder tilbage til anon key. RLS bypasses ikke.'); }
return createClient(SUPA_URL, SERVICE_KEY || ANON_KEY, …);
```
**Problem:** Mangler `SUPABASE_SERVICE_ROLE_KEY`, bruges anon-nøglen. Så bliver **alle** service-role-afhængige flows ramt af RLS: `finalizePurchase`/webhooks kan ikke opdatere ordrer, `wallet_credit`/`wallet_debit` er `REVOKE`'t fra anon (migration `20260707_security_advisor_hardening.sql`) og fejler, admin-routes kan ikke læse på tværs, labels kan ikke uploades.
**Konsekvens (dag 1, penge+data):** Betalinger trækkes hos Stripe, men ordre-finalisering, wallet-kreditering og fulfillment fejler → penge modtaget uden modydelse, inkonsistent state.
**Anbefalet fix:** Bekræft at `SUPABASE_SERVICE_ROLE_KEY` er sat i Vercel prod. (Nøglen skifter **ikke** ved go-live — projektet er allerede prod — men den er kritisk og skal være til stede.)

### BLOCKER 3 — Stripe skal skiftes til live + nyt webhook-secret
**Filer:** `app/api/payments/create-intent/route.js:12`, `payments/finalize/route.js:36-39`, `webhooks/stripe/route.js:15-36`, `app/betaling/[orderId]/page.js:8`
**Problem/skift:** Tre nøgler skal skifte fra test til live, og webhook-secret'et skal **regenereres** for det nye live-endpoint:
- `STRIPE_SECRET_KEY` → `sk_live_…`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_…`
- `STRIPE_WEBHOOK_SECRET` → **nyt** `whsec_…` fra en **live**-mode webhook oprettet i Stripe-dashboardet (peger på `https://bytogleg.dk/api/webhooks/stripe`).
**Konsekvens:** Behold man test-nøgler, sker betalinger i testmode (ingen rigtige penge, men "virker" i demo → falsk tryghed). Skifter man secret-nøglen til live men glemmer webhook-secret, afvises alle webhooks med "Ugyldig signatur" (`route.js:37-39`) → ordrer forbliver `pending` (klient-fallback `finalize` redder de fleste, men ikke `charge.refunded`/`payment_failed`-events).
**Anbefalet fix:** Skift alle tre; opret live-webhook i Stripe med events `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`; kopiér det nye signing-secret til `STRIPE_WEBHOOK_SECRET`. Verificér med en 1-krones live-testhandel.

### BLOCKER 4 — Admin-rækken må ikke slettes med testdata
**Fil:** `supabase/migrations/20260610_admin_system.sql:14-18` · verificeret i DB: `admins`-tabellen har **1 række**.
**Problem:** Adgang til admin styres udelukkende af `admins`-tabellen (`lib/admin.js`, `checkIsAdmin`). Policyen `admin_service_only_write` er `USING (false)` — admins kan **kun** oprettes via SQL-editor/service-role. Godkendelse af nye institutioner (`admin-approve-institution/route.js`) kræver en admin.
**Konsekvens (dag 1, drift):** Ryger admin-rækken (eller den tilhørende `auth.users`-konto) med i "alt testdata slettes", kan **ingen** godkende institutioner. Alle nye signups sidder fast på `/afventer-godkendelse`, og `is_approved=false` blokerer køb (`create-intent:74`), tilbud (`offers_insert`-policy) og opslag-aktivering → **platformen er frosset**.
**Anbefalet fix:** Bekræft eksplicit at den rigtige admin-`auth.users`-konto **og** dens `admins`-række bevares gennem sletningen. Hav en verificeret backup-plan (SQL til at genindsætte admin) klar.

### BLOCKER 5 — Reference-/konfig-data må ikke behandles som testdata
**Verificeret i DB:** `co2_emission_factors` = 20 rækker, `co2_methodology_versions` = 2, `document_counters` = 0.
**Problem:** Disse er **konfiguration**, ikke testdata. CO2-beregneren (`lib/co2/calculator.js`) falder ganske vist tilbage til hardcodede v1.1-værdier hvis `co2_emission_factors` er tom, men admin-CO2-config-siden og metodeversionering går i stykker, og de viste tal ændrer sig.
**Konsekvens:** Ikke pengekritisk, men bæredygtigheds-tal (et kerne-salgsargument) bliver inkonsistente hvis rækkerne ryger.
**Anbefalet fix:** Undtag `co2_emission_factors`, `co2_methodology_versions` og `shipmondo_price_cache` fra sletningen. (`document_counters` og `wallet_accounts` auto-oprettes og er ligegyldige at tømme.)
**Note:** `shipmondo_price_cache` (20 rækker) læses aktuelt **ikke** af koden (kun nævnt i en kommentar i `client.js:95`) — så den er reelt harmløs at tømme; medtaget her for fuldstændighed.

### BLOCKER 6 — `CRON_SECRET` skal være sat, ellers kører ingen baggrundsjobs
**Filer:** `app/api/cron/*/route.js` (alle fire), fx `cancel-unshipped/route.js:18-20`
```js
if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return 401;
```
**Problem:** Fail-closed: uden `CRON_SECRET` returnerer alle fire cron-endpoints 401, og Vercel Cron (`vercel.json`) kan ikke autentificere.
**Konsekvens (dag 1+):** Ingen refundering af ubetalte/ikke-afsendte ordrer (`cancel-unshipped`), ingen fragtfakturering (`generate-shipping-invoices`, kører 1. i måneden), ingen byttedeadline-oprydning (`sweep-swap-deadlines`), ingen lukning af døde support-samtaler. Ordrer med reserveret wallet-saldo frigives aldrig.
**Anbefalet fix:** Sæt `CRON_SECRET` i Vercel prod (Vercel sender den automatisk som `Authorization: Bearer` til cron-ruter). Verificér med et manuelt kald.

---

## 3. Skift-liste til i morgen (test → prod, fil for fil)

Alle værdier er miljøvariabler i Vercel (og Supabase Edge Function-secrets, hvor nævnt). Koden læser dem med fornuftige defaults — **defaults skjuler manglende opsætning**, så tjek hver enkelt aktivt.

| # | Env-variabel | Bruges i (fil:linje) | Nuværende/test | Skal være i prod |
|---|---|---|---|---|
| 1 | `STRIPE_SECRET_KEY` | `payments/create-intent:12`, `webhooks/stripe:15` | `sk_test_…` | `sk_live_…` |
| 2 | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `app/betaling/[orderId]/page.js:8` | `pk_test_…` | `pk_live_…` |
| 3 | `STRIPE_WEBHOOK_SECRET` | `webhooks/stripe:29` | test-`whsec_…` | **nyt** live-`whsec_…` (nyt endpoint) |
| 4 | `SHIPMONDO_API_USER` | `lib/shipmondo/client.js:7` | evt. tom → **mock** | prod-brugernavn |
| 5 | `SHIPMONDO_API_KEY` | `lib/shipmondo/client.js:8` | evt. tom → **mock** | prod-nøgle |
| 6 | `SHIPMONDO_BASE_URL` | `lib/shipmondo/client.js:6` | evt. `sandbox.shipmondo.com` | **unset** (default = `app.shipmondo.com`) el. prod-URL |
| 7 | `SHIPMONDO_MOCK` | `lib/shipmondo/client.js:9` | evt. `true` | **unset** / ikke `true` |
| 8 | `SHIPMONDO_TEST_MODE` | `lib/shipmondo/client.js:215-217` | evt. `true` | **unset** / ikke `true` (ellers bookes shipments med `test_mode:true`) |
| 9 | `SHIPMONDO_WEBHOOK_SECRET` | `webhooks/shipmondo:12-18` | evt. tom | prod-secret (fail-closed: tom → 500) |
| 10 | `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase-server.js:4` | skal være sat | prod service-role (uændret projekt) |
| 11 | `CRON_SECRET` | alle `cron/*` | evt. tom → cron 401 | tilfældig, stærk værdi |
| 12 | `RESEND_API_KEY` | ~34 steder (mails) | test/tom | prod-nøgle, verificeret afsender-domæne `bytogleg.dk` |
| 13 | `GROQ_API_KEY` | `lib/vision.js`, `support-chat` | test/tom | prod-nøgle (AI-scan + support-bot) |
| 14 | `ANTHROPIC_API_KEY` | **Edge Function** `analyze-image/index.ts:16` | Supabase secret | prod-nøgle (sæt som Supabase Edge Function-secret) |
| 15 | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL` | `lib/push.js`, `AppProvider.js:19` | evt. tom | prod-VAPID-nøglepar (ellers ingen push) |
| 16 | `NEXT_PUBLIC_BASE_URL` | ~15 steder (mail-links, labels) | evt. localhost/preview | `https://bytogleg.dk` |
| 17 | `ADMIN_NOTIFICATION_EMAIL` **og** `ADMIN_NOTIFY_EMAIL` | `notify-new-institution:19` hhv. `wallet/withdraw:75` | evt. tom | **begge** sat (se HIGH-4: to forskellige navne) |
| 18 | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | overalt + hardcodet i `next.config.js` CSP | prod-projekt | uændret (samme projekt), men se MEDIUM-6 |
| 19 | `BYTLEG_*` (CVR/VAT/navn/adresse) | `lib/issuer.js:4-12` | har korrekte defaults | verificér defaults er korrekte (CVR 35058486) |
| 20 | `VISION_MODEL` | `lib/vision.js:11` | default `qwen/qwen3.6-27b` | valgfri; verificér modellen er live hos Groq |

**Ekstra tjek (ikke env, men prod-skift):**
- Opret **Shipmondo prod-webhook** → `https://bytogleg.dk/api/webhooks/shipmondo` med samme HMAC-secret som #9.
- Verificér **Supabase Auth**: redirect-URLs peger på `bytogleg.dk`, e-mail-templates er prod, og "Leaked password protection" bør slås til (advisor WARN, se LOW).
- Deploy begge **Edge Functions** (`analyze-image`, `embed`) til prod-projektet.

---

## 4. HIGH (bør fixes hurtigst muligt efter launch)

**HIGH-1 — `seller-orders` og `mine-ordrer` henter kun 200 nyeste ordrer platform-bredt og filtrerer i JS.**
`app/api/seller-orders/route.js:21-36` henter `orders … .limit(200)` **uden** sælger-filter i queryen og filtrerer derefter `order_groups` i JavaScript. Samme mønster i `app/mine-opgaver/page.js`. Når platformen vokser forbi 200 samlede aktive ordrer, vil en sælgers ældre ordrer **forsvinde fra listen**. Konsekvens: sælgere kan gå glip af ordrer de skal sende. Fix: filtrér i SQL på `sellerInstitutionId` (fx via en indekseret kolonne eller RPC) og paginér.

**HIGH-2 — Uautentificeret billed-upload via service-role (`support-chat/upload`).**
`app/api/support-chat/upload/route.js` tillader **anonyme** besøgende at uploade op til 8 MB til `chat-images`-bucket'en via service-role, uden rate limiting og med offentlig URL retur. MIME/størrelse valideres, men der er intet loft på antal. Misbrugsvektor: gratis fil-hosting / storage-oppustning. Fix: rate limiting pr. IP/session + evt. kortere levetid / oprydning af `support/anon/*`.

**HIGH-3 — `transaction_co2_savings` INSERT er `WITH CHECK (true)` for `authenticated`.**
Verificeret i pg_policies + advisor (`insert_own_savings`). Enhver indlogget bruger kan `POST /rest/v1/transaction_co2_savings` og indsætte vilkårlige CO2-rækker; `public_read_total` (anon, `USING true`) summerer dem til de offentlige tal. Konsekvens: greenwashing-/data-integritetsrisiko på et kerne-salgsargument. CO2 skrives i praksis altid server-side (`persistTransactionCO2`, service-role), så policyen kan strammes til `false` eller til ejerskab.

**HIGH-4 — To forskellige env-navne for admin-notifikationsmail.**
`notify-new-institution/route.js:19` bruger `ADMIN_NOTIFICATION_EMAIL`; `wallet/withdraw/route.js:75` bruger `ADMIN_NOTIFY_EMAIL`. Sættes kun den ene, ryger enten "ny institution"- eller "ny udbetalingsanmodning"-mails til en hardcodet default (`admin@bytogleg.dk` / `kontakt@bytogleg.dk`). Konsekvens: admin overser tavst enten godkendelser eller udbetalinger. Fix: konsolidér til ét navn (eller sæt begge).

**HIGH-5 — SECURITY DEFINER-funktioner eksekverbare af `anon`/`authenticated` via RPC.**
Advisor (0028/0029) flager bl.a. `institution_email_exists`, `user_in_institution`, `user_institution_approved`, `conv_is_participant`, `match_listings`, `bump_conv_unread`. Særligt `institution_email_exists` giver **konto-enumerering** for uindloggede (bekræft/afkræft om en e-mail er registreret). De øvrige er policy-hjælpere der ikke bør kaldes direkte. Fix: `REVOKE EXECUTE … FROM anon, authenticated` på dem der kun bruges internt i policies (mønster findes allerede i `20260707_security_advisor_hardening.sql` for wallet-funktionerne).

---

## 5. MEDIUM / LOW

**MEDIUM-1 — Anon/spam INSERT-policies.** `feedback.insert_feedback` og `listing_reports.listing_reports_insert` er begge `WITH CHECK (true)` (advisor 0024). Uautentificeret spam kan fylde tabellerne. Overvej rate limiting eller `auth.uid() IS NOT NULL`.

**MEDIUM-2 — `listing_favorites.read_all_favorites` = `USING (true)` for `authenticated`.** Enhver indlogget bruger kan læse *alle* favoritter (hvem har favoritmarkeret hvad). Der findes samtidig to overlappende ejer-policies (`manage_own_favorites` + `users_can_manage_own_favorites`) — dobbeltdefinition der bør konsolideres. Mindre privatlivslæk.

**MEDIUM-3 — `institutions_public` view er SECURITY DEFINER (advisor ERROR 0010).** Bevidst brugt til offentligt kort/profiler (omgår RLS, men er bygget uden bank-kolonner, jf. `20260612_security_rls_fixes.sql`). Ikke et akut læk, men bør gennemgås — SECURITY DEFINER-views bør normalt undgås.

**MEDIUM-4 — CVR-lookup er åben og uden rate limiting.** `app/api/cvr-lookup/route.js` proxier `cvrapi.dk` uden auth. Kan misbruges som gratis proxy og ramme cvrapi's rate limits. Overvej auth eller throttling.

**MEDIUM-5 — Offer-accept TOCTOU.** `app/api/offers/respond/route.js:98` sætter `status='accepted'` med kun `.eq('id', offer.id)` (statustjekket sker læse-tid tidligere, linje 27). To samtidige accepts kan begge passere. Lav sandsynlighed (én sælger), men reservationen bør sættes atomisk (`.eq('status','pending')` i UPDATE).

**MEDIUM-6 — Supabase-projekt-ref er hardcodet i `next.config.js`** (CSP `img-src`/`connect-src` + `images.remotePatterns`) og i `public/…`. Skifter projektet nogensinde, brydes billeder/CSP tavst. Ikke et go-live-skift (samme projekt), men noter afhængigheden.

**LOW-1 — Legacy-prototype i repo-roden.** `index.html` (gammel "LegetøjsByt"-branding) indeholder en committet **anon**-Supabase-nøgle (`index.html:80`) og loader eksterne CDN-scripts. Anon-nøgler er offentlige by design, og filen serveres ikke af Next.js (ligger ikke i `public/`), men filen + `project/`-mappen bør fjernes fra repoet for at undgå forvirring.

**LOW-2 — Leaked password protection er slået fra** (Supabase Auth advisor). Slå HaveIBeenPwned-tjek til i Auth-indstillinger.

**LOW-3 — Test-/hjælpe-endpoints i prod.** `app/api/push-test/route.js` (kun `requireAuth`) er et test-endpoint der kan fjernes. Scripts `scripts/create-test-order.mjs` og `scripts/test-shipmondo-sandbox.mjs` er dev-only (kører kun manuelt mod `.env.local`) — harmløse, men ryd op.

**LOW-4 — `function_search_path_mutable` på `set_updated_at`** og **`vector`-extension i `public`-skema** (advisor WARN). Kosmetisk hærdning; ingen umiddelbar risiko.

**LOW-5 — CSP tillader `'unsafe-inline'` og `'unsafe-eval'` i `script-src`** (`next.config.js`). Nødvendigt for nuværende inline-styling/Babel-mønstre, men svækker XSS-forsvaret. Langsigtet oprydning.

---

## 6. Workflow-gennemgang (status pr. flow)

| Flow | Status | Bemærkning |
|------|--------|-----------|
| **Institution/CVR-onboarding** | ⚠️ Betinget OK | `signup-institution` (service-role, verificerer auth-bruger matcher e-mail) → `is_approved=false` → `/afventer-godkendelse` → admin godkender. **Afhænger af BLOCKER 4** (admin skal findes). Godt: robust idempotens + serverbekræftelse. |
| **Opret/redigér/slet annonce** | ✅ OK | RLS: `Owner inserts/updates/deletes listing` (+ approval-gate via `user_institution_approved()`). Admin-override findes. AI-scan-flow validerer kategori/underkategori server-side. |
| **Køb-flow** | ✅ OK | `create-intent`: alle priser hentes autoritativt fra DB, aldrig fra klient; reservation håndhæves; egne opslag blokeret; køber-institution verificeret. Solid. |
| **Bud/tilbud (offers)** | ✅ OK | Server-side dagsloft, reservation, "kan ikke svare på eget tilbud", supersede af tidligere bud. Mindre TOCTOU (MEDIUM-5). |
| **Byt/escrow (swap_proposals)** | ✅ OK (kompleks) | Escrow pr. part, idempotent claim (`pending→paid`), retry-sikker færdiggørelse (`escrow_status`-guard), shipment-id'er persisteres før completion → ingen dobbelt-booking. Kontant-mellemlag idempotent via `cash_settled`-claim. Meget gennemtænkt. |
| **Betaling & validering** | ⚠️ Afhænger af §2 | `finalizePurchase` idempotent (atomisk claim), dobbelt-vej (webhook + klient-`finalize`). **Afhænger af BLOCKER 2+3.** |
| **Chat & notifikationer** | ✅ OK | Deltager-scopet RLS (`conv_is_participant`, SECURITY DEFINER), ingen sender-spoofing, e-mail escapes input (`escapeHtml`). Notifikations-INSERT lukket for klienter (`20260707`). |
| **Kort/map** | ✅ OK | Offentlige data via `institutions_public`-view (uden bank-felter). Se MEDIUM-3. |
| **AI-moderation (billeder/indhold)** | ✅ OK | `scan-toy` (Groq) og Edge `analyze-image` (Claude Haiku) markerer `has_person`/`needs_review`; begge fail-safe (returnerer neutralt ved fejl). Kræver `GROQ_API_KEY`/`ANTHROPIC_API_KEY` i prod (skift-liste #13/#14). |
| **Admin-workflows** | ✅ OK | Alle 13 admin-routes verificeret med `requireAuth` **og** eksplicit `admins`-tjek (service-role). Ingen manglende admin-gate fundet. |
| **CO2-/impact-beregning** | ✅ OK | Server-side, idempotent pr. transaktion; falder tilbage til hardcodede faktorer hvis DB-config mangler (se BLOCKER 5). |
| **Forsendelse/labels** | ⚠️ Afhænger af BLOCKER 1 | Logikken er korrekt; mock-fallback er den eneste risiko. Labels i **privat** bucket med autoriseret route (`/api/shipping/label/[id]`, admin-gated). |
| **Wallet/udbetaling** | ✅ OK | Atomiske `wallet_credit`/`wallet_debit` (ræk-lås, kan ikke overtrække), append-only ledger, `REVOKE` fra anon/authenticated (`20260707`), tilbagerulning ved fejl. Stærkt. |

**Fejlhåndtering/robusthed generelt:** God. Webhooks er fail-closed, betalinger idempotente, netværksfejl mod Shipmondo "fail closed" ved checkout (`create-intent:250` blokerer hellere end at opkræve for lidt). Frontend har eksplicitte tomme-tilstande ("Ingen opslag fundet" osv.), så en tom database efter sletning bryder **ikke** UI'et. Ingen `console.log` med hemmeligheder fundet. Kun ét `dangerouslySetInnerHTML` (`app/layout.js:20`, statisk CSS — sikkert).

---

## 7. RLS/sikkerhedsmatrix (effektive policies pr. tabel, verificeret i prod-DB)

Legende: 🟢 korrekt · 🟡 opmærksomhedspunkt · �admin = admin-override findes · svc = skrives kun via service-role.

| Tabel | SELECT | INSERT | UPDATE/DELETE | Vurdering |
|-------|--------|--------|----------------|-----------|
| `institutions` | ejer/leder/medlem/admin | auth'd | ejer/leder/medlem + admin | 🟢 bank-felter kun egen institution |
| `institutions_public` (view) | anon (uden bank) | — | — | 🟡 SECURITY DEFINER (MEDIUM-3) |
| `listings` | 🟢 public read | ejer + godkendt | ejer + admin | 🟢 |
| `shipping_options` | public read | ejer (via listing) | ejer | 🟢 |
| `conversations` | deltager (`conv_is_participant`) | deltager/admin | deltager | 🟢 |
| `chat_messages` | deltager (via samtale) | deltager, ingen spoofing | deltager | 🟢 |
| `offers` | køber/sælger-inst | køber-inst + godkendt | køber/sælger-inst | 🟢 |
| `swap_proposals` | begge inst | initiator + godkendt | begge inst | 🟢 |
| `orders` | køber (`buyer_id`) + admin | svc | admin | 🟢 sælger ser via service-role-route |
| `shipments` | køber-inst/sælger-inst/admin | svc | admin | 🟢 |
| `shipping_invoices` / `_lines` | institution + admin | svc | admin | 🟢 |
| `wallet_accounts` / `wallet_ledger` | egen institution | svc (RPC, REVOKE'd) | svc | 🟢 append-only |
| `payouts` | egen institution | svc | svc/admin | 🟢 |
| `notifications` | egen institution/navn + admin | **ingen** (lukket) | egen institution | 🟢 (`20260707`) |
| `institution_members` | egen e-mail / inst | ejer/leder/inst-admin | do. | 🟢 |
| `institution_invitations` | ejer/leder/inst-admin | do. | do. | 🟢 (`20260707`, tidligere `USING(true)`) |
| `admins` | kun egen række | svc (false) | svc (false) | 🟢 |
| `admin_audit_log` | admin | admin | — | 🟢 |
| `support_conversations`/`_messages` | ejer + admin | svc (kap.-token=UUID) | admin | 🟡 UUID som capability (upload uautentificeret, HIGH-2) |
| `saved_searches` | egen e-mail | egen e-mail | egen e-mail | 🟢 |
| `listing_shares` | modtager/afsender | auth'd | modtager | 🟢 |
| `consent_log` | egen inst + admin | auth'd | — | 🟢 |
| `listing_favorites` | 🟡 **alle** (auth'd) | ejer | ejer | 🟡 MEDIUM-2 (læk + dobbelt policy) |
| `feedback` | admin | 🟡 **anon** (`true`) | admin | 🟡 MEDIUM-1 (spam) |
| `listing_reports` | admin | 🟡 **anon** (`true`) | admin | 🟡 MEDIUM-1 (spam) |
| `transaction_co2_savings` | anon total + auth'd | 🟡 **`true`** (auth'd) | — | 🟡 HIGH-3 (integritet) |
| `transaction_reviews` | 🟢 public read | auth'd | admin | 🟢 |
| `bids` (legacy) | public read | auth'd | — | 🟢 |
| `scan_rejection_logs` / `ai_scan_logs` | admin | auth'd (`true`) | admin | 🟡 log-spam, lav risiko |
| `co2_emission_factors` / `_methodology_versions` | public read | admin | admin | 🟢 |
| `data_export_log` / `document_counters` | — (deny-all) | svc | svc | 🟢 kun service-role |
| **storage: `chat-images`** | (public CDN) | authenticated | authenticated delete | 🟡 list-enumerering lukket (`20260707`); anon upload via route (HIGH-2) |
| **storage: `listing-images`** | (public CDN) | insert | delete | 🟢 list-enumerering lukket |
| **storage: `shipping-labels`** | privat (`20260707`) | svc | — | 🟢 autoriseret route + signed URL |
| **storage: `feedback-screenshots`** | privat (`20260707`) | auth'd | — | 🟢 admin-route til visning |

**Samlet RLS-vurdering:** Modent og gennemarbejdet. De permissive `WITH CHECK (true)`-INSERTs (HIGH-3, MEDIUM-1) og `listing_favorites`-SELECT (MEDIUM-2) er de eneste reelle policy-svagheder — ingen af dem er pengekritiske, men HIGH-3 bør lukkes hurtigt. Kritiske skrivestier (wallet, notifications, invitations, labels) er allerede hærdet i migrationerne fra 15.–07.

---

## Prioriteret to-do før go-live (kort)
1. **Sæt/verificér alle env-variabler i §3** — særligt Shipmondo (#4-9), Stripe (#1-3), service-role (#10), CRON_SECRET (#11).
2. **Bekræft admin-række + reference-data overlever sletningen** (BLOCKER 4/5).
3. **Opret live Stripe- + prod Shipmondo-webhooks** med nye secrets.
4. **Røgtest efter skift:** én 1-krones live-handel hele vejen (køb → betaling → label → mails → levering-webhook), og bekræft at der bookes en *rigtig* Shipmondo-forsendelse (ikke `MOCK-…`).
5. Planlæg HIGH-1..5 til umiddelbart efter launch.
