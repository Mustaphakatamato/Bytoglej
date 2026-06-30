# CO₂-beregningsmodul — Teknisk dokumentation

**Metode-version:** 1.1  
**Implementeret:** 2026-06-30 (v1.0: 2026-05-30)  
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
version                     text PRIMARY KEY  -- fx "1.1"
displacement_rate           numeric(4,3)
parcel_emission_g           integer           -- v1.1: pakke-emission i gram (~200)
transport_emission_g_per_km integer           -- legacy (v1.0 bil-model, ubrugt i v1.1)
route_buffer_factor         numeric(4,3)      -- legacy
default_distance_km         integer           -- legacy
active                      boolean           -- kun én kan være aktiv
```

### `transaction_co2_savings`
**IMMUTABLE** — ingen UPDATE- eller DELETE-policies.
```sql
id                    uuid PRIMARY KEY
transaction_id        uuid UNIQUE  -- FK til conversations.id (én CO₂-række pr. handel)
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

## Beregningsformel (v1.1)

```
produktion_sparet    = Σ (kategori_co2 × DISPLACEMENT_RATE)   # summeret over varer i forsendelsen
transport_omkostning = PARCEL_CO2_KG                          # fast pr. forsendelse (pakkenetværk)
netto_sparet         = max(0, produktion_sparet − transport_omkostning)
```

### Konstanter (v1.1)
| Konstant | Værdi | Kilde |
|----------|-------|-------|
| DISPLACEMENT_RATE | 0.4 | Vinted/Vaayu 39–40% (S6, S9) |
| PARCEL_CO2_KG | 0.2 (≈200 g/forsendelse) | Last-mile pakkedata (S10) |

Transporten er **distance-uafhængig** og trækkes fra **én gang pr. handel** (én
forsendelse) — også for bundter. Det erstatter v1.0's bil-tur/retur-pr.-km-model,
der overvurderede transporten ~20× og nulstillede de fleste lette varer.

---

## Flow: hvornår beregnes CO₂?

CO₂ registreres for **alle** gennemførte handler — køb, bud og bytte — idempotent
pr. samtale (én række pr. `transaction_id`, beskyttet af både en eksistens-guard
og en UNIQUE-constraint).

- **Betalte handler (Stripe)**: webhooken (`app/api/webhooks/stripe/route.js`)
  kalder `persistTransactionCO2()` fra `lib/co2/persist-server.js` i
  `finalizePurchase` (køb/byd) og i begge bytte-flows. Service-role-klient,
  ingen netværkskald udover DB.
- **In-chat handler (afhentning/aftalt)**: `MessagesClient.persistCO2Saving()`
  kaldes non-blocking ved deal-afslutning.

Begge:
  a. Tjekker idempotens (findes en række for samtalen → stop)
  b. Henter de aktive faktorer/metodologi fra DB (fallback: hardcodede v1.1)
  c. Kalder `calculateCO2Savings({ categoryIds, factors, methodology })`
  d. Inserter immutabelt i `transaction_co2_savings`
  e. Opdaterer `conversations.co2_net_saved_kg` som summary

Ingen geocoding/routing længere — transporten er en fast pakke-emission.
Hvis beregningen fejler, logges fejlen — men handelsflowet blokeres **aldrig**.

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

## Geocoding (udgået i v1.1)

Pakke-modellen er distance-uafhængig, så CO₂-beregningen bruger **ikke længere**
geocoding eller routing. `lib/co2/geocoding.js` er bevaret i repoet (kan bruges
andre steder), men kaldes ikke fra CO₂-flowet. Det fjernede de mest skrøbelige
netværkskald (Nominatim/OSRM) fra deal-afslutningen.

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

## Kendte begrænsninger (v1.1)

- Pakke-emissionen er et fast gennemsnit — den varierer ikke med faktisk
  forsendelsesafstand, transportør eller pakkestørrelse
- Produktionsfaktoren er fast pr. kategori pr. vare — den skalerer ikke med
  varens faktiske størrelse/vægt (mulig fremtidig forbedring via
  `shipping_size_category`)
- Displacement rate (0,4) er overtaget fra Vinted/Vaayu, ikke målt på
  byt&leg-brugere specifikt
- Emballage og end-of-life er ikke inkluderet (bevidst konservativt)
