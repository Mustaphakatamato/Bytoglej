-- ============================================================
-- RESET TEST LISTINGS WITH IMAGES
-- Kør i Supabase SQL Editor
-- ============================================================

-- 1. Ryd eksisterende testdata
DELETE FROM messages WHERE conversation_id IN (
  SELECT id FROM conversations WHERE listing_id IN (
    SELECT id FROM listings WHERE institution_name ILIKE '%test%'
      OR institution_name IN (
        'Solsikken Børnehave','Regnbuen SFO','Egebjerget Børnehus',
        'Skovstjernen Børnehave','Bølgebryderen SFO','Mariehønen Vuggestue',
        'Lindegården Børnehave','Havbrisens SFO','Kærgårdens Børnehus',
        'Stjernedrys Børnehave'
      )
  )
);
DELETE FROM conversations WHERE listing_id IN (
  SELECT id FROM listings WHERE institution_name IN (
    'Solsikken Børnehave','Regnbuen SFO','Egebjerget Børnehus',
    'Skovstjernen Børnehave','Bølgebryderen SFO','Mariehønen Vuggestue',
    'Lindegården Børnehave','Havbrisens SFO','Kærgårdens Børnehus',
    'Stjernedrys Børnehave'
  )
);
DELETE FROM listings WHERE institution_name IN (
  'Solsikken Børnehave','Regnbuen SFO','Egebjerget Børnehus',
  'Skovstjernen Børnehave','Bølgebryderen SFO','Mariehønen Vuggestue',
  'Lindegården Børnehave','Havbrisens SFO','Kærgårdens Børnehus',
  'Stjernedrys Børnehave'
);

-- 2. Indsæt 30 opslag med billeder
INSERT INTO listings
  (title, type, price, min_bid, age_group, description, condition, emoji, color,
   tags, images, is_active, institution_name, city, category, subcategory,
   fav_count, bid_count, created_at)
VALUES

-- ── LEGETØJ ──────────────────────────────────────────────────────────────

(
  'LEGO DUPLO stor kasse – 180 klodser',
  'køb', 350, NULL, '3-6 år',
  'Stor samling DUPLO i mange farver og former. Inkluderer biler, dyr og figurer. Alt er vasket og klar til ny institution. Perfekt til finmotorik og kreativ leg.',
  'God',
  '🧱', '#FFD166',
  ARRAY['LEGO','Konstruktion'],
  ARRAY[
    'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1608889825103-eb5ed706fc64?w=600&h=450&fit=crop'
  ],
  true, 'Solsikken Børnehave', 'Aarhus', 'legetoj', 'Konstruktionslegetøj',
  4, 0, NOW() - INTERVAL '1 day'
),

(
  'Bamser og bløde dyr – stor pose',
  'byt', NULL, NULL, '0-3 år',
  'Ca. 15 bløde bamser og dyr i god stand. Alle er vasket ved 60 grader. Størrelser fra 20-40 cm. Gode til myldretid og sovestund.',
  'Meget god',
  '🧸', '#F4A261',
  ARRAY['Bamser','Blød legetøj'],
  ARRAY[
    'https://images.unsplash.com/photo-1559454403-b8fb88521f11?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&h=450&fit=crop'
  ],
  true, 'Regnbuen SFO', 'København', 'legetoj', 'Bamser & blødt legetøj',
  7, 0, NOW() - INTERVAL '2 days'
),

(
  'Trælegetøj sæt – køkken og madvarer',
  'køb', 280, NULL, '1-3 år',
  'Smukt trælegetøj-køkken med tilhørende madvarer. Alt i massivt træ, malet med sikre farver. Ingen brud eller manglende dele. Fremmer rolleleg og fantasi.',
  'Meget god',
  '🍳', '#E9C46A',
  ARRAY['Trælegetøj','Rolleleg'],
  ARRAY[
    'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600&h=450&fit=crop'
  ],
  true, 'Egebjerget Børnehus', 'Odense', 'legetoj', 'Rolleleg & dukker',
  5, 0, NOW() - INTERVAL '3 days'
),

(
  'Legoklodser Classic – 500+ styk',
  'byd', NULL, 200, '6-10 år',
  'Stor kasse klassiske LEGO-klodser i alle farver. Sorteret og talt — ca. 520 styk. Ingen sæt, bare klodser. Fremmer kreativitet og problemløsning.',
  'God',
  '🔴', '#E63946',
  ARRAY['LEGO','Konstruktion'],
  ARRAY[
    'https://images.unsplash.com/photo-1585366119132-9e9d4e04df57?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=450&fit=crop'
  ],
  true, 'Skovstjernen Børnehave', 'Aalborg', 'legetoj', 'Konstruktionslegetøj',
  9, 3, NOW() - INTERVAL '4 days'
),

(
  'Bilbane med 6 biler',
  'køb', 195, NULL, '3-6 år',
  'Komplet bilbane med løkker og ramper. Inkluderer 6 racerbiler. Alle dele medfølger. Tidtest viser at biler kører rigtigt rundt. Let skuffemærke på én bil.',
  'Acceptabel',
  '🏎️', '#2A9D8F',
  ARRAY['Biler','Baner'],
  ARRAY[
    'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1581235720704-06d3acfcb36f?w=600&h=450&fit=crop'
  ],
  true, 'Bølgebryderen SFO', 'Esbjerg', 'legetoj', 'Biler & køretøjer',
  2, 0, NOW() - INTERVAL '5 days'
),

-- ── UDENDØRS ─────────────────────────────────────────────────────────────

(
  'Løbecykler × 4 – passer 2-4 år',
  'køb', 600, NULL, '1-3 år',
  '4 løbecykler i god stand. Sæder justeret til 2-4 årige. Dækkene har luft og styret er strammet. Vi har købt ny flåde og disse er til salg samlet.',
  'God',
  '🚲', '#2A7D4F',
  ARRAY['Cykel','Motorik'],
  ARRAY[
    'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=600&h=450&fit=crop'
  ],
  true, 'Mariehønen Vuggestue', 'Randers', 'udendoers', 'Cykler & køretøjer',
  11, 0, NOW() - INTERVAL '6 days'
),

(
  'Sandlegetøj – stor spand med alt',
  'byt', NULL, NULL, '1-6 år',
  'Komplet sæt sandlegetøj: spande, skovle, forme, si og vandhjul. Ca. 30 dele i alt. Skyllet og klar. Bytter gerne til vandlegetøj eller bolde.',
  'God',
  '🏖️', '#F4D03F',
  ARRAY['Sand','Udeliv'],
  ARRAY[
    'https://images.unsplash.com/photo-1619451334792-150fd785ee74?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1560717845-968823efbee1?w=600&h=450&fit=crop'
  ],
  true, 'Lindegården Børnehave', 'Vejle', 'udendoers', 'Sandlegetøj',
  3, 0, NOW() - INTERVAL '7 days'
),

(
  'Boldkasse – 20 blandede bolde',
  'køb', 150, NULL, '3-10 år',
  '20 bolde i alle størrelser: fodbold, basketball, tennisbolde og bløde skumbolde. Alle oppustede og i god stand. Medfølger opbevaringskasse.',
  'God',
  '⚽', '#F97316',
  ARRAY['Bolde','Sport'],
  ARRAY[
    'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=600&h=450&fit=crop'
  ],
  true, 'Havbrisens SFO', 'Kolding', 'udendoers', 'Bolde & sportsudstyr',
  6, 0, NOW() - INTERVAL '8 days'
),

(
  'Hoppepude stor – 120×80 cm',
  'byd', NULL, 300, '3-10 år',
  'Stor hoppepude/trampolin til indendørs brug. Maks 50 kg. Sikkerhedsnet medfølger. Brugt i 2 år, ingen huller eller defekter. Pumpe medfølger.',
  'God',
  '🤸', '#8B5CF6',
  ARRAY['Motorik','Bevægelse'],
  ARRAY[
    'https://images.unsplash.com/photo-1566125882500-87e10f726cdc?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=600&h=450&fit=crop'
  ],
  true, 'Kærgårdens Børnehus', 'Herning', 'udendoers', 'Bolde & sportsudstyr',
  8, 2, NOW() - INTERVAL '9 days'
),

-- ── KREATIVITET ───────────────────────────────────────────────────────────

(
  'Malekasser – 8 komplette sæt',
  'køb', 240, NULL, '3-10 år',
  '8 plastikmalekasser med vandfarver, pensler og palette. Alle komplet. Bruges i kunstprojekter. Vandfarver er delvist brugt men stadig rigeligt.',
  'God',
  '🎨', '#E91E63',
  ARRAY['Maling','Kunst'],
  ARRAY[
    'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&h=450&fit=crop'
  ],
  true, 'Stjernedrys Børnehave', 'Silkeborg', 'kreativitet', 'Maling & tegning',
  4, 0, NOW() - INTERVAL '10 days'
),

(
  'Perleplade sæt – kæmpe samling',
  'køb', 180, NULL, '6-10 år',
  'Over 20.000 Hama-perler i 30 farver sorteret i boks. Inkluderer 15 plader i forskellige former. Komplet med strygepapir. Populær aktivitet hos os.',
  'Meget god',
  '🔵', '#3B82F6',
  ARRAY['Perler','Finmotorik'],
  ARRAY[
    'https://images.unsplash.com/photo-1567225557594-88d73e55f2cb?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&h=450&fit=crop'
  ],
  true, 'Solsikken Børnehave', 'Aarhus', 'kreativitet', 'Håndværk & hobby',
  12, 0, NOW() - INTERVAL '11 days'
),

(
  'Lertøj og modellervoks – arbejdssæt',
  'byt', NULL, NULL, '3-10 år',
  'Sæt til keramik og modellering: 5 kg luft-tørrende ler, 10 pakker modellervoks, rullepinde, udstikker og redskaber. Bytter til kreative materialer.',
  'God',
  '🏺', '#D97706',
  ARRAY['Ler','Kreativitet'],
  ARRAY[
    'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1590159983013-d4fe899a3c12?w=600&h=450&fit=crop'
  ],
  true, 'Regnbuen SFO', 'København', 'kreativitet', 'Ler & modellering',
  3, 0, NOW() - INTERVAL '12 days'
),

-- ── BØGER & SPIL ──────────────────────────────────────────────────────────

(
  'Billedbøger – 40 stk til 3-6 år',
  'køb', 200, NULL, '3-6 år',
  '40 børnebøger i hardback, alle på dansk. Blandede forfattere og temaer: dyr, eventyr, venskab. Alle uden manglende sider. Rengøring og vedligeholdelse er sket.',
  'God',
  '📚', '#10B981',
  ARRAY['Bøger','Læsning'],
  ARRAY[
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&h=450&fit=crop'
  ],
  true, 'Egebjerget Børnehus', 'Odense', 'boeger-spil', 'Billedbøger',
  7, 0, NOW() - INTERVAL '13 days'
),

(
  'Brætspil samling – 12 spil',
  'køb', 320, NULL, '6-10 år',
  '12 velkendte brætspil: Ludo, Matador, Uno, Jenga, Connect 4, Tælle-spil m.fl. Alle komplete med alle brikker. Opbevaret i tør og ren tilstand.',
  'Meget god',
  '🎲', '#7C3AED',
  ARRAY['Brætspil','Strategi'],
  ARRAY[
    'https://images.unsplash.com/photo-1606503153255-59d8b8b82176?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1611371805429-8b5c1b2c34ba?w=600&h=450&fit=crop'
  ],
  true, 'Skovstjernen Børnehave', 'Aalborg', 'boeger-spil', 'Brætspil',
  5, 0, NOW() - INTERVAL '14 days'
),

(
  'Puslespil 20-100 brikker – 15 stk',
  'byt', NULL, NULL, '3-6 år',
  '15 puslespil fra 20 til 100 brikker. Alle komplete — vi tæller altid inden vi giver videre. Temaer: dyr, køretøjer, eventyrfigurer. Klar til brug.',
  'God',
  '🧩', '#F59E0B',
  ARRAY['Puslespil','Koncentration'],
  ARRAY[
    'https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1509909756405-be0199881695?w=600&h=450&fit=crop'
  ],
  true, 'Bølgebryderen SFO', 'Esbjerg', 'boeger-spil', 'Puslespil',
  6, 0, NOW() - INTERVAL '15 days'
),

-- ── MØBLER ───────────────────────────────────────────────────────────────

(
  'Børneborde og stole – 4 sæt',
  'køb', 800, NULL, '3-6 år',
  '4 runde børneborde (ø 80 cm) med tilhørende 4 stole hver. Laminat-top i grøn og blå. Alle justérbare ben. Udskiftes pga. flytning til nyt lokale.',
  'God',
  '🪑', '#6B7280',
  ARRAY['Møbler','Borde'],
  ARRAY[
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&h=450&fit=crop'
  ],
  true, 'Mariehønen Vuggestue', 'Randers', 'mobler', 'Borde & stole',
  3, 0, NOW() - INTERVAL '16 days'
),

(
  'Bogreol med kasser – IKEA Kallax',
  'køb', 450, NULL, '3-10 år',
  'IKEA Kallax 4×4 reol i hvid med 8 farverige opbevaringskasser. Perfekt til legetøjsopbevaring. Reolen er 147×147 cm. Samles gratis af os ved afhentning.',
  'Meget god',
  '📦', '#4B5563',
  ARRAY['Opbevaring','Møbler'],
  ARRAY[
    'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=450&fit=crop'
  ],
  true, 'Lindegården Børnehave', 'Vejle', 'mobler', 'Opbevaring & hylder',
  8, 0, NOW() - INTERVAL '17 days'
),

-- ── BABY & SMÅBØRN ────────────────────────────────────────────────────────

(
  'Aktivitetstæppe med buer',
  'køb', 175, NULL, '0-1 år',
  'Blødt aktivitetstæppe med to buer og 6 hængende legetøj. Maskinvaskbart. Tæppet er 90×90 cm med farverig print. Alle legetøj sidder fast og er sikkert.',
  'Meget god',
  '🍼', '#FBBF24',
  ARRAY['Baby','Motorik'],
  ARRAY[
    'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1587765566073-1e5acba89682?w=600&h=450&fit=crop'
  ],
  true, 'Havbrisens SFO', 'Kolding', 'baby', 'Aktivitetslegetøj',
  4, 0, NOW() - INTERVAL '18 days'
),

(
  'Gå-stol og babylegegulv sæt',
  'byd', NULL, 250, '0-1 år',
  'Stabilt gå-stol med aktivitetsbræt foran. Inkluderer skummåtte (150×120 cm) med farverige motiver. Alt rengjort og testet. CE-mærket og godkendt.',
  'God',
  '👶', '#34D399',
  ARRAY['Baby','Motorik'],
  ARRAY[
    'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1492725764893-90b379c2b6e7?w=600&h=450&fit=crop'
  ],
  true, 'Kærgårdens Børnehus', 'Herning', 'baby', 'Aktivitetslegetøj',
  5, 1, NOW() - INTERVAL '19 days'
),

-- ── KOSTUMER ─────────────────────────────────────────────────────────────

(
  'Udklædningskasse – 25 kostumer',
  'køb', 350, NULL, '3-10 år',
  '25 hele kostumer: prinsesser, superhelte, dyr, fagfolk (læge, brandmand m.fl.). Alle vasket ved 40°. Størrelser til 4-8 årige. Medfølger opbevaringskasse.',
  'God',
  '🎭', '#EC4899',
  ARRAY['Kostumer','Rolleleg'],
  ARRAY[
    'https://images.unsplash.com/photo-1576105924584-3e2ca1e4e2e8?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=450&fit=crop'
  ],
  true, 'Stjernedrys Børnehave', 'Silkeborg', 'kostumer', 'Heldragter',
  10, 0, NOW() - INTERVAL '20 days'
),

(
  'Dukketøj og tilbehør – stor pose',
  'byt', NULL, NULL, '3-6 år',
  'Stor pose med dukketøj til 30-40 cm dukker: kjoler, bukser, jakker og sko. Ca. 40 dele. Bytter gerne til andet rollelege-udstyr.',
  'God',
  '👗', '#F472B6',
  ARRAY['Dukker','Rolleleg'],
  ARRAY[
    'https://images.unsplash.com/photo-1561948955-570b270e7c36?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=450&fit=crop'
  ],
  true, 'Solsikken Børnehave', 'Aarhus', 'kostumer', 'Tilbehør & rekvisitter',
  3, 0, NOW() - INTERVAL '21 days'
),

-- ── MUSIK ────────────────────────────────────────────────────────────────

(
  'Rythme-instrumenter – klassesæt',
  'køb', 290, NULL, '1-10 år',
  '24 rytmeinstrumenter: maracas, tamburiner, triangler, kastagnetter og xylofoner. Alt til et helt hold. Alle fungerer. Opbevaret i mærkede kasser.',
  'God',
  '🎵', '#8B5CF6',
  ARRAY['Musik','Rytme'],
  ARRAY[
    'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=450&fit=crop'
  ],
  true, 'Regnbuen SFO', 'København', 'musik', 'Percussion & rytme',
  6, 0, NOW() - INTERVAL '22 days'
),

(
  'Keyboard – Casio 61 tangenter',
  'byd', NULL, 150, '6-10 år',
  'Casio CTK-2550 keyboard med 61 tangenter og 400 lyde. Strøm via ledning eller batterier. Noder og headphone-stik medfølger. Fungerer perfekt.',
  'Meget god',
  '🎹', '#1D4ED8',
  ARRAY['Keyboard','Musik'],
  ARRAY[
    'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=450&fit=crop'
  ],
  true, 'Egebjerget Børnehus', 'Odense', 'musik', 'Tangentinstrumenter',
  4, 2, NOW() - INTERVAL '23 days'
),

-- ── SPORT & MOTORIK ───────────────────────────────────────────────────────

(
  'Balancebræt og motorikbane',
  'køb', 480, NULL, '1-6 år',
  'Komplet motorikbane: 2 balancebrætter, 3 stepping stones, 1 tunnel og 1 klatrebue. Massivt FSC-certificeret træ. Kan bruges inde og ude.',
  'Meget god',
  '🏃', '#059669',
  ARRAY['Motorik','Balance'],
  ARRAY[
    'https://images.unsplash.com/photo-1575783970733-1aaedde1db74?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&h=450&fit=crop'
  ],
  true, 'Skovstjernen Børnehave', 'Aalborg', 'sport-motorik', 'Balance & motorik',
  9, 0, NOW() - INTERVAL '24 days'
),

(
  'Klatrevæg-sæt til indendørs brug',
  'byd', NULL, 600, '6-10 år',
  'Fri stående klatrevæg 1.8×1.2 m med 30 klatregreb i 3 sværhedsgrader. Sikkerhedsmåtte medfølger. Bruges i vores SFO men vi opgraderer til større.',
  'God',
  '🧗', '#7C3AED',
  ARRAY['Klatring','Sport'],
  ARRAY[
    'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1533107862482-0e6974b06ec4?w=600&h=450&fit=crop'
  ],
  true, 'Bølgebryderen SFO', 'Esbjerg', 'sport-motorik', 'Klatring & gymredskaber',
  7, 3, NOW() - INTERVAL '25 days'
),

(
  'Yogamåtter til børn – 12 stk',
  'køb', 240, NULL, '3-10 år',
  '12 farverige yogamåtter i mini-størrelse (150×60 cm). Skridsikker bagside. Brugt til bevægelse og afslapning. Alle rengjorte og rulle-klar.',
  'God',
  '🧘', '#10B981',
  ARRAY['Yoga','Bevægelse'],
  ARRAY[
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&h=450&fit=crop'
  ],
  true, 'Mariehønen Vuggestue', 'Randers', 'sport-motorik', 'Yoga & afslapning',
  5, 0, NOW() - INTERVAL '26 days'
),

-- ── EKSTRA OPSLAG ────────────────────────────────────────────────────────

(
  'Playmobil bondegård – komplet',
  'køb', 420, NULL, '3-6 år',
  'Stor Playmobil bondegårds-sæt med alle dyr, figurer og tilbehør. Komplet samling fra 3 sæt kombineret. Tæller 200+ dele. Alt er med.',
  'Meget god',
  '🐄', '#78716C',
  ARRAY['Playmobil','Rolleleg'],
  ARRAY[
    'https://images.unsplash.com/photo-1596460107916-430662021049?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=450&fit=crop'
  ],
  true, 'Lindegården Børnehave', 'Vejle', 'legetoj', 'Figurer & dukker',
  8, 0, NOW() - INTERVAL '27 days'
),

(
  'Vandtabel til udendørs brug',
  'byt', NULL, NULL, '1-6 år',
  'Stor vandtabel i plast, 100×60 cm med underbygning. Inkluderer vandhjul, kummer og forme. Bytter til sandlegetøj eller cykler.',
  'God',
  '💧', '#0EA5E9',
  ARRAY['Vand','Udeliv'],
  ARRAY[
    'https://images.unsplash.com/photo-1560717845-968823efbee1?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1619451334792-150fd785ee74?w=600&h=450&fit=crop'
  ],
  true, 'Havbrisens SFO', 'Kolding', 'udendoers', 'Vandlegetøj',
  4, 0, NOW() - INTERVAL '28 days'
),

(
  'Krea-kuffert – alt til projektuger',
  'køb', 380, NULL, '3-10 år',
  'Stor kuffert fyldt med kreativt materiale: karton, glitter, pailletter, lim, saks, tape, fjer, øjne og meget mere. Estimeret 500+ dele. Klar til et projekt.',
  'God',
  '✂️', '#F43F5E',
  ARRAY['Kreativitet','Kunst'],
  ARRAY[
    'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=600&h=450&fit=crop'
  ],
  true, 'Kærgårdens Børnehus', 'Herning', 'kreativitet', 'Håndværk & hobby',
  6, 0, NOW() - INTERVAL '29 days'
),

(
  'Legesæt til rolleleg – butik',
  'køb', 260, NULL, '3-6 år',
  'Komplet legebutik: 50 plastmadvarer, kasseapparat med lyd, kurve og prisskilte. Fremmer tal-forståelse og social leg. Alt er i perfekt stand.',
  'Meget god',
  '🛒', '#FBBF24',
  ARRAY['Rolleleg','Butik'],
  ARRAY[
    'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600&h=450&fit=crop'
  ],
  true, 'Stjernedrys Børnehave', 'Silkeborg', 'legetoj', 'Rolleleg & dukker',
  10, 0, NOW() - INTERVAL '30 days'
);

-- 3. Bekræftelse
SELECT
  category,
  COUNT(*) AS antal,
  STRING_AGG(institution_name, ', ' ORDER BY institution_name) AS institutioner
FROM listings
WHERE institution_name IN (
  'Solsikken Børnehave','Regnbuen SFO','Egebjerget Børnehus',
  'Skovstjernen Børnehave','Bølgebryderen SFO','Mariehønen Vuggestue',
  'Lindegården Børnehave','Havbrisens SFO','Kærgårdens Børnehus',
  'Stjernedrys Børnehave'
)
GROUP BY category
ORDER BY category;
