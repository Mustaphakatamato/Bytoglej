# Handover — fortsæt lokalt

Sidst opdateret: 2026-06-15. Genereret af Claude Code (cloud-session).

---

## Hvad er blevet bygget i denne session

### 1. Indstillingssiden (samlet hub)
`app/profil/rediger/page.js` er omskrevet til en Vinted-style indstillingsside med:
- Sidebar-navigation (desktop: 240px sticky kolonne, mobil: horizontal scroll pills)
- URL hash-navigation: `/profil/rediger#profil`, `#betaling`, `#fortrolighed` osv.
- Sektioner: Profiloplysninger, Betaling, Bundlerabatter, Notifikationer, Fortrolighed, Sikkerhed

### 2. "Indstillinger" i dropdown
`components/NavWrapper.js` — gear-ikon + "Indstillinger"-link tilføjet til profil-dropdown.

### 3. GDPR Fortrolighedsindstillinger (Fase 1 — DELVIST DEPLOYED)
Filer oprettet:
- `supabase/migrations/20260615_privacy_consent.sql` — **skal køres manuelt i Supabase SQL Editor**
- `app/api/gdpr/consent/route.js` — POST-endpoint til at registrere samtykke (audit trail)
- `app/api/gdpr/export/route.js` — GET-endpoint til GDPR-dataeksport (art. 15 & 20)
- `app/institution/[name]/page.js` — gater skjulte profiler bag "Profilen er ikke offentlig"-skærm

---

## Hvad mangler (TODOS)

### TODO 1 — KRITISK: Kør migration i Supabase
**Filen:** `supabase/migrations/20260615_privacy_consent.sql`

Gå til Supabase Dashboard → SQL Editor og kør indholdet af den fil.
Den tilføjer:
- `marketing_consent boolean NOT NULL DEFAULT false` på `institutions`
- `profile_public boolean NOT NULL DEFAULT true` på `institutions`
- Ny tabel `consent_log` (append-only audit trail, RLS uden policies = kun service role)

Uden denne migration vil Fortrolighed-toggles i indstillingerne fejle med en 500-fejl.

---

### TODO 2 — Søge-autocomplete lækker skjulte institutionsnavne

**Problemet:**
Søgebaren i NavWrapper viser institutionsnavne fra opslag (`listings.institution_name`).
Hvis en institution sætter `profile_public = false`, dukker deres navn stadig op i autocomplete-forslagene under "Institutioner".
Det er ikke et formelt GDPR-brud (CVR-data er offentligt), men det strider mod Privacy by Design (art. 25) og brugerens forventning.

**Filen:** `components/NavWrapper.js`

Søg efter denne blok (ca. linje 238–244):
```js
const instSeen = new Set();
for (const l of listings) {
  if (!instSeen.has(l.institution_name) && l.institution_name?.toLowerCase().includes(term)) {
    instSeen.add(l.institution_name);
    tryAdd(institutions, l.institution_name, `/institution/${encodeURIComponent(l.institution_name)}`);
  }
  if (institutions.length >= 3) break;
}
```

**Fix — to trin:**

**Trin A:** Tilføj en query i `providers/AppProvider.js` der henter skjulte institutionsnavne:
```js
// I AppProvider, et sted i loadUser() eller en separat useEffect:
const { data: hiddenInsts } = await db
  .from('institutions')
  .select('name')
  .eq('profile_public', false);
const hiddenInstNames = new Set((hiddenInsts || []).map(i => i.name));
// Gem i state og eksporter via AppContext
```

Tilføj `hiddenInstNames` til AppContext value-objektet.

**Trin B:** I SearchBar (NavWrapper.js), filtrer skjulte navne fra:
```js
// Øverst i SearchBar-funktionen, tilføj hiddenInstNames til destructuring:
const { listings: allListings, realUserId, institution, hiddenInstNames } = useApp();

// I autocomplete-løkken, skip skjulte institutioner:
for (const l of listings) {
  if (hiddenInstNames?.has(l.institution_name)) continue; // <-- tilføj denne linje
  if (!instSeen.has(l.institution_name) && l.institution_name?.toLowerCase().includes(term)) {
    ...
  }
}
```

**Vigtigt:** `hiddenInstNames` kræver at migration (TODO 1) er kørt først, da `profile_public`-kolonnen ikke eksisterer endnu.

---

### TODO 3 — Fremtid: Sletteflow (GDPR art. 17)
Institutioner skal kunne anmode om sletning af alle deres data.
Dette kræver:
- Juridisk afklaring: hvad kan/må slettes (fakturaer/ordrer kan have opbevaringspligt)
- En "Anmod om datasletning"-knap i Sikkerhed-sektionen på indstillingssiden
- En manuel behandlingsproces (ikke automatisk sletning) — kontakt Datatilsynet for vejledning

Deferred med vilje — implementér ikke uden juridisk review.

---

## Kommandoer til at fortsætte

```bash
# Sørg for at du er på main
git checkout main
git pull origin main

# Kør migration i Supabase SQL Editor (se TODO 1)

# Implementér TODO 2 (søge-autocomplete fix):
# 1. Rediger providers/AppProvider.js — tilføj hiddenInstNames query + context value
# 2. Rediger components/NavWrapper.js — filtrer i SearchBar

# Commit og push
git add -p
git commit -m "Filtrer skjulte institutioner fra søge-autocomplete (Privacy by Design)"
git push origin main
```

---

## Arkitektoniske konventioner (husk)
- Inline styles — ingen CSS-filer
- Konstanter fra `lib/constants.js` (PRIMARY, GREEN_TINT, INK, INK2, INK3, PAPER, PAPER2, PAPER3, FONT)
- `isMobile = useWindowWidth() < 768`
- API-routes: `requireAuth(req)` + `createServerClient()` (service role)
- Authed client-fetch: `authedFetch` fra `lib/authed-fetch.js`
- Ingen nye npm-pakker uden eksplicit godkendelse
