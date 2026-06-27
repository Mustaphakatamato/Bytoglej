# Opgave: End-to-end readiness-review før onboarding af ægte institutioner

**Status:** Ikke startet (oprettet 2026-06-26)
**Formål:** Afgøre om byt&leg er klar til at onboarde rigtige institutioner — at platformen kan klare det, og at alt virker som det skal.

---

## Hvad jeg (Claude) skal gøre

Lav en **fuld end-to-end vurdering** af platformen og svar konkret på: *"Er jeg klar til at onboarde ægte institutioner?"*

For hvert problem jeg finder skal det klassificeres:
- 🛑 **SHOW-STOPPER** — må IKKE onboarde før det er fikset (datalæk mellem institutioner, tabt betaling, GDPR-brud, nedbrud i kerneflow).
- 🔴 **KRITISK** — bør fikses meget hurtigt, men ikke nødvendigvis blokerende for en lille, overvåget pilot.
- 🟡 **BØR FIKSES** — vigtigt men kan vente.
- 🟢 **OK / observation** — fint, eller mindre nice-to-have.

Til sidst: en **samlet go/no-go-vurdering** med begrundelse.

**Vigtigste regel (fra CLAUDE.md): Gæt aldrig.** Hvis noget ikke kan verificeres i kode/DB, sig det eksplicit i stedet for at antage.

---

## Områder der skal gennemgås

1. **Auth & dataisolation (GDPR-kritisk)**
   - Supabase RLS-policies på ALLE tabeller — kan én institution se/redigere en andens data (opslag, beskeder, ordrer, institutioner, medarbejdere)?
   - Kør Supabase security-advisors (MCP: `get_advisors`, project_id `fhnizihpdensqfdpgcgn`, type `security`) — vær OBS: tidligere forsøg på dette tool-kald blev afvist af brugeren; spørg/bekræft før kald, eller verificér RLS via `execute_sql`/`list_tables` i stedet.
   - Godkendelsesflow for nye institutioner (`afventer-godkendelse`, `admin-approve-institution`, `notify-new-institution`).

2. **API-routes (59 stk i `app/api/`)**
   - Tjek auth på hver route: bruger den service_role-key uden at verificere kalderens identitet/rolle? Især `app/api/admin/*` — er admin-tjek håndhævet server-side?
   - Manglende input-validering, IDOR (kan man tilgå andres ordrer/samtaler via ID?).

3. **Betaling (Stripe)**
   - `app/api/webhooks/stripe/route.js` — verificeres webhook-signatur? Idempotens?
   - `payments/create-intent`, `create-swap-intent`, `betaling/[orderId]` — beløb beregnet server-side (ikke fra klient)?
   - Hvad sker der hvis betaling lykkes men efterfølgende DB-skrivning fejler?

4. **Forsendelse (Shipmondo)**
   - `book-shipment`, `webhooks/shipmondo`, `shipping/*` — fejlhåndtering, label_format-fælden (se memory `shipmondo-api-facts`).
   - Cron `generate-shipping-invoices`.

5. **GDPR & juridisk**
   - `gdpr/export`, `gdpr/consent` — virker dataeksport? Samtykke logget?
   - Privatlivspolitik, vilkår, handelsbetingelser til stede og udfyldt?
   - PNR/CVR-håndtering (`cvr-lookup`, `migrate_pnr.sql`).

6. **Kerneflows (manuelt/logisk gennemspil)**
   - Signup → afventer godkendelse → godkendt → opret opslag → køb/byt → betaling → forsendelse → modtaget.
   - Bytteflow (`swaps/*`, `bytte-betaling`), bud/tilbud (`offers/*`).
   - Beskeder + support-chat (AI-bot + menneske-overdragelse, se memory `support-chat`).

7. **Build & drift**
   - Kører `npm run build` rent? (kald evt. som baggrundsjob — kan tage tid).
   - Miljøvariabler: `.env.local` indeholder KUN Supabase + Shipmondo. Stripe/Resend/Groq/Gemini-nøgler mangler lokalt — verificér at de er sat i Vercel (ellers fejler betaling/mails/AI i prod). Lav en liste over ALLE `process.env.*` der bruges i koden vs. hvad der er konfigureret.
   - Cron-jobs i `vercel.json` — er de sat op korrekt?
   - Error boundaries (`app/error.js`, `not-found.js`).

8. **Realtime**
   - Hvilke tabeller har realtime-publikation (se memory `realtime-publication`) — mangler nogen, så UI kræver genindlæsning?

9. **Seed/test-data**
   - Er der dummy/test-opslag i prod-DB der skal ryddes før ægte brugere? (`seed_*.sql`, memory `seed-listings-user-id`).

---

## Nyttig kontekst (allerede verificeret i denne session)

- Stack: Next.js 14 App Router, Supabase (Postgres 17, projekt `fhnizihpdensqfdpgcgn`, region eu-west-1, ACTIVE_HEALTHY), Stripe, Shipmondo API v3, Resend (mail), Groq + Google Gemini (AI), web-push. Deploy på Vercel.
- **Ingen hardcodede secrets** fundet i `app/`, `components/`, `lib/` — alt går via `process.env`. ✅
- `.gitignore` dækker `.env.local`, `.next/`, `.claude/`, `test-label.pdf` — ingen env-filer trackes i git. ✅
- 59 API-routes under `app/api/`.
- Relevante memory-filer at læse først: `support-chat`, `shipmondo-api-facts`, `realtime-publication`, `ai-image-search`, `seed-listings-user-id`.
- Specialistagenter findes i `agents/agent-01..13-*.md` — læs den relevante ved tvivl (fx agent-04 betaling, agent-06 GDPR, agent-01 arkitektur).
- `TESTPLAN.md` i roden findes allerede — brug den som tjekliste-input.

## Fremgangsmåde
- Brug gerne parallelle subagenter (Explore/general-purpose) pr. domæne for at gå hurtigt og bredt, men verificér selv de højeste-risiko-fund (RLS, Stripe-webhook, admin-auth) i koden.
- Levér til sidst én samlet rapport med klassificerede fund + go/no-go.
