# Testplan — redesign af køb/tilbud/bytte (PR #49)

Dækker alt der er ændret på tværs af Trin 1–6. Køres i preview med rigtige data.
Arbejd ovenfra og ned.

---

## Status (opdateret 2026-06-24)

| Punkt | Status |
|-------|--------|
| 1) Tilbud — opret & dagligt loft | ✅ Gennemført |
| 2) Tilbud — sælgers svar | ✅ Gennemført (modbud, afvis m. kommentar, accept) |
| 3) Reservation | ✅ Gennemført (+ marketplace-badge, auto-afvis, bud-overblik) |
| 4) Tilbud — checkout & gennemførsel | ✅ Gennemført (hovedflow + negativ-test 409) |
| 5) Bundt-bytte — opret | ⬜ Ikke testet |
| 6) Bundt-bytte — accept & escrow | ⬜ Ikke testet |
| 7) Bundt-bytte — tosidet betaling | ⬜ Ikke testet |
| 8) 48t auto-refusion | ⬜ Ikke testet |
| 9) Udfasning | 🟡 Delvist (køb håndterer bud; QuickView er død kode) |
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

## 5) Bundt-bytte — opret (Trin 4 + 4f)

- [ ] Som **A**: åbn et af **B's byt-opslag** → **🔄 Foreslå bytte** (bundt-modal).
- [ ] Tjek modal: "Du vil have" (+ tilføj flere af B's varer), "Du tilbyder" (A's egne, multivalg), værdi-sammenligning, **kontant mellemlag** (beløb + betaler mig/modpart).
- [ ] Send → toast + redirect.
- [ ] **DB:** `swap_proposals` med korrekte `offered_items`/`requested_items`, `offered_value`/`requested_value`, `cash_adjustment`, `cash_payer`, `status='pending'`, `escrow_status='none'`, `protection_fee=10`.
- [ ] **Negativ:** ønskede varer fra to forskellige institutioner → afvises.

## 6) Bundt-bytte — accept & escrow (Trin 4b)

- [ ] Som **B**: forslag-boble viser giver/får (inkl. kontant) + **Godkend / Afvis**.
- [ ] **Godkend.** Forventet:
  - `status='accepted'`, `escrow_status='awaiting_both'`, `payment_deadline` ≈ nu+48t
  - alle involverede varer får `reserved_until` = fristen
  - A notificeres.

## 7) Bundt-bytte — tosidet betaling (Trin 4c/4d)

- [ ] Som **A**: boblen viser **din andel** (porto + 10 kr. + kontant hvis betaler) + **"Betal — send med pakke"** / **"Aftalt levering"**.
- [ ] A betaler → `initiator_paid=true`, `escrow_status='awaiting_owner'`, boble "afventer modpart", **B får "din tur"-mail**.
- [ ] **Dashboard (B):** banner "1 byttehandel afventer din betaling".
- [ ] Som **B**: betal. Forventet (begge betalt):
  - to forsendelser bookes (begge retninger) — pakke-/tracking-beskeder
  - byttede varer `is_sold=true`, `reserved_until=null`
  - `escrow_status='both_paid_released'`, `completed_at` sat
  - `conversations.deal_completed=true`, `deal_type='byt'`
  - completion-mails til begge (m. pakkemærkat/tracking)
  - CO2: ny `transaction_co2_savings`-række + `conversations.co2_net_saved_kg`.
- [ ] Test også **"Aftalt levering"** for den ene part → ingen label, men handlen fuldføres.

## 8) 48t auto-refusion (Trin 4e)

- [ ] Lav bytte hvor **kun A betaler**.
- [ ] Sæt `swap_proposals.payment_deadline` i fortiden i Supabase.
- [ ] Kald: `GET /api/cron/sweep-swap-deadlines` med header `Authorization: Bearer <CRON_SECRET>`.
- [ ] Forventet: `escrow_status='cancelled_timeout'`, `status='cancelled'`, **A refunderes** (Stripe-dashboard), `reserved_until` ryddes, besked i samtalen.

## 9) Udfasning (Trin 6)

- [ ] Opret-opslag: **"Byd"** er ikke længere en valgmulighed (kun køb/byt/søges).
- [ ] Historisk byd-opslag: knappen er nu **"🏷️ Giv et tilbud"** og åbner tilbud-modalen.
- [ ] Byt-opslag: kun **én** byttehandel-knap (bundt-modal); duplikaten er væk.

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
