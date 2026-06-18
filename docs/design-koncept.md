# Designkoncept — "Sådan virker det" & "Om os"

*Redesign udført lokalt. Intet pushet. Senior UI/UX-tilgang, dansk B2B-markedsplads for genbrug af legetøj mellem institutioner.*

---

## 1. Tema & stemning — "Blød Eng"

Konceptet hedder **Blød Eng**: en varm, papir-agtig flade hvor dyb skovgrøn
mødes med legende, men afdæmpede accentfarver. Det skal føles som en solbeskinnet
legeplads set af en voksen der træffer en professionel beslutning — legende og
varmt, men roligt og troværdigt nok til en kommunal indkøber.

Tre ord styrer alt: **blødt, glidende, indbydende.**

- Ingen hårde kanter: store radii (16–28px), runde "blob"-former, bløde lagdelte skygger.
- Ingen brat bevægelse: alt toner og glider ind med `cubic-bezier(0.16, 1, 0.3, 1)`.
- Ingen tekstmure: hvert workflow bliver til et visuelt trin-for-trin-forløb.

---

## 2. Farvepalette (bygget på eksisterende brand i `lib/constants.js`)

De eksisterende brandfarver er **bevaret 1:1** — intet er opfundet:

| Rolle | Token | Hex |
|------|-------|-----|
| Primær grøn | `PRIMARY` | `#2A7D4F` |
| Dyb grøn (mørke sektioner) | `GREEN_DEEP` | `#133F2B` |
| Blød grøn | `GREEN_SOFT` | `#CFE3D8` |
| Grøn tint (pills/flader) | `GREEN_TINT` | `#E8F1EC` |
| Papir (baggrund) | `PAPER` | `#F6F2EA` |
| Papir 2 / 3 | `PAPER2` / `PAPER3` | `#ECE6DA` / `#DAD3C4` |
| Blæk (tekst) | `INK` / `INK2` / `INK3` | `#16221C` / `#3A473D` / `#6B7570` |
| Accenter | `CORAL` `BUTTER` `SKY` `ROSE` | `#E8593D` `#F1C44B` `#6EA8D4` `#F3D7D0` |

**Accent-system pr. workflow:** hvert workflow får sin egen rolige accent, så
brugeren ubevidst kan skelne dem fra hinanden — Opret = grøn, Køb = grøn, Byd =
rav/butter, Byt = lilla, Levering = blå/sky, Beskyttelse = grøn, CO₂ = grøn.
Accenten bruges KUN som detalje (kant, ikon-baggrund, tal-watermark) — aldrig
som stor flade. Det holder paletten rolig.

---

## 3. Typografi-hierarki

Vi beholder **Sora** (allerede indlæst globalt) som hele systemets skrift.

- **Display / H1:** Sora 800, `letter-spacing: -0.04em`, line-height 1.0–1.05. Stramt og selvsikkert.
- **Sektionsoverskrift / H2:** Sora 800, 28–48px, `-0.04em`.
- **Kort-titel / H3:** Sora 800, 17–22px, `-0.02 / -0.03em`.
- **Eyebrow/label:** Sora 700, 11px, `letter-spacing: 0.08–0.1em`, UPPERCASE, i en pille.
- **Brødtekst:** Sora 400/600, 13–18px, line-height 1.65–1.75 (luftig læsbarhed).
- **Tal-watermark:** Sora 800, 72–340px, meget lav opacitet — bruges som dybde, ikke som indhold.

---

## 4. Signaturelementer (det der gør siderne mindeværdige)

1. **Wave-dividers** mellem sektioner (genbrug af eksisterende SVG-path) — ingen sektion møder den næste med en lige streg.
2. **Flydende blob-baggrunde** (bløde radial-gradients + langsom `float`-animation) der giver dybde uden at distrahere.
3. **AI-scanner-mockup**: en CSS-telefon hvor et foto scannes (animeret scan-bar, genbrug af `scanBar`-keyframe) og felter "auto-udfyldes" et ad gangen. Gør den abstrakte AI-funktion håndgribelig.
4. **Leverings-rute**: to institutions-prikker forbundet af en blød, animeret stiplet linje med en pakke der bevæger sig — gør forsendelse konkret.
5. **Byt-escrow-diagram**: to spejlede kort der mødes om et skjold i midten — viser "begge sender en pakke, beskyttet undervejs".
6. **CO₂ count-up**: tallet tæller blødt op når det kommer i syne (respekterer reduceret bevægelse).
7. **Konsekvent rytme**: eyebrow-pille → stor overskrift → kort undertekst → visuelt indhold, i hver sektion. Forudsigelig rytme = ubesværet forståelse.

---

## 5. Bevægelse — blødt og meningsfuldt

- **Scroll-reveals** via `IntersectionObserver` (ny `components/Reveal.js`): indhold toner og glider ind nedefra/siderne med en lang, blød easing. Afslører gradvist, så øjet følger forståelsen.
- **Stagger:** elementer i en gruppe kommer ind med små forsinkelser (60–120ms), så det bølger frem i stedet for at "poppe".
- **Mikro-float:** dekorative former og hero-emojis svæver langsomt (4–7s loop).
- **`prefers-reduced-motion` respekteres fuldt ud:** `Reveal` viser alt med det samme uden transform, count-up springer til slutværdien, floats slås fra. Tilgængelighed er ikke til forhandling.
- Synligt keyboard-fokus bevares (global `outline` i `globals.css`), kontrast holdt på WCAG-niveau, alle ikon-emojis er dekorative (`aria-hidden`) med tekst ved siden af.

---

## 6. "Sådan virker det" — informationsarkitektur

Alle platformens workflows, hver som et visuelt forløb:

1. **Hero** — stemning + løfte ("Fra hylde til hjerte").
2. **Opret et opslag** — foto → AI udfylder → vælg køb/byd/byt → publicér (AI-scanner-mockup).
3. **Tre måder at handle på** — Køb (fastpris) · Byd (forhandl, modbud, 24t reservation) · Byt (escrow).
4. **Byt i dybden** — bundt for bundt, escrow, begge sender en pakke (escrow-diagram).
5. **Levering** — Pakkeshop · Hjemlevering · Afhentning, via Shipmondo (rute-illustration).
6. **Tryg betaling & beskyttelse** — Køberbeskyttelse (5% + 5 kr) og Byttebeskyttelse (10 kr/part), mørk "trust"-sektion.
7. **Din CO₂-besparelse** — automatisk beregnet pr. handel (count-up).
8. **AI gør det nemt** — billedscanning, søges-assistent, intelligent søgning, beskrivelsesforbedring.
9. **CTA** — kom i gang.

## 7. "Om os" — informationsarkitektur

1. **Hero** — varm, menneskelig mission-åbning.
2. **Problemet → løsningen** — hvad byt&leg er, og hvilket problem det løser.
3. **Hvorfor det giver mening** — økonomi · bæredygtighed · fællesskab (tre søjler).
4. **Den bæredygtige vinkel** — genbrug, mindre spild, CO₂ (grøn sektion, evt. live-stats).
5. **Værdier** — tillid, gennemsigtighed, bæredygtighed, fællesskab.
6. **Bygget til institutioner** — typer-pills.
7. **Manifest/vision** — citat-blok.
8. **CTA** — motiverende afslutning.

---

## 8. Tekniske valg & antagelser

- **Stack respekteret:** ren React-komponenter i Next.js App Router med inline-styles + brand-tokens (præcis som de eksisterende sider). Ingen nye npm-pakker, intet build-step ud over det eksisterende, ingen tunge animationsbiblioteker. Animation = CSS + `IntersectionObserver`.
- **Ny delt komponent `components/Reveal.js`** — én lille, genbrugelig scroll-reveal-wrapper der respekterer `prefers-reduced-motion`. Bruges af begge sider, så bevægelsessproget er identisk. (Antagelse: en delt hjælpekomponent er at foretrække frem for at duplikere `IntersectionObserver`-logik i hver fil.)
- **Indhold er faktatjekket mod koden** (CLAUDE.md: "gæt aldrig"): køberbeskyttelse = `calcServiceFee` = 5% + 5 kr; byttebeskyttelse = `SWAP_PROTECTION_FEE` = 10 kr/part; levering = Pakkeshop/Hjemlevering/Afhentning via Shipmondo; bud reserveres i 24t. Ingen påstande om tal eller features der ikke findes i koden.
- **Navigation, routing og brandfarver er uændrede** — kun de to siders indhold er ombygget. CTA-knapper peger fortsat på `/signup` og `/opslag`.
- **Mobil-først paritet:** hver sektion har et dedikeret mobil-layout (stak, mindre type, tilpassede mockups), så det er lige flot på telefon som på desktop.

---

## 9. Vurdering af de gamle sider (Fase 1)

**Hvad fungerede (beholdt):**
- Brandfarver, Sora-typografi, hero-gradient og wave-divideren var allerede stærke — fundamentet er genbrugt.
- Den eksisterende "rejse"-timeline på hvordan-siden havde en god grundidé (trin-for-trin).
- Stats-blokken på om-os med tærskler/`STATS_CONFIG` er velfungerende og bevaret.

**Hvad trak ned (rettet):**
- **Manglende workflows:** den gamle hvordan-side forklarede *ikke* levering, betaling/beskyttelse eller byt-escrow — kerneflows som brugeren skal forstå. Nu har hver sit visuelle afsnit.
- **Abstrakt AI:** AI blev kun beskrevet i tekst. Nu vises det med en levende scanner-mockup.
- **Flad bevægelse:** kun én slags reveal, og uden `prefers-reduced-motion`-håndtering. Nu et samlet, blødt bevægelsessprog via `Reveal` med fuld reduceret-bevægelse-støtte.
- **Om os var tynd:** sprang fra værdier til stats uden at forklare *problemet → løsningen* eller *hvorfor det giver mening*. Begge er tilføjet som bærende sektioner, og hero'en er gjort varmere ("Godt legetøj fortjener et nyt hjem").

## 10. Ændringslog

- **Ny:** `components/Reveal.js` (delt scroll-reveal + `useReducedMotion`).
- **Omskrevet:** `app/hvordan/page.js` — 9 sektioner: hero, opret opslag (AI-mockup), 3 handelstyper, byt/escrow-diagram, levering (rute), betaling & beskyttelse (mørk), CO₂ count-up, AI-features, CTA.
- **Omskrevet:** `app/om-os/page.js` — hero, problem→løsning, 3 grunde, bæredygtighed (mørk, m. live-stats-fallback), værdier, institutionstyper, manifest, CTA.
- **Uændret:** navigation, routing, brandfarver, `STATS_CONFIG`-logik, CTA-mål (`/signup`, `/opslag`).

**Antagelser truffet undervejs (ingen at spørge om — fuld autonomi):**
- CO₂-tallet på hvordan-siden (12,4 kg) er markeret som *illustrativt eksempel* med fodnote, da der ikke findes en officiel "typisk besparelse"-konstant i koden. Reelle tal beregnes pr. handel.
- Gebyrtal er hentet direkte fra koden (køberbeskyttelse 5% + 5 kr; byttebeskyttelse 10 kr/part) — ikke gættet.
- Valgte en delt `Reveal`-komponent frem for duplikeret observer-kode i hver fil (DRY + ét konsistent bevægelsessprog).

## 11. Rettelser efter første gennemsyn

- **Levering:** byt&leg står ikke for forsendelsen. Sektionen er omskrevet, så det fremgår at institutionerne selv pakker og sender. Shipmondo nævnes ikke længere; i stedet nævnes at pakker kan sendes med PostNord, DAO eller GLS (eller hentes direkte ved nærhed). Samme rettelse på "Om os" ("Selve pakken sender I selv").
- **Ingen "—" (lang tankestreg):** alle forekomster i begge siders synlige tekst (og kodekommentarer) er erstattet med almindelig tegnsætning, da tegnet ofte opfattes som et AI-fingeraftryk.
- **"Escrow" fjernet som ord:** byt-handlen forklares nu i almindeligt dansk ("byt&leg holder hånden under handlen / holder balancen"). Skjold-ikonet med teksten "Escrow" i midten af byt-diagrammet er erstattet af en rund hvid boble med byt&leg-logoet (`Mark09`).
- **AI-billedtjek tilføjet:** nyt AI-kort der forklarer at systemet automatisk opdager mennesker/børn på et billede og afviser opslaget (privatliv/sikkerhed). Det femte kort spænder over fuld bredde på desktop, så grid'et forbliver balanceret.
