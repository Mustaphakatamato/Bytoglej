-- ============================================================
--  byt&leg — Nulstil opslag og indsæt demo-data med kategorier
--  Kør i Supabase SQL Editor
-- ============================================================

-- 1. Ryd eksisterende opslag (cascade sletter relaterede samtaler/beskeder)
DELETE FROM chat_messages WHERE conversation_id IN (
  SELECT id FROM conversations WHERE listing_id IS NOT NULL
);
DELETE FROM conversations WHERE listing_id IS NOT NULL;
DELETE FROM listings;

-- 2. Indsæt nye demo-opslag med kategorier
INSERT INTO listings
  (title, type, price, min_bid, age_group, description, condition, emoji, color, tags, images, is_active, institution_name, city, category, subcategory, created_at)
VALUES

-- ── LEGETØJ › Konstruktion & Klodser ──────────────────────────────────────────
(
  'LEGO DUPLO samling – ca. 400 klodser',
  'køb', 350, NULL, '1-3 år',
  'En stor blanding af DUPLO-klodser i mange farver og former. Inkluderer biler, dyr og figurer. Alt er vasket og klar til ny institution.',
  'Meget god', '🧱', '#CFE3D8',
  ARRAY['LEGO','Byggeleg','Konstruktion'],
  ARRAY[]::text[], true,
  'Solstrålen Børnehave', 'Aarhus',
  'legetoj', 'Konstruktion & Klodser',
  NOW() - INTERVAL '1 day'
),
(
  'LEGO Classic kreativitetskasser × 4',
  'byd', NULL, 100, '3-6 år',
  'Fire store Classic-kasser med blandede klodser. Masser af mursten, tage og specialbrikker. Afgiv et bud – tages gerne samlet.',
  'God', '🧱', '#F1C44B',
  ARRAY['LEGO','Byggeleg','Kreativ'],
  ARRAY[]::text[], true,
  'Regnbuen SFO', 'København',
  'legetoj', 'Konstruktion & Klodser',
  NOW() - INTERVAL '2 days'
),
(
  'Kapla-klodser – 200 stk i trækasse',
  'køb', 480, NULL, '3-6 år',
  'Naturfarvet Kapla-plankelegetøj i original trækasse. Fantastisk til konstruktionsleg og motorik. Ingen brud eller splinter.',
  'Meget god', '🪵', '#F3D7D0',
  ARRAY['Byggeleg','Konstruktion','Pædagogisk','Motorik'],
  ARRAY[]::text[], true,
  'Skovbørnehaven', 'Odense',
  'legetoj', 'Konstruktion & Klodser',
  NOW() - INTERVAL '3 days'
),

-- ── LEGETØJ › Dukker & Bløddyr ────────────────────────────────────────────────
(
  'Bamser og bløddyr – stor pose (ca. 25 stk)',
  'byt', NULL, NULL, '0-1 år',
  'Assorteret samling bamser og bløddyr. Alle vasket ved 60°. Forskellige størrelser fra håndpalme til mellemstor. Bytter gerne mod andet sensorisk legetøj.',
  'God', '🧸', '#F3D7D0',
  ARRAY['Motorik','Sanselegetøj'],
  ARRAY[]::text[], true,
  'Havnens Vuggestue', 'Esbjerg',
  'legetoj', 'Dukker & Bløddyr',
  NOW() - INTERVAL '4 days'
),
(
  'Dukker med tøj og tilbehør – 8 stk',
  'køb', 200, NULL, '3-6 år',
  'Otte plastikdukker med skiftetøj, flaske og kam. Velegnede til rolleleg og dukkelege. Let slid på tøjet, dukkerne er hele.',
  'God', '🪆', '#E8F1EC',
  ARRAY['Rollespil'],
  ARRAY[]::text[], true,
  'Stjerneskolen', 'Aalborg',
  'legetoj', 'Dukker & Bløddyr',
  NOW() - INTERVAL '5 days'
),

-- ── LEGETØJ › Biler & Køretøjer ───────────────────────────────────────────────
(
  'Kasse med biler og køretøjer – 40+ stk',
  'byd', NULL, 75, '1-3 år',
  'Stor kasse med blandede biler: matchbox, større plasticbiler, ambulance, brandbil og traktorer. Noget er fra LEGO Duplo. Byd hvad du synes.',
  'Acceptabel', '🚗', '#6EA8D4',
  ARRAY['Biler','Konstruktion'],
  ARRAY[]::text[], true,
  'Mariehønen Børnehave', 'Randers',
  'legetoj', 'Biler & Køretøjer',
  NOW() - INTERVAL '6 days'
),
(
  'Wooden Ways togbane med 3 tog og tilbehør',
  'køb', 390, NULL, '1-3 år',
  'Komplet togbane i træ (ikke BRIO-mærket, men kompatibelt). Ca. 60 sporelementer, 3 lokomotiver, broer og stationer. Komplet og funktionelt.',
  'Meget god', '🚂', '#CFE3D8',
  ARRAY['Trælegetøj','Byggeleg','Pædagogisk'],
  ARRAY[]::text[], true,
  'Solstrålen Børnehave', 'Aarhus',
  'legetoj', 'Biler & Køretøjer',
  NOW() - INTERVAL '7 days'
),

-- ── LEGETØJ › Puslespil ───────────────────────────────────────────────────────
(
  'Puslespil 25–100 brikker – 10 stk',
  'køb', 120, NULL, '3-6 år',
  'Blanding af puslespil i god stand. 2 er 100-briks, resten er 25-48 brikker. Alle komplet – talt op. Emner: dyr, havet, dinosaurer og køretøjer.',
  'God', '🧩', '#F1C44B',
  ARRAY['Puslespil','Pædagogisk'],
  ARRAY[]::text[], true,
  'Regnbuen SFO', 'København',
  'legetoj', 'Puslespil',
  NOW() - INTERVAL '8 days'
),

-- ── LEGETØJ › Rollespil & Figurer ─────────────────────────────────────────────
(
  'Rollespilskøkken med tilbehør',
  'byt', NULL, NULL, '3-6 år',
  'Træ-legekøkken med komfur, ovn og opvaskemaskine. Inkluderer 2 kasser plastic-madvarer. Bytter gerne mod udendørslegetøj eller cykler.',
  'God', '🍳', '#F3D7D0',
  ARRAY['Rollespil','Køkkenlege'],
  ARRAY[]::text[], true,
  'Skovbørnehaven', 'Odense',
  'legetoj', 'Rollespil & Figurer',
  NOW() - INTERVAL '9 days'
),

-- ── UDENDØRS › Cykler & Løbecykler ───────────────────────────────────────────
(
  'Puky løbecykler × 3 (12-tommer)',
  'køb', 750, NULL, '1-3 år',
  'Tre Puky LRM-løbecykler. To i rød, en i blå. Alle med justérbart sæde og styr. Sæder og dæk er i fin stand. Sælges samlet eller enkeltvis (275 kr/stk).',
  'Meget god', '🚲', '#E8593D',
  ARRAY['Cykler','Motorik','Udeleg'],
  ARRAY[]::text[], true,
  'Stjerneskolen', 'Aalborg',
  'udendoers', 'Cykler & Løbecykler',
  NOW() - INTERVAL '10 days'
),
(
  'Børnecykler med støttehjul × 2',
  'byd', NULL, 150, '3-6 år',
  'To børnecykler, 14-tommer. Den ene er pink, den anden grøn. Begge med støttehjul og ringeklokke. Kæder er smurt. Let rust på stel men funktionelt.',
  'Acceptabel', '🚲', '#CFE3D8',
  ARRAY['Cykler','Udeleg','Motorik'],
  ARRAY[]::text[], true,
  'Havnens Vuggestue', 'Esbjerg',
  'udendoers', 'Cykler & Løbecykler',
  NOW() - INTERVAL '11 days'
),

-- ── UDENDØRS › Sandkasse & Vandleg ───────────────────────────────────────────
(
  'Sandkasselegetøj – komplet æske',
  'byt', NULL, NULL, '1-3 år',
  'Stor æske med former, spande, skovle og vand­hjul. Ca. 30 dele i lyse farver. Bytter gerne mod bøger eller kreativitetsmaterialer.',
  'God', '🏖️', '#F1C44B',
  ARRAY['Sandkasse','Udeleg'],
  ARRAY[]::text[], true,
  'Mariehønen Børnehave', 'Randers',
  'udendoers', 'Sandkasse & Vandleg',
  NOW() - INTERVAL '12 days'
),

-- ── UDENDØRS › Boldspil & Kasteredskaber ──────────────────────────────────────
(
  'Bolde i alle størrelser – 10 stk',
  'byt', NULL, NULL, '3-6 år',
  'Ti bolde: 4 fodbold, 2 basketball, 2 skumbolde og 2 mini-bolde. Alle pumpede og i god stand. Bytter gerne mod konstruktionslegetøj.',
  'Meget god', '⚽', '#2A7D4F',
  ARRAY['Sport','Udeleg','Motorik'],
  ARRAY[]::text[], true,
  'Solstrålen Børnehave', 'Aarhus',
  'udendoers', 'Boldspil & Kasteredskaber',
  NOW() - INTERVAL '13 days'
),

-- ── KREATIVITET › Tegning & Maleri ────────────────────────────────────────────
(
  'Farveblyanter, tusser og vandfarver – storpakke',
  'køb', 140, NULL, '3-6 år',
  '6 sæt farveblyanter (Faber-Castell), 4 æsker tusser og 8 sæt vandfarver. Størstedelen ubrugte eller meget lidt brugt. Perfekt opstart for en ny gruppe.',
  'Ny', '🎨', '#F3D7D0',
  ARRAY['Kreativ','Tegning'],
  ARRAY[]::text[], true,
  'Regnbuen SFO', 'København',
  'kreativitet', 'Tegning & Maleri',
  NOW() - INTERVAL '14 days'
),
(
  'Staffelier til børn × 5 (bord-model)',
  'byd', NULL, 60, '3-6 år',
  'Fem bordstaffeliers i plastik med clips. Justérbare. Brugt men funktionelle – nogen har maling på klemmen. Sælges samlet.',
  'Acceptabel', '🖼️', '#ECE6DA',
  ARRAY['Kreativ','Tegning','Pædagogisk'],
  ARRAY[]::text[], true,
  'Skovbørnehaven', 'Odense',
  'kreativitet', 'Tegning & Maleri',
  NOW() - INTERVAL '15 days'
),

-- ── KREATIVITET › Ler & Modellering ──────────────────────────────────────────
(
  'Modellervoks og legetøjsler – 15 pakker',
  'køb', 95, NULL, '3-6 år',
  'Blanding af Play-Doh og lignende legetøjsler. 10 pakker er uåbnede, 5 er brugt men bløde og brugbare. Mange farver.',
  'God', '🏺', '#CFE3D8',
  ARRAY['Kreativ','Motorik'],
  ARRAY[]::text[], true,
  'Stjerneskolen', 'Aalborg',
  'kreativitet', 'Ler & Modellering',
  NOW() - INTERVAL '16 days'
),

-- ── KREATIVITET › Perler & Smykker ────────────────────────────────────────────
(
  'Hama-perler storpakke + 12 perlebræt',
  'byt', NULL, NULL, '6-10 år',
  'Ca. 20.000 Hama-perler i original opbevaringsboks sorteret efter farve. Inkluderer 12 perlebræt i forskellige former. Bytter mod sport- eller udendørslegetøj.',
  'Meget god', '✨', '#6EA8D4',
  ARRAY['Kreativ','Pædagogisk'],
  ARRAY[]::text[], true,
  'Mariehønen Børnehave', 'Randers',
  'kreativitet', 'Perler & Smykker',
  NOW() - INTERVAL '17 days'
),

-- ── BØGER & SPIL › Billedbøger ────────────────────────────────────────────────
(
  'Billedbøger dansk – 35 stk',
  'byd', NULL, 50, '0-1 år',
  'Stor samling danske billedbøger: Ole Lund Kirkegaard, Halfdan Rasmussen og moderne forfattere. Alle i god stand, ingen løse sider. Byd hvad du synes.',
  'God', '📚', '#F1C44B',
  ARRAY['Bøger','Pædagogisk'],
  ARRAY[]::text[], true,
  'Solstrålen Børnehave', 'Aarhus',
  'boeger-spil', 'Billedbøger',
  NOW() - INTERVAL '18 days'
),

-- ── BØGER & SPIL › Brætspil & Kortspil ──────────────────────────────────────
(
  'Brætspil samling – 10 klassikere',
  'køb', 280, NULL, '6-10 år',
  'Pakken inkluderer: Matador (komplet), Ludo × 2, Uno × 3, Memory (dyr-tema), Snakes & Ladders og Tæl til 10. Alt er gennemtalt og komplet.',
  'Meget god', '🎲', '#E8F1EC',
  ARRAY['Brætspil','Pædagogisk'],
  ARRAY[]::text[], true,
  'Regnbuen SFO', 'København',
  'boeger-spil', 'Brætspil & Kortspil',
  NOW() - INTERVAL '19 days'
),

-- ── MØBLER & OPBEVARING › Hylder & Reoler ─────────────────────────────────────
(
  'IKEA TROFAST opbevaringssystem med 8 kasser',
  'køb', 750, NULL, '3-6 år',
  'Stort TROFAST-reolsystem i hvid/træ med 8 plastikkasser i blanding af farver. Samlet mål: 99×44×94 cm. Skal afhentes – kan evt. leveres mod betaling.',
  'God', '🪣', '#DAD3C4',
  ARRAY['Møbler','Pædagogisk'],
  ARRAY[]::text[], true,
  'Skovbørnehaven', 'Odense',
  'mobler', 'Opbevaringskasser',
  NOW() - INTERVAL '20 days'
),
(
  'Lave borde og stole til børn – 2 sæt (8 stole)',
  'byd', NULL, 200, '3-6 år',
  'To rektangulære borde (120×60 cm) i bøg med justerbare ben til 46–64 cm. Otte tilhørende stole. Sættet er fra Haba. Lettere ridser men stabilt.',
  'God', '🪑', '#CFE3D8',
  ARRAY['Møbler'],
  ARRAY[]::text[], true,
  'Stjerneskolen', 'Aalborg',
  'mobler', 'Borde & Stole',
  NOW() - INTERVAL '21 days'
),
(
  'Legetelt og hule-sæt (tunnel + telt)',
  'byt', NULL, NULL, '1-3 år',
  'Foldbart legetelt (kaninform) + krybetunnel i rød/gul. Begge i god stand og let at folde. Bytter gerne mod sanglege-, rytmik- eller musiklegetøj.',
  'Meget god', '🏕️', '#F3D7D0',
  ARRAY['Rollespil','Motorik'],
  ARRAY[]::text[], true,
  'Havnens Vuggestue', 'Esbjerg',
  'mobler', 'Telte & Hytter',
  NOW() - INTERVAL '22 days'
),

-- ── KOSTUMER & DRAMA ─────────────────────────────────────────────────────────
(
  'Udklædningstøj og kostumer – 20 stk',
  'køb', 320, NULL, '3-6 år',
  'Stor kurv med kostumer: prinsesse, ridder, superhelt, dyr (løve, kanin, ko) og erhverv (læge, kok, politibetjent). Alle vasket og klar. Inkl. hatte og tilbehør.',
  'God', '🎭', '#6EA8D4',
  ARRAY['Kostumer','Rollespil'],
  ARRAY[]::text[], true,
  'Mariehønen Børnehave', 'Randers',
  'kostumer', 'Udklædning & Kostumer',
  NOW() - INTERVAL '23 days'
),
(
  'Hånddukker og fingerdukker – teater-sæt',
  'byt', NULL, NULL, '3-6 år',
  '12 hånddukker (dyr og eventyrfigurer) + 20 fingerdukker. Medfølger lille pop-up dukke­teaterscene i karton. Bytter mod puslespil eller brætspil.',
  'Meget god', '🎪', '#F1C44B',
  ARRAY['Rollespil','Kostumer','Pædagogisk'],
  ARRAY[]::text[], true,
  'Solstrålen Børnehave', 'Aarhus',
  'kostumer', 'Dukketeater',
  NOW() - INTERVAL '24 days'
),

-- ── MUSIK ─────────────────────────────────────────────────────────────────────
(
  'Rytmeinstrumenter og slagtøj – klassesæt (22 stk)',
  'køb', 550, NULL, '3-6 år',
  'Komplet klassesæt: 6 maracas, 4 triangler m/pind, 4 kastagnetter, 4 tamburiner og 4 xylofoner. Mærkevare (Goldon). Alle i original stand, lidt brugt.',
  'Meget god', '🥁', '#E8F1EC',
  ARRAY['Musik','Rytmik','Pædagogisk'],
  ARRAY[]::text[], true,
  'Regnbuen SFO', 'København',
  'musik', 'Slagtøj & Rytmeinstrumenter',
  NOW() - INTERVAL '25 days'
),

-- ── SPORT & MOTORIK ───────────────────────────────────────────────────────────
(
  'Gymnastikmåtter 140×60 cm × 8 stk',
  'køb', 900, NULL, '3-6 år',
  'Otte blå gymnastikmåtter i skumgummi, 3 cm tykke. Brugt men rene og uden rifter. Perfekte til morgengymnastik, yoga eller legestue-aktiviteter. Kan afhentes i Vejle.',
  'God', '🧘', '#CFE3D8',
  ARRAY['Sport','Motorik','Pædagogisk'],
  ARRAY[]::text[], true,
  'Skovbørnehaven', 'Vejle',
  'sport-motorik', 'Gymnastikmåtter & Puder',
  NOW() - INTERVAL '26 days'
),
(
  'Balancebræt, balancepuder og motorikbane',
  'byt', NULL, NULL, '1-3 år',
  '2 træbalancebræt (Gonge), 5 luftpuder i blandet form og et komplet sæt motorikbane-elementer (tunnel, rampe, trin). Bytter mod kreativitetsmat., kostumer eller brætspil.',
  'Meget god', '⚖️', '#F1C44B',
  ARRAY['Motorik','Sport','Pædagogisk'],
  ARRAY[]::text[], true,
  'Stjerneskolen', 'Aalborg',
  'sport-motorik', 'Balance & Koordination',
  NOW() - INTERVAL '27 days'
),

-- ── BABY & SMÅBØRN ────────────────────────────────────────────────────────────
(
  'Sensorisk legetøj til vuggestue – sæt (15 dele)',
  'køb', 320, NULL, '0-1 år',
  'Sæt til 0–18 måneder: rangle, bidsering, aktivitetsspejl, softbog, stofkubus og aktivitetsklokke. Alle materialer godkendt og CE-mærkede. Vasket og klar.',
  'Meget god', '🔔', '#F3D7D0',
  ARRAY['Motorik','Sanselegetøj','Pædagogisk'],
  ARRAY[]::text[], true,
  'Havnens Vuggestue', 'Esbjerg',
  'baby', 'Sanselegetøj',
  NOW() - INTERVAL '28 days'
),
(
  'Aktivitetsbord og gulvlegetøj (0–18 mdr)',
  'byd', NULL, 100, '0-1 år',
  'VTech aktivitetsbord med lyde og lys (AA-batterier). Medfølger 3 aktivitetstæpper og en boksebold. Alt virker. Byd hvad du synes.',
  'God', '🧒', '#E8F1EC',
  ARRAY['Sanselegetøj','Motorik','Elektronisk legetøj'],
  ARRAY[]::text[], true,
  'Mariehønen Børnehave', 'Randers',
  'baby', 'Aktivitetslegetøj 1-3 år',
  NOW() - INTERVAL '29 days'
);

-- ── Bekræft ──────────────────────────────────────────────────────────────────
SELECT
  category,
  subcategory,
  COUNT(*) AS antal,
  STRING_AGG(type, ', ') AS typer
FROM listings
GROUP BY category, subcategory
ORDER BY category, subcategory;
