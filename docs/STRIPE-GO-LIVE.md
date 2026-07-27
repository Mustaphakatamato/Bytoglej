# Stripe: fra test-mode til live (produktion)

Koden indeholder ingen nøgler — hvilken tilstand byt&leg kører i afgøres **udelukkende**
af miljøvariablerne. At gå live er derfor: aktivér kontoen i Stripe, opret et live-webhook,
og skift nøglerne på Vercel. Denne fil er rækkefølgen.

> Punkterne i Stripe Dashboard og på Vercel kan **ikke** udføres fra kodebasen — de skal
> klikkes igennem manuelt. Kodeændringerne (guards, diagnostik) er allerede på plads.

---

## 0. Forudsætninger

- Stripe-kontoen er **aktiveret** (virksomhedsoplysninger, CVR, ejerforhold, bankkonto
  udfyldt og godkendt). Uden aktivering findes live-nøglerne ikke.
- Domænet `bytogleg.dk` peger på Vercel-produktionsdeploymentet.

---

## 1. Aktivér betalingsmetoder i live-mode

Stripe Dashboard → skift til **Live mode** (kontakten øverst) → **Settings → Payment methods**:

- [ ] **Kort** aktiveret
- [ ] **MobilePay** aktiveret — godkendes separat af Stripe og kan tage et par dage.
      Start denne først; den er typisk flaskehalsen.

Er MobilePay ikke aktiv endnu, går checkout **ikke** i stå: `lib/stripe.js` opdager fejlen
og opretter betalingen med kort alene, med en tydelig fejl i loggen. Så snart MobilePay er
godkendt, virker den af sig selv — ingen deploy nødvendig.

---

## 2. Opret live-webhook

Stripe Dashboard (Live mode) → **Developers → Webhooks → Add endpoint**:

- **Endpoint URL:** `https://bytogleg.dk/api/webhooks/stripe`
- **Events** (præcis de fire, som `app/api/webhooks/stripe/route.js` håndterer):
  - [ ] `payment_intent.succeeded`
  - [ ] `payment_intent.payment_failed`
  - [ ] `payment_intent.canceled`
  - [ ] `charge.refunded`
- Kopiér **Signing secret** (`whsec_…`) — det er et **andet** end i test-mode.

> Et live-endpoint kan ikke genbruge test-endpointets signing secret. Bruger man det gamle,
> afvises alle events med "Ugyldig webhook-signatur", og ordrer bliver hængende i `pending`.

---

## 3. Skift miljøvariabler på Vercel

Vercel → projektet → **Settings → Environment Variables**, scope **Production**:

| Variabel | Værdi i produktion |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_…` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` fra **live**-endpointet (trin 2) |

Regler:

- **Begge nøgler skal være samme mode.** Live secret + test publishable giver en betalingsside
  der ikke kan indlæse betalingen. Serveren afviser nu kombinationen med det samme.
- **Preview/Development beholder test-nøgler.** Guarden slår kun til på `VERCEL_ENV=production`,
  så preview-deployments kan fortsat køre med `sk_test_…`.
- `NEXT_PUBLIC_*` bages ind ved build → **redeploy** Production efter ændringen (ikke kun
  "restart"; en genudrulning af det eksisterende build er nok).

Under selve skiftet kan `STRIPE_WEBHOOK_SECRET` indeholde **flere** secrets adskilt af komma
(`whsec_live…,whsec_test…`). Webhooken prøver dem alle. Test-events kan ikke fuldføre rigtige
ordrer imens: kører serveren med live-nøgler, afvises events med `livemode: false`.

---

## 4. Ryd op i test-data før første rigtige handel

Test-ordrer i prod-databasen peger på PaymentIntents der **ikke findes** med live-nøglerne.
Konsekvens hvis de ligger og flyder:

- `pending`-test-ordrer bliver aldrig finaliseret (uskadeligt, men støjer).
- `paid`-test-ordrer med afsendelsesfrist ender i `cancel-unshipped`-cron'en, hvor
  refusionen fejler med "No such payment_intent" i loggen.

- [ ] Annullér/slet gamle test-ordrer (`orders` med status `pending`/`paid` fra testperioden)
- [ ] Fjern dummy-opslag og testinstitutioner (jf. `docs/READINESS-REVIEW-2026-07.md`, hul #3)

---

## 5. Verificér

- [ ] `GET /api/admin/stripe-status` som admin-bruger. Forventet svar:
      `ok: true`, `secret_key_mode: "live"`, `publishable_key_mode: "live"`,
      `keys_match: true`, `webhook_secrets_configured: 1`,
      `account.charges_enabled: true`, `account.payouts_enabled: true`, `problems: []`.
- [ ] Gennemfør **ét rigtigt køb** med et rigtigt kort (lille beløb) på `bytogleg.dk`:
      kurv → betaling → kvittering.
- [ ] Stripe Dashboard (Live) → betalingen er `Succeeded`.
- [ ] Webhook-endpointet viser `payment_intent.succeeded` med **200**.
- [ ] Ordren står som `paid` i Supabase, pakkemærkat er oprettet, købs- og sælgermail modtaget.
- [ ] Refundér testkøbet i Dashboard → ordren skifter til `refunded` (verificerer
      `charge.refunded`-eventet).

---

## 6. Rollback

Skift `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` og `STRIPE_WEBHOOK_SECRET`
tilbage til test-værdierne på Production og redeploy. Ordrer oprettet i live-mode kan derefter
ikke slås op med test-nøglerne — refundér dem i Stripe Dashboard (Live) før rollback.

Skal en produktions-deployment midlertidigt køre med test-nøgler (fx en generalprøve), sæt
`STRIPE_ALLOW_TEST_MODE_IN_PROD=true`. **Fjern den igen** — den slår hele guarden fra.

---

## Sådan hænger koden sammen

| Fil | Rolle |
|---|---|
| `lib/stripe.js` | Én Stripe-klient + guards: nøgle-mode, mismatch, test-i-prod, MobilePay-fallback |
| `app/api/payments/create-intent/route.js` | Opretter PaymentIntent for køb |
| `app/api/payments/create-swap-intent/route.js` | Opretter PaymentIntent for bytte/bundt-bytte |
| `app/api/webhooks/stripe/route.js` | Modtager events, verificerer signatur + livemode, fuldfører ordren |
| `app/api/payments/finalize/route.js` | Synkron fallback når køberen vender tilbage fra Stripe |
| `app/api/admin/stripe-status/route.js` | Admin-diagnostik (read-only) til at kvittere trin 5 |
