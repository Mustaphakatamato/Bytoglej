# Testplan — redesign af køb/tilbud/bytte (PR #49)

Dækker alt der er ændret på tværs af Trin 1–6. Køres i preview med rigtige data.
Arbejd ovenfra og ned.

---

## Status (opdateret 2026-06-25)

| Punkt | Status |
|-------|--------|
| 1) Tilbud — opret & dagligt loft | ✅ Gennemført |
| 2) Tilbud — sælgers svar | ✅ Gennemført (modbud, afvis m. kommentar, accept) |
| 3) Reservation | ✅ Gennemført (+ marketplace-badge, auto-afvis, bud-overblik) |
| 4) Tilbud — checkout & gennemførsel | ✅ Gennemført (hovedflow + negativ-test 409) |
| 5) Bundt-bytte — opret | ✅ Gennemført (+ obligatorisk anslået værdi, søges-filter, kort-visning) |
| 6) Bundt-bytte — accept & escrow | ✅ Gennemført |
| 7) Bundt-bytte — tosidet betaling | ✅ Gennemført (inkl. pakke-booking mod sandbox) |
| 8) 48t auto-refusion | ✅ Gennemført (forslag cd666dfc) |
| 9) Udfasning | ✅ Gennemført (rediger-opslag rettet: byd fjernet, søges tilføjet) |
| 10) Regression | ⬜ Ikke testet |

**Punkt 4 — verificeret (2026-06-24):** Accepteret tilbud → "Gå til betaling" → kurv (tilbudspris) → betaling
med Stripe testkort gennemført. Bekræftet: `offers.status='completed'`, `listings.is_sold=true` +
`is_active=false` + `reserved_until=null`, samtale `deal_completed=true`, ordrebekræftelses-mails til
både køber og sælger.

**Punkt 4 negativ-test — verificeret (2026-06-24):** Sat `listings.reserved_until` i fortiden på et
aktivt, ikke-solgt opslag med accepteret tilbud ("Test 4.1") → A "Gå til betaling" → kurv → Betal.
`create-intent` svarede **409 "Reservationen er udløbet — tilbuddet er ikke længere gyldigt"`. Ingen
redirect/Stripe, ingen ny ordre; `offers.status` forblev `accepted`, opslaget forblev aktivt/usolgt.
*Bemærk:* klient-UI viste stadig 24t-nedtælling (bruger checkout-beskedens tidsstempel), men serveren
håndhæver `reserved_until` korrekt — mulig UI-forbedring, ikke en blokerende fejl.

### Rettelser & forbedringer lavet under test (denne session)

**Tilbuds-flow (Punkt 1–3):**
- OfferModal: rettet afrunding på −10%/−20%, "Fuld pris" → "Egen pris", info-ikon bruger BuyerProtectionPopup (z-index 10100 > Modal)
- `offers/create`: blokér selvtilbud på institutions-niveau; blokér nye tilbud mens varen er reserveret (også for vinderen selv)
- `offers/respond`: rettet ugyldig kolonne (`shipping_options` → `can_ship`); modbud-mail siger nu "Nyt modbud"; **auto-afvis af alle andre åbne bud ved accept**
- ChatBubble: tilbud-boble i stedet for rå JSON
- Reserveret-badge i marketplace (ListingCard) + "Varen er reserveret"-banner på opslag for andre/vinderen
- Tilbud → checkout går nu gennem det fulde **indkøbsvogn-flow** (forsendelsesvalg) med tilbudsprisen + "Reserveret til dig"-badge

**Beskeder/realtime:**
- **Realtime aktiveret** på `offers`, `chat_messages`, `conversations` (var slået fra — rodårsag til "kræver genindlæsning"-fejl)
- Robust afsender-side (`isMine`): bobler havner nu korrekt højre/venstre via samtalens initiator/owner
- Soft-delete af samtaler (slettede før hos begge parter)
- Skrive-indikator ("…"-boble) via realtime broadcast

**Sælger-værktøjer:**
- "Mine opslag" redesignet til to-pane master-detail med bud-overblik pr. vare (→ besked)

**Checkout:**
- Enkelt-sælger checkout (radio i kurven) — kun én institutions varer ad gangen
- Prisoversigt viser varenavn + miniature

**Kendte/parkerede:**
- 🅿️ Leaflet-kort (afhentningssted) virker i Chrome, men tiles vises grå i Safari — parkeret til senere

---

## SESSION 2 (2026-06-25) — bytte-forsendelse, IA-ombygning & nye features

### ⚠️ Miljø-tilstand (opdateret 2026-06-25 efter Punkt 8)
- **Stripe TEST-webhook sat TILBAGE til produktion** (`https://bytogleg.dk/api/webhooks/stripe`, uden protection-bypass) den 2026-06-25 efter Punkt 8. Pegede midlertidigt på preview under Punkt 7-8.
- **CRON_SECRET roteret** 2026-06-25 (gammel var write-only i Vercel). Ny værdi sat på alle scopes.
- **Shipmondo:** Preview-scope env bevidst på **sandbox** (`SHIPMONDO_BASE_URL` + sandbox `API_USER`/`API_KEY`), så preview-test aldrig booker rigtige pakker. Production-nøgler urørt. (Behold på sandbox for fremtidig preview-test.)
- **`STRIPE_SECRET_KEY`** manglede på Preview (kun Production) — tilføjet til Preview.
- Vercel "Redeploy" fra dashboard tager IKKE altid nye env-vars med → trig frisk deploy via git-push.

### DB-migrationer anvendt (begge i `supabase/migrations/`)
- `20260624_listing_estimated_value.sql` — `listings.estimated_value` (anslået værdi på byt-opslag).
- `20260625_swap_received_flags.sql` — `swap_proposals.initiator_received` / `owner_received` (modtaget-bekræftelse).

### Bytte-forsendelse (Punkt 7 fuldført)
- Ny side **`/bytte-betaling/[proposalId]`**: betaleren vælger udleveringssted (genbruger `PickupPointPicker`) — fikser GLS 422 "service point required". Gemmes på `*_pickup`, bruges ved booking. "Betal — send med pakke" i boblen router hertil.
- Verificeret ende-til-ende mod sandbox: begge pakker booket (tracking + mærkater).

### Ny IA — opdelt efter RETNING (efter UX-vurdering)
- **"Skal sendes"** (`/mine-opgaver`, tidl. "Mine salg") = alt jeg sender (køb-salg + min bytte-udgående bundt). **Eneste sted med pakkemærkat.**
- **"Mine køb"** (`/mine-ordrer`, tidl. "Mine ordrer") = alt jeg modtager (køb + modpartens bytte-bundt). Tracking + **"✅ Marker som modtaget"** (via `/api/swaps/mark-received`). Bytte-afsend-ordrer ekskluderet herfra.
- **"Byttehandler"-kortet FJERNET** (redundant; bytte lever i Beskeder + Skal sendes + Mine køb). Ruten `/mine-handeler` findes stadig men er ikke linket.
- Profil-hub: tællere på alle kort (Mine køb/Favoritter/Gemte søgninger/Skal sendes), 2-kolonne-grid, favorit-tæller = samme logik som `/favoritter`.
- Besked-boble: deep-links "Se afsendelse →" / "Følg det jeg modtager →" + partens egen pakkemærkat/tracking.

### Notifikationer
- **In-app notifikationer** ved nyt bytteforslag (`swap_proposal_received`) og "din tur at betale" (`swap_payment_turn`). Klokke-notifikationer er nu **klikbare** → fører til samtale/opslag.
- Bug rettet: `.catch()` på Supabase-builder kastede TypeError (`supa.from().insert().catch` findes ikke) → notifikations-insert væltede `swaps/create`. Nu try/catch.

### Øvrige rettelser
- Kontant mellemlag vises som synlig linje på betalingssiden.
- Reserverede varer (låst i anden handel) kan ikke vælges i nyt bytteforslag (begge sider + server).
- Completion-besked degraderer pænt ("Aftal levering indbyrdes") hvis ingen pakke blev booket.
- Markedsplads ryddet: 40 seed-opslag (bruger 8dac847e) slettet permanent.

---

## 0) Forberedelse

- [ ] To institutionskonti: **A** (køber/initiator) og **B** (sælger/ejer). Brug to browsere/inkognito.
- [ ] Stripe testkort: `4242 4242 4242 4242`, vilkårlig fremtidig udløb + CVC + postnr. Bekræft at preview kører Stripe **test mode**.
- [ ] B opretter 2–3 aktive **køb**-opslag og 2–3 **byt**-opslag. A opretter 2–3 **byt**-opslag (til "det du tilbyder").
- [ ] Hav Supabase-tabeller klar: `offers`, `swap_proposals`, `listings`, `orders`, `conversations`, `transaction_co2_savings`.

---

## 1) Tilbud — opret & dagligt loft (Trin 3) — ✅

- [x] Som **A**: åbn et af **B's køb-opslag** → **🏷️ Giv et tilbud**.
- [x] Tjek modal: **−10% / −20% / egen pris** viser korrekte beløb; prisoversigt (tilbud + porto-fra + køberbeskyttelse 5% + 5 kr.); **"X af 20 tilbud tilbage i dag"**.
- [x] Send et tilbud (fx −10%). Forventet: toast, redirect til **/beskeder**, dagstæller falder ved næste åbning.
- [x] **DB:** ny `offers`-række, `status='pending'`, `proposed_by='buyer'`, korrekt `amount`, `buyer_institution_id`/`seller_institution_id`.
- [x] **Loft:** send flere tilbud — tælleren tæller korrekt pr. dag.
- [x] **Negativ:** tilbud under et evt. mindstebud → afvises.
- [x] **Negativ:** tilbud på dit eget opslag → blokeres (rettet til institutions-niveau).

## 2) Tilbud — sælgers svar (Trin 3) — ✅

- [x] Som **B**: tilbud-boble i beskeder med **Accepter / Afvis / Modbud**.
- [x] **Modbud:** indtast beløb → send → ny boble; som **A** kan du svare på den. (Vises nu korrekt højre/venstre + live.)
- [x] **Afvis:** med kommentar → bekræft → boble viser "Afvist".
- [x] **Accepter:** Forventet:
  - `offers.status='accepted'`
  - varen reserveres: `listings.reserved_until` ≈ nu+24t, `reserved_for_institution_id` = A
  - A får checkout-besked i samtalen.
  - **Alle andre åbne bud på varen afvises automatisk.**

## 3) Reservation (beslutning 1.5) — ✅

- [x] Mens varen er reserveret til A: prøv at give tilbud på samme vare fra anden konto → **blokering**.
- [x] **DB:** `reserved_until` i fremtiden.
- [x] Reserveret-badge vises i marketplace; opslaget viser "Varen er reserveret"-banner.

## 4) Tilbud — checkout & gennemførsel (Trin 3 + 3e) — ✅

- [x] Som **A**: vælg levering i checkout-beskeden → **betal** (testkort) → kvittering. (Går nu via fulde kurv-flow.)
- [x] **DB efter betaling:**
  - `offers.status='completed'`
  - `listings`: `is_sold=true`, `is_active=false`, `reserved_until=null`
  - `conversations.deal_completed=true`, `deal_type='køb'`
  - `orders` paid/shipped.
- [x] **Mail:** køber + sælger får ordrebekræftelse.
- [x] **Negativ (udløbet reservation):** sæt `reserved_until` i fortiden i DB → forsøg betaling → **409 "Reservationen er udløbet"** (verificeret; ingen ordre oprettet).

## 5) Bundt-bytte — opret (Trin 4 + 4f) — ✅

- [x] Som **A**: åbn et af **B's byt-opslag** → **🔄 Foreslå bytte** (bundt-modal).
- [x] **DB (1. forslag):** `swap_proposals`-række korrekt — `offered_items` (2), `requested_items` (1), `cash_adjustment=100`, `cash_payer='owner'`, `status='pending'`, `escrow_status='none'`, `protection_fee=10`. ✅
- [x] **Negativ (to institutioner):** håndhæves både i UI (modalen tilbyder kun "Tilføj flere fra *samme* institution") og server-side (`swaps/create` afviser med "Alle ønskede varer skal være fra samme institution"). ✅

### Fundne forbedringer (rettet 2026-06-24, kræver re-test efter migration)
1. **"Du tilbyder" hentede aldrig `price`** → offer-sidens værdi var altid 0. Nu hentes værdi; desuden ekskluderes **søges-opslag** (kan ikke tilbydes — man har dem ikke) og solgte varer.
2. **Anslået værdi på byt-opslag (obligatorisk).** Byt-opslag havde ingen pris → værdi-sammenligning + kontant mellemlag var "0 mod 0". Ny kolonne `listings.estimated_value`; opret/rediger kræver nu en værdi for byt; swap-flowet bruger `COALESCE(price, estimated_value)`. **Migration skal køres:** `supabase/migrations/20260624_listing_estimated_value.sql`.

**Re-test (efter migration + preview-redeploy) — verificeret 2026-06-24:**
- [x] **Anslået værdi gemmes:** "Hejsa" `estimated_value=250`, "Vildkatten Go" `=75` (i `estimated_value`, ikke `price`). ✅
- [x] **Bundt-modal med rigtige værdier + køb-opslag som tilbud:** forslag med `offered_value=175` (køb "Test 4.1" 100 + byt "Vildkatten Go" 75) mod `requested_value=250` (byt "Hejsa"), `cash_adjustment=75` (= differencen). ✅
- [x] **Visnings-fejl fundet & rettet:** byt-kort/detalje viste "Byttes kun" selv med værdi, fordi `LISTING_COLS` (AppProvider) ikke hentede `estimated_value`. Rettet i alle 4 visnings-steder + detalje-query. Skal verificeres visuelt efter redeploy ("Byttes · anslået værdi X kr.").
- [x] **Visuelt bekræftet** (2026-06-24): kort/detalje viser "Byttes · anslået værdi X kr." og værdien er påkrævet i opret/rediger.

**Bug fundet & rettet (2026-06-24):** Varer der allerede er **reserveret i en anden igangværende handel** (reserved i marketplace) kunne stadig vælges i et nyt bytteforslag — både på "Du vil have" og "Du tilbyder". Nu filtreret fra i modalen (begge sider) + afvist server-side i `swaps/create` (409 "… er reserveret i en anden handel"). *(re-test efter redeploy)*

## 6) Bundt-bytte — accept & escrow (Trin 4b) — ✅

- [x] Som ejer: forslag-boble viser giver/får (inkl. kontant) + **Godkend / Afvis**.
- [x] **Godkend** — verificeret (2026-06-24, forslag 29255edc):
  - `status='accepted'`, `escrow_status='awaiting_both'`, `payment_deadline` = præcis nu+48t, `accepted_at` sat ✅
  - alle 4 involverede varer (begge sider) fik `reserved_until` = fristen ✅
  - *Obs:* `reserved_for_institution_id` sættes kun på den ene vare (kosmetisk; `reserved_until` beskytter alle).

## 7) Bundt-bytte — tosidet betaling (Trin 4c/4d) — ✅ Gennemført

> **Fuldt verificeret (2026-06-24) på forslag c3dcbf7b:** Begge parter betalte via ny `/bytte-betaling`-side
> (valgte udleveringssted), `escrow_status='both_paid_released'`, `completed_at` sat, varer solgt + reservation ryddet,
> **begge pakker booket mod Shipmondo sandbox** (GLS parcel_shop, status `booked`, tracking 056212084581 + 056212084598,
> pakkemærkater til stede), pickups gemt, og **in-app notifikationer** oprettet ("Nyt bytteforslag" + "Det er din tur").
>
> **Blokeringer fundet & løst undervejs:** "Mangler samtale" (tidlig conversationId-guard); kontant-mellemlag manglede
> som synlig linje; 422 "service point required" → ny leveringsside hvor betaleren vælger udleveringssted (gemmes på
> `*_pickup`, bruges ved booking); 422 "Insufficient funds" → preview pegede på prod-Shipmondo, sat til sandbox på
> Preview-scope; "Forslaget kunne ikke sendes" → `.catch()` på Supabase-builder kastede TypeError (nu try/catch);
> STRIPE_SECRET_KEY kun på Production → tilføjet Preview; notifikationer gjort klikbare.

> **Bug fundet & rettet (2026-06-24):** "Betal — send med pakke" fejlede med alert **"Mangler samtale"**.
> `create-swap-intent` havde en tidlig `conversationId`-guard, men det nye `swap_proposals`-flow sender kun
> `proposalId` (samtalen udledes af forslaget). Guarden flyttet til kun at gælde det gamle flow. Afventer re-test.

### Webhook-opsætning under test (vigtigt)
> Punkt 7-8's escrow/forsendelse/refusion lever i **webhook-koden**, som kun findes i branchen. Produktions-webhooken (main) kender ikke `swap_proposals`. Derfor blev Stripe **TEST**-webhook midlertidigt peget på preview (2026-06-24). **Skal sættes tilbage til prod efter Punkt 7-8.** Preview var desuden bag **Vercel Deployment Protection** (302→SSO) → Stripe blev afvist; løst med Protection-Bypass-secret i endpoint-URL'en.

### Bugs fundet & rettet (2026-06-24)
1. **"Mangler samtale":** `create-swap-intent` havde en tidlig `conversationId`-guard; det nye flow sender kun `proposalId`. Guarden flyttet til kun det gamle flow. ✅
2. **Kontant mellemlag manglede som linje** på betalingssiden (var i totalen). Tilføjet synlig linje. ✅
3. **"Din tur"-notifikation + besked-status:** webhook opretter nu in-app notifikation (`swap_payment_turn`); boblen viser "Modparten har betalt — det er din tur". ✅ (kode; verificeres på frisk bytte)
4. **Forsendelse fejlede med 422 "A service point is required for ShopDelivery":** swap-bookingen valgte aldrig et udleveringssted. **Stort fix:** "Betal — send med pakke" sender nu til ny side `/bytte-betaling/[proposalId]` hvor betaleren vælger pakkeshop + udleveringssted (genbruger `PickupPointPicker`); gemmes på `initiator/owner_pickup` og bruges ved booking. ✅ (kode; kræver frisk re-test)

### Verificeret på forslag 29255edc (før service-point-fix)
- [x] Boblen viser din andel korrekt (porto + 10 kr. + 75 kr. kontant). ✅
- [x] Initiator betaler → `initiator_paid=true`, `escrow_status='awaiting_owner'`, boble "afventer modpart". ✅
- [x] Begge betaler → `escrow_status='both_paid_released'`, `completed_at` sat, alle varer `is_sold=true`+`reserved_until=null`, `conversations.deal_completed=true`/`deal_type='byt'`, CO2-række oprettet. ✅
- [⚠️] **Forsendelser IKKE booket** (422 service point) → rettet, se #4. `co2_net_saved_kg=0` (konservativ metode, flag til CO2-agent).

### Frisk re-test (efter service-point-fix) — ⬜
- [ ] Nyt bytte med forsendelsesegnede varer → accepter.
- [ ] Initiator: "Betal — send med pakke" → **ny leveringsside** → vælg pakkeshop + udleveringssted → betal. Tjek `initiator_pickup` gemt, `initiator_paid=true`, **"din tur"-notifikation + mail** til modpart.
- [ ] Owner: samme → vælg udleveringssted → betal. Tjek **begge `*_shipment_id` ≠ null**, varer solgt, escrow frigivet, completion-mails m. pakkemærkat.
- [ ] Test også **"Aftalt levering"** for den ene part → ingen label, handlen fuldføres.

## 8) 48t auto-refusion (Trin 4e) — ✅

**Verificeret (2026-06-25) på forslag cd666dfc** (Tricycle mod Trælegetøj-Puslespil, kun A betalte):
- [x] Bytte hvor **kun A betaler** (`escrow_status='awaiting_owner'`, ægte betalt ordre `pi_3TmKbjDudCgBYS3n07DtIOTW`).
- [x] `payment_deadline` sat i fortiden i Supabase.
- [x] `GET /api/cron/sweep-swap-deadlines` (Bearer CRON_SECRET, mod preview m. protection-bypass) → svar `{"ok":true,"cancelled":1,"refunded":1}`.
- [x] Resultat: `status='cancelled'`, `escrow_status='cancelled_timeout'`, **A refunderet** (Stripe-kald lykkedes), begge varers `reserved_until`/`reserved_for` ryddet, system-besked postet i samtalen.

**CRON_SECRET roteret** under test (gammel var write-only/usynlig i Vercel). Ny værdi sat på alle scopes; begge cron-jobs (sweep + generate-shipping-invoices) bruger automatisk den nye.

**Observation (ikke blokerende):** cron'en laver Stripe-refusionen men opdaterer ikke `orders.status` til `refunded` (forbliver `paid`). Pengene er refunderet, men ordre-historik kan vise misvisende. Mulig lille forbedring.

## 9) Udfasning (Trin 6) — ✅

Verificeret i koden (2026-06-25):
- [x] **Opret-opslag:** "Byd" er ikke en valgmulighed — kun `['køb','byt','søges']` (`app/opret-opslag/page.js:800`).
- [x] **Historisk byd-opslag:** knappen er **"🏷️ Giv et tilbud"** → `OfferModal` (`components/ListingDetailClient.js:868`).
- [x] **Byt-opslag:** kun **én** byttehandel-knap "🔄 Foreslå bytte" (bundt-modal, `:869`). Gamle `bidModal`/`swapModal` er død kode (`setBidModal(true)`/`setSwapModal(true)` kaldes aldrig).

**Fund + rettet:** `rediger-opslag` tilbød stadig "byd" (og manglede "søges") → kunne gen-introducere udfaset type. Rettet til `['køb','byt','søges']` (`app/rediger-opslag/[id]/page.js:329`). Historiske byd-opslag kan stadig redigeres (min_bid-feltet vises hvis `type==='byd'`).

**Resterende død kode (kosmetisk, ikke rettet):** `bidModal`/`handleBid`/`swapModal` i ListingDetailClient; døde `'byd'`-grene i opret-opslag (linje 49, 512, 843).

## 10) Regression — må ikke være brækket

- [ ] Alm. køb: kurv → checkout → betal (uændret gebyr 5% + 5 kr.).
- [ ] Historiske bud/bytter i gang: vises og kan håndteres i beskeder (accepter/afvis/betal).
- [ ] Beskeder: billeder, tekst, betalingsbekræftelser renderer fint.
- [ ] Dashboard: "Handler" + "Gennemførte handler" viser nye tilbud (som "Køb") og bytter (som "Bytte").

---

## Data-tjek

| Hvor | Tjek |
|------|------|
| `offers` | `status`, `proposed_by`, `amount` |
| `swap_proposals` | `status`, `escrow_status`, `payment_deadline`, `*_paid`, `cash_*` |
| `listings` | `reserved_until`, `reserved_for_institution_id`, `is_sold` |
| `conversations` | `deal_completed`, `deal_type`, `co2_net_saved_kg` |
| `orders` | `status` (paid/shipped/refunded) |
| Stripe (test) | betalinger + refunds |
| Indbakke | tilbud-/bytte-/completion-mails |

---

## Kendte forbehold (ikke fejl)
- Bundt-forsendelse bookes som **én pakke pr. retning** (største størrelse i bundtet).
- Bytte-CO2 summerer pr. vare (konservativt på transport).
- Afvis/modbud er **in-chat barer**, ikke separate modaler.
- Kontant mellemlag + sælger-udbetaling afregnes via den eksisterende **manuelle** udbetalingsproces.
- Gammelt flow er **udfaset, ikke hård-slettet** — historiske bud/bytter håndteres stadig. Hård oprydning (+ drop af `conversations.swap_*`) sker efter test.
- **Marketplace auto-opdaterer ikke efter et køb** — en netop solgt vare hænger i søgningen indtil hard-refresh (klient-cache). DB er korrekt (is_sold/is_active/reserved_until). Mulig forbedring: refresh listings efter gennemført handel.
