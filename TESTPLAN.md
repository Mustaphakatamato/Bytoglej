# Testplan — redesign af køb/tilbud/bytte (PR #49)

Dækker alt der er ændret på tværs af Trin 1–6. Køres i preview med rigtige data.
Arbejd ovenfra og ned.

---

## 0) Forberedelse

- [ ] To institutionskonti: **A** (køber/initiator) og **B** (sælger/ejer). Brug to browsere/inkognito.
- [ ] Stripe testkort: `4242 4242 4242 4242`, vilkårlig fremtidig udløb + CVC + postnr. Bekræft at preview kører Stripe **test mode**.
- [ ] B opretter 2–3 aktive **køb**-opslag og 2–3 **byt**-opslag. A opretter 2–3 **byt**-opslag (til "det du tilbyder").
- [ ] Hav Supabase-tabeller klar: `offers`, `swap_proposals`, `listings`, `orders`, `conversations`, `transaction_co2_savings`.

---

## 1) Tilbud — opret & dagligt loft (Trin 3)

- [ ] Som **A**: åbn et af **B's køb-opslag** → **🏷️ Giv et tilbud**.
- [ ] Tjek modal: **−10% / −20% / fuld pris** viser korrekte beløb; prisoversigt (tilbud + porto-fra + køberbeskyttelse 5% + 5 kr.); **"X af 20 tilbud tilbage i dag"**.
- [ ] Send et tilbud (fx −10%). Forventet: toast, redirect til **/beskeder**, dagstæller falder ved næste åbning.
- [ ] **DB:** ny `offers`-række, `status='pending'`, `proposed_by='buyer'`, korrekt `amount`, `buyer_institution_id`/`seller_institution_id`.
- [ ] **Loft:** send flere tilbud — tælleren tæller korrekt pr. dag.
- [ ] **Negativ:** tilbud under et evt. mindstebud → afvises.
- [ ] **Negativ:** tilbud på dit eget opslag → blokeres.

## 2) Tilbud — sælgers svar (Trin 3)

- [ ] Som **B**: tilbud-boble i beskeder med **Accepter / Afvis / Modbud**.
- [ ] **Modbud:** indtast beløb → send → ny boble; som **A** kan du svare på den.
- [ ] **Afvis:** med kommentar → bekræft → boble viser "Afvist".
- [ ] **Accepter:** Forventet:
  - `offers.status='accepted'`
  - varen reserveres: `listings.reserved_until` ≈ nu+24t, `reserved_for_institution_id` = A
  - A får checkout-besked i samtalen.

## 3) Reservation (beslutning 1.5)

- [ ] Mens varen er reserveret til A: prøv at give tilbud på samme vare fra anden konto → **blokering**.
- [ ] **DB:** `reserved_until` i fremtiden.

## 4) Tilbud — checkout & gennemførsel (Trin 3 + 3e)

- [ ] Som **A**: vælg levering i checkout-beskeden → **betal** (testkort) → kvittering.
- [ ] **DB efter betaling:**
  - `offers.status='completed'`
  - `listings`: `is_sold=true`, `is_active=false`, `reserved_until=null`
  - `conversations.deal_completed=true`, `deal_type='køb'`
  - `orders` paid/shipped.
- [ ] **Mail:** køber + sælger får ordrebekræftelse.
- [ ] **Negativ (udløbet reservation):** sæt `reserved_until` i fortiden i DB → forsøg betaling → **409 "reservationen er udløbet"**.

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
