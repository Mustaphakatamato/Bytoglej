# CO₂-beregningsmodul — Teknisk dokumentation

**Metode-version:** 1.0  
**Implementeret:** 2026-05-30  
**Offentlig metode-side:** `/baeredygtighed/metode`

---

## Arkitektur-oversigt

```
lib/co2/
├── emission-factors.js   # Konstanter: CO2-faktorer + legacy mapping
└── calculator.js         # Beregningslogik, aggregering, sammenligning

CO2_SETUP.sql             # Supabase DDL for alle CO2-tabeller
app/baeredygtighed/
└── metode/page.js        # Offentlig transparens-side
app/admin/
└── co2-config/page.js    # Admin: faktorer, versioner, audit log
```

---

## Database-schema

### `co2_emission_factors`
Kilde-sandhed for kategorifaktorer. Læses offentligt, skrives kun af admin.
```sql
id                   text PRIMARY KEY   -- matcher CATEGORIES[].key
name_da              text
co2_kg_per_unit      numeric(8,2)
source_ids           jsonb              -- array af S1-S8 kilde-IDs
methodology_version  text
active               boolean
```

### `co2_methodology_versions`
Versioneret historik over beregningskonstanter.
```sql
version                     text PRIMARY KEY  -- fx "1.0"
displacement_rate           numeric(4,3)
transport_emission_g_per_km integer
route_buffer_factor         numeric(4,3)      -- default 1.3
default_distance_km         integer           -- default 10
active                      boolean           -- kun én kan være aktiv
```

### `transaction_co2_savings`
**IMMUTABLE** — ingen UPDATE- eller DELETE-policies.
```sql
id                    uuid PRIMARY KEY
transaction_id        uuid      -- FK til conversations.id
listing_category_id   text
net_saved_kg          numeric(8,3)
breakdown             jsonb     -- fuld beregnings-dekomposition
methodology_version   text
calculated_at         timestamptz
seller_institution_id uuid
buyer_institution_id  uuid
```

### `co2_audit_log`
Logfil for alle admin-ændringer — append-only.

### `conversations` (udvidet)
```sql
co2_net_saved_kg  numeric(8,3)   -- summary for hurtig visning
co2_breakdown     jsonb
```

---

## Beregningsformel

```
produktion_sparet   = kategori_co2 × DISPLACEMENT_RATE
transport_km_routed = distance_km × ROUTE_BUFFER          # fugleflugt → rute
transport_cost      = transport_km_routed × 2 × KG_PER_KM # tur/retur
netto_sparet        = max(0, produktion_sparet − transport_cost)
```

### Konstanter (v1.0)
| Konstant | Værdi | Kilde |
|----------|-------|-------|
| DISPLACEMENT_RATE | 0.6 | S3, S6, S7 (konservativt) |
| TRANSPORT_KG_PER_KM | 0.170 | EEA 2024 (S8) |
| ROUTE_BUFFER | 1.0 (OSRM) / 1.3 (haversine-fallback) | OSRM returnerer faktisk vejafstand — buffer kun ved fallback |
| DEFAULT_DISTANCE_KM | 10 | typisk intra-kommunal afstand (bruges kun hvis geocoding fejler) |

---

## Flow: hvornår beregnes CO₂?

1. Bruger A accepterer bud i `MessagesClient.handleAcceptBid()`
2. `deal_completed: true` sættes på `conversations`
3. `persistCO2Saving(conversation, categoryId)` kaldes **non-blocking**:
   a. Henter institutionskoordinater (Nominatim geocoding + cacher på institutions-tabel)
   b. Beregner faktisk vejafstand via OSRM routing (fallback: haversine × 1.3)
   c. Kalder `calculateCO2Savings({ categoryId, distanceKm, isRoutedDistance })`
   d. Inserter immutabelt i `transaction_co2_savings`
   e. Opdaterer `conversations.co2_net_saved_kg` som summary

Hvis trin 3 fejler, logges fejlen — men deal-flowet blokeres **aldrig**.

---

## Oprettelse af ny metode-version

1. Gå til `/admin/co2-config` → fanen "Metode-versioner"
2. Udfyld ny version med nye konstanter og begrundelse
3. Tryk "Opret version" — versionen er **inaktiv** til du aktiverer den
4. Opdatér `lib/co2/emission-factors.js`:
   - Bump `METHODOLOGY_VERSION`
   - Tilpas faktorer hvis nødvendigt
5. Deploy kode
6. Aktivér den nye version i admin (skrives til audit log)

**Kritisk:** Historiske `transaction_co2_savings`-rækker ændres **aldrig**.
De bevarer `methodology_version`-feltet fra beregnings-tidspunktet.

---

## Ændring af emissionsfaktorer

1. Gå til `/admin/co2-config` → fanen "Emissionsfaktorer"
2. Klik "Foreslå opdatering" på den relevante kategori
3. Angiv ny værdi og obligatorisk kildebegrundelse
4. Gem — skrives til DB og audit log
5. Opdatér tilsvarende i `lib/co2/emission-factors.js` + bump version
6. Deploy

Admin-siden fremhæver "AFVIGER" hvis kode-konstanten afviger fra DB-værdien.

---

## Geocoding

`persistCO2Saving` bruger `geocodeForCO2()` fra `lib/co2/geocoding.js` (Nominatim primær, DAWA postnummer-centroid som fallback).
Koordinater caches på `institutions.latitude/longitude` efter første opslag.

Faktisk vejafstand hentes via OSRM (`router.project-osrm.org`) — ingen route-buffer nødvendig.
Fallback: haversine × 1.3 hvis OSRM fejler.
Ved manglende koordinater bruges `DEFAULT_DISTANCE_KM = 10`.

---

## Test-suite

Se `__tests__/co2-calculator.test.js` for obligatoriske tests:

1. **Korrekte tal** — kendte inputs giver forventede outputs
2. **Aldrig negativ** — netto returnerer altid ≥ 0
3. **Immutabilitet** — persisterede beregninger ændres ikke ved faktomopdatering
4. **Legacy mapping** — gamle kategori-nøgler resolves korrekt
5. **Edge cases** — ingen afstand, ukendt kategori, samme institution
6. **Version-skift** — historik påvirkes ikke af ny aktiv version

---

## Ekstern review

For at validere beregningerne:

1. Tjek at alle faktorer i `EMISSION_FACTORS` matcher kilderne S1-S8
2. Verificer at ingen `transaction_co2_savings`-rækker har negative `net_saved_kg`
3. Kør `SELECT methodology_version, COUNT(*) FROM transaction_co2_savings GROUP BY 1`
   for at se versionfordeling over historiske beregninger
4. Sammenlign `co2_emission_factors` (DB) med `EMISSION_FACTORS` (kode) —
   admin-siden fremhæver afvigelser automatisk

**Anbefaling:** Send metoden til review hos LCA-forsker på DTU eller AAU.

---

## Kendte begrænsninger (v1.0)

- Kun `byd`-deals (bud-accept) trigger CO₂-beregning. `byt`-deals og
  direkte `køb`-aftaler tæller ikke endnu (ingen deal_completed for disse)
- Transport-mode antages altid personbil — cykel/offentlig transport beregnes ikke
- Displacement rate er estimeret, ikke målt på byt&leg-brugere specifikt
- Emballage og end-of-life er ikke inkluderet
