# CLAUDE.md — byt&leg

## Vigtigste regel
**Gæt aldrig.** Hvis du ikke kender svaret eller er usikker, sig "det ved jeg ikke." Det er altid bedre at indrømme usikkerhed end at give forkert information.

---

## Om projektet
byt&leg er en dansk B2B-markedsplads hvor institutioner (børnehaver, skoler, SFO'er) køber, sælger og bytter brugt legetøj. Platformen er bygget i Next.js 14, Supabase og deployes på Vercel.

---

## Specialistagenter
Når du har brug for dybere viden inden for et område, læs den relevante agent:

| Agent | Fil | Hvornår du skal læse den |
|-------|-----|--------------------------|
| Tech Arkitekten | `agents/agent-01-tech-arkitekten.md` | Arkitektur, database, deployment, Next.js/Supabase beslutninger |
| AI Feature-agenten | `agents/agent-02-ai-feature-agenten.md` | AI-funktioner, prompt engineering, modelvalg |
| PWA & Frontend-agenten | `agents/agent-03-pwa-frontend-agenten.md` | UI, mobiloplevelse, PWA, performance |
| Betalings- & EAN-specialisten | `agents/agent-04-betalings-ean-specialisten.md` | Stripe, EAN-fakturering, betalingsflow |
| Prisstrategirådgiveren | `agents/agent-05-prisstrategiraadgiveren.md` | Prissætning, forretningsmodel, pakker |
| GDPR & Juridisk rådgiveren | `agents/agent-06-gdpr-juridisk-raadgiveren.md` | GDPR, databehandling, handelsbetingelser |
| Udbuds- & Indkøbsrådgiveren | `agents/agent-07-udbuds-indkoebsraadgiveren.md` | Kommunale indkøb, udbud, godkendelsesprocesser |
| Logistik & Shipmondo-agenten | `agents/agent-08-logistik-shipmondo-agenten.md` | Forsendelse, Shipmondo API, labels, tracking |
| Support & Onboarding-agenten | `agents/agent-09-support-onboarding-agenten.md` | Brugerhjælp, onboarding, ikke-tekniske brugere |
| CO2 & Impact-agenten | `agents/agent-10-co2-impact-agenten.md` | Bæredygtighed, CO2-beregninger, impact-rapporter |
| Vækst & Go-to-market-agenten | `agents/agent-11-vaekst-go-to-market-agenten.md` | Vækststrategi, outreach, partnerskaber |
| Kommunikations- & Indholdsagenten | `agents/agent-12-kommunikations-indholdsagenten.md` | Tekster, mails, tone of voice, kampagner |
| Projektlederen | `agents/agent-13-projektlederen.md` | Prioritering, overblik, koordinering på tværs |

---

## Tech stack
- **Frontend**: Next.js 14 App Router, `'use client'` komponenter
- **Database**: Supabase (PostgreSQL + RLS)
- **Betaling**: Stripe (PaymentIntent)
- **Forsendelse**: Shipmondo API v3
- **Deployment**: Vercel
- **Miljøvariabler**: Aldrig i koden — kun i `.env.local` (lokalt) og Vercel (produktion)
