# Hjælpecenter + AI-hjælp — brainstorm & plan

Inspireret af Vinted's "Hjælp"-center og "Din guide til Vinted". Målet: et omfangsrigt,
søgbart bibliotek af hjælpeartikler, tilgængeligt fra profilen, plus den eksisterende
AI-support tænkt ind som en integreret del.

## Den bærende idé: ÉN indholdskilde → to overflader

I dag vedligeholdes AI'ens viden i hånden i `lib/support-knowledge.js`, adskilt fra det
brugerne kan læse på `/hvordan` og `/kontakt`. Det betyder dobbeltarbejde og risiko for
at de kommer ud af sync.

Forslaget: hjælpeartiklerne i `lib/help-content.js` bliver den fælles kilde, der både
viser hjælpecentret OG (i en senere fase) fodrer support-AI'en. Ét sted at opdatere.

```
lib/help-content.js  ──►  /hjaelp (hjælpecenter, det brugeren læser)
                     └──►  support-AI (kundebot + admin-svarassistent)   [fase 2]
```

## Hvad der er bygget i denne første version (fase 1)

- **`lib/help-content.js`** — struktureret indholdsbibliotek: 7 kategorier, ~28 artikler,
  alt grundet i de verificerede fakta (ingen gæt, ingen løfter om ting der ikke findes).
  Eksporterer også `GUIDE_STEPS`, `POPULAR_SLUGS` og søge-/opslagsfunktioner.
- **`/hjaelp`** — hjælpecenter-forside: søgning, "Din guide til byt&leg" (7-trins sti),
  kategori-grid, populære artikler og en AI-assistent-CTA der åbner chat-boblen.
- **`/hjaelp/[category]`** — kategoriside med artikler + genveje til andre emner.
- **`/hjaelp/artikel/[slug]`** — artikelside med blok-renderer, "Var dette en hjælp?"
  og relaterede artikler.
- **`/hjaelp/soeg?q=`** — søgeresultater (klient-side søgning i biblioteket).
- **`components/HelpUI.js`** — delte byggesten (søgefelt, hero, brødkrumme, blok-renderer).
- **Profil** — "Hjælp & vejledning" → "Hjælpecenter" peger nu på `/hjaelp` (mobil + desktop).
- **AI** — `/hjaelp` tilføjet til AI'ens godkendte link-liste, så botten kan henvise dertil.

Bevidst holdt simpelt: indhold ligger i kode (versioneret, hurtigt, ingen DB endnu).

## Næste skridt — til diskussion

### Fase 2 — AI'en og hjælpecentret smelter sammen
- **Fælles kilde:** lad support-botten trække på `help-content.js` i stedet for (eller
  oven i) den håndskrevne `SUPPORT_FACTS`. Evt. via embeddings/RAG, så botten finder den
  rette artikel og kan linke til `/hjaelp/artikel/[slug]` i sit svar.
- **"Relaterede artikler" i chatten:** når botten svarer, vis 1-2 artikel-kort.
- **Genbrug escalations-loggen:** `support_bot_escalations` viser, hvad folk spørger om,
  som botten ikke kunne svare på → en backlog over hvilke artikler der mangler.

### Fase 3 — Personlig "Din guide til byt&leg"
- Gør guiden til en levende tjekliste med faktisk fremdrift (Vinted-stil):
  konto godkendt ✓, app installeret ✓, første opslag oprettet ✓, første handel ✓.
  Data findes allerede i profilen (opslag, handler, notifikationer).

### Fase 4 — Redigerbart indhold (når omfanget vokser)
- Flyt artikler til en Supabase-tabel + admin-UI, så ikke-tekniske kan redigere uden deploy.
- "Var dette en hjælp?"-feedback logges, så I kan se hvilke artikler der skal forbedres.

## Spørgsmål til dig (Mustapha)
1. Skal hjælpecentret afløse `/hvordan` og `/kontakt`, eller leve ved siden af dem?
   (Lige nu lever de side om side; `/hvordan` linkes fra forsiden af `/hjaelp`.)
2. Skal AI'en på sigt svare ud fra hjælpeartiklerne (fase 2), eller holde de to adskilt?
3. Skal "Din guide" vise rigtig fremdrift pr. institution (fase 3)?
4. Er der emner/spørgsmål I oftest får i support, som mangler en artikel?
