# CO₂-modul — Lanceringstjekliste

**Version:** 1.0  
**Dato:** 2026-05-30

---

## Forudsætninger

### Database (Supabase)

- [ ] Kør `CO2_SETUP.sql` i Supabase SQL Editor (én gang pr. miljø)
- [ ] Verificér at alle 20 rækker er insertet i `co2_emission_factors`
- [ ] Verificér at v1.0 er insertet i `co2_methodology_versions` og `active = true`
- [ ] Verificér at `conversations`-tabellen har kolonnerne `co2_net_saved_kg` og `co2_breakdown`
- [ ] Verificér RLS-politikker:
  - `co2_emission_factors`: public SELECT, kun admin INSERT/UPDATE
  - `transaction_co2_savings`: kun INSERT (ingen UPDATE eller DELETE!)
  - `co2_audit_log`: kun INSERT
- [ ] Test at anonymous brugere **ikke** kan INSERT til `co2_emission_factors`

### Kode

- [ ] `lib/co2/emission-factors.js` — alle 20 faktorer korrekte og matcher `CO2_SETUP.sql`
- [ ] `lib/co2/calculator.js` — konstanter matcher metodologi-side og dokumentation
- [ ] `lib/co2/geocoding.js` — DAWA og Nominatim-fallback virker
- [ ] `__tests__/co2-calculator.test.js` — alle tests passerer (`npx jest` eller `bun test`)

---

## Indhold og kommunikation

- [ ] Metode-siden er publiceret på `/baeredygtighed/metode`
- [ ] Metode-siden er linket fra alle CO₂-visninger (dashboard-widget, handelshistorik-badge, forsideboks)
- [ ] Sprog følger reglerne overalt:
  - Altid: "estimeret", "ca.", "≈", "kg CO₂e"
  - Aldrig: "sparer præcis", "garanteret", "uden CO₂"
  - CO₂-visning har altid link til metode-side
- [ ] Hverdagssammenligninger er aktive og giver mening (tjek `getCO2Comparison` i `lib/co2/calculator.js`)
- [ ] Forside-CO₂-boks viser korrekte summer eller "0 kg" hvis ingen data endnu

---

## Beregning

- [ ] Alle 20 emission-faktorer er valideret mod kilderne S1-S8 (se `/baeredygtighed/metode`)
- [ ] Beregning testet med kendte inputs (se test-suite):
  - `books`, 20 km → netSavedKg = 0 (transport > produktion)
  - `ride-on-toys`, 5 km → netSavedKg ≈ 15–16 kg
  - `children-furniture`, 10 km → netSavedKg ≈ 7.6 kg
- [ ] Netto-besparelse returnerer aldrig negativt tal
- [ ] Edge case: distanceKm = 0 → bruger 25 km default + `distanceEstimated = true`
- [ ] Edge case: ukendt kategori → falder tilbage til `other` (2.0 kg)
- [ ] Legacy-nøgler resolver korrekt (mobler → children-furniture, osv.)

---

## Versionering og historik

- [ ] Versioneringen virker — `transaction_co2_savings.methodology_version` sættes korrekt
- [ ] Historiske `transaction_co2_savings`-rækker ændres **aldrig** ved faktoreditering
- [ ] Verificér at der ikke eksisterer negative `net_saved_kg`-værdier i DB:
  ```sql
  SELECT COUNT(*) FROM transaction_co2_savings WHERE net_saved_kg < 0;
  -- skal returnere 0
  ```

---

## Admin-interface

- [ ] Admin-siden `/admin/co2-config` er tilgængelig for `mustaphakatamato@live.dk`
- [ ] Siden afviser andre brugere med "Ingen adgang"
- [ ] Faktortabel viser "AFVIGER"-badge når kode-konstant afviger fra DB-værdi
- [ ] "Foreslå opdatering" kræver begrundelse (tomt felt = blokeret)
- [ ] Audit log fanges alle ændringer med timestamp og begrundelse
- [ ] Metode-version kan aktiveres — kun én version er aktiv ad gangen
- [ ] Ny metode-version kan oprettes med nye konstanter

---

## Deal-flow integration

- [ ] `persistCO2Saving()` kaldes efter `deal_completed: true` i `MessagesClient.handleAcceptBid()`
- [ ] CO₂-beregning er **non-blocking** — fejl i persistering stopper ikke deal-flowet
- [ ] Koordinater caches på `institutions.latitude/longitude` efter første geocoding
- [ ] Test live deal-flow i staging og verificér at `transaction_co2_savings` får en ny række

---

## Anbefalede tests inden produktion

```bash
# Kør unit tests
npx jest __tests__/co2-calculator.test.js

# Verificér DB-setup
-- Kør i Supabase SQL Editor:
SELECT id, co2_kg_per_unit FROM co2_emission_factors ORDER BY id;
SELECT * FROM co2_methodology_versions;
SELECT COUNT(*) FROM transaction_co2_savings;
SELECT COUNT(*) FROM transaction_co2_savings WHERE net_saved_kg < 0; -- skal være 0
```

---

## Ekstern validering (anbefalet)

- [ ] Send metoden til review hos LCA-forsker (DTU eller AAU) inden bred markedsføring
- [ ] Verificér at displacement rate 0.6 er konsistent med nyeste litteratur (S3, S6, S7)
- [ ] Overvej at opdatere transportfaktor (0.170 kg/km) til dansk flådegennemsnit når data foreligger

---

## Kendte begrænsninger (v1.0) — skal kommunikeres

- Kun `byd`-deals (bud-accept) trigger CO₂-beregning
- `byt`-deals og direkte `køb`-aftaler tæller ikke endnu
- Transport-mode antages altid personbil
- Emballage og end-of-life er ikke inkluderet
- Displacement rate er estimeret, ikke målt på byt&leg-brugere specifikt

---

*Alle tjekpunkter skal være markeret inden CO₂-modulet promoveres aktivt over for brugere.*
