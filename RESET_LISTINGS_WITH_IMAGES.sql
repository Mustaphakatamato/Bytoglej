-- ============================================================
-- RESET: Slet alt gammelt testdata + opret opslag på dine
--        eksisterende institutioner i Greve
-- Kør i Supabase SQL Editor
-- ============================================================

-- 1. Slet alt testdata (opslag der IKKE tilhører dine rigtige institutioner)
DELETE FROM chat_messages
WHERE conversation_id IN (
  SELECT c.id FROM conversations c
  JOIN listings l ON l.id = c.listing_id
  WHERE l.institution_name NOT IN (
    SELECT name FROM institutions WHERE city ILIKE '%greve%'
  )
);

DELETE FROM conversations
WHERE listing_id IN (
  SELECT id FROM listings
  WHERE institution_name NOT IN (
    SELECT name FROM institutions WHERE city ILIKE '%greve%'
  )
);

DELETE FROM listings
WHERE institution_name NOT IN (
  SELECT name FROM institutions WHERE city ILIKE '%greve%'
);

-- ============================================================
-- 2. Indsæt 30 nye opslag fordelt på dine Greve-institutioner
--    (henter navn og by direkte fra din institutions-tabel)
-- ============================================================

DO $$
DECLARE
  inst1 TEXT; inst2 TEXT; inst3 TEXT;
  city1 TEXT; city2 TEXT; city3 TEXT;
BEGIN
  -- Hent de første 3 institutioner i Greve
  SELECT name, city INTO inst1, city1
    FROM institutions WHERE city ILIKE '%greve%' ORDER BY created_at LIMIT 1 OFFSET 0;
  SELECT name, city INTO inst2, city2
    FROM institutions WHERE city ILIKE '%greve%' ORDER BY created_at LIMIT 1 OFFSET 1;
  SELECT name, city INTO inst3, city3
    FROM institutions WHERE city ILIKE '%greve%' ORDER BY created_at LIMIT 1 OFFSET 2;

  -- Fallback: brug inst1 hvis der er færre end 3
  IF inst2 IS NULL THEN inst2 := inst1; city2 := city1; END IF;
  IF inst3 IS NULL THEN inst3 := inst1; city3 := city1; END IF;

  INSERT INTO listings
    (title, type, price, min_bid, age_group, description, condition, emoji, color,
     tags, images, is_active, institution_name, city, category, subcategory,
     fav_count, bid_count, created_at)
  VALUES

  -- ── LEGETØJ ──────────────────────────────────────────────

  (
    'LEGO DUPLO stor kasse – 180 klodser',
    'køb', 350, NULL, '3-6 år',
    'Stor samling DUPLO i mange farver og former. Inkluderer biler, dyr og figurer. Alt er vasket og klar til ny institution.',
    'God', '🧱', '#FFD166', ARRAY['LEGO','Konstruktion'],
    ARRAY['https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1585366119132-9e9d4e04df57?w=600&h=450&fit=crop'],
    true, inst1, city1, 'legetoj', 'Konstruktionslegetøj', 4, 0, NOW() - INTERVAL '1 day'
  ),
  (
    'Bamser og bløde dyr – stor pose',
    'byt', NULL, NULL, '0-3 år',
    'Ca. 15 bløde bamser og dyr i god stand. Alle vasket ved 60°. Gode til myldretid og sovestund.',
    'Meget god', '🧸', '#F4A261', ARRAY['Bamser','Blød legetøj'],
    ARRAY['https://images.unsplash.com/photo-1559454403-b8fb88521f11?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&h=450&fit=crop'],
    true, inst2, city2, 'legetoj', 'Bamser & blødt legetøj', 7, 0, NOW() - INTERVAL '2 days'
  ),
  (
    'Trælegetøj køkken med madvarer',
    'køb', 280, NULL, '1-3 år',
    'Smukt trælegetøj-køkken med madvarer. Alt i massivt træ, malet med sikre farver. Fremmer rolleleg og fantasi.',
    'Meget god', '🍳', '#E9C46A', ARRAY['Trælegetøj','Rolleleg'],
    ARRAY['https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600&h=450&fit=crop'],
    true, inst3, city3, 'legetoj', 'Rolleleg & dukker', 5, 0, NOW() - INTERVAL '3 days'
  ),
  (
    'LEGO Classic klodser – 500+ styk',
    'byd', NULL, 200, '6-10 år',
    'Stor kasse klassiske LEGO-klodser i alle farver. Sorteret og talt — ca. 520 styk. Ingen sæt, bare klodser.',
    'God', '🔴', '#E63946', ARRAY['LEGO','Konstruktion'],
    ARRAY['https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1585366119132-9e9d4e04df57?w=600&h=450&fit=crop'],
    true, inst1, city1, 'legetoj', 'Konstruktionslegetøj', 9, 3, NOW() - INTERVAL '4 days'
  ),
  (
    'Bilbane med 6 racerbiler',
    'køb', 195, NULL, '3-6 år',
    'Komplet bilbane med løkker og ramper. Inkluderer 6 racerbiler. Alle dele medfølger.',
    'Acceptabel', '🏎️', '#2A9D8F', ARRAY['Biler','Baner'],
    ARRAY['https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&h=450&fit=crop'],
    true, inst2, city2, 'legetoj', 'Biler & køretøjer', 2, 0, NOW() - INTERVAL '5 days'
  ),
  (
    'Playmobil bondegård – komplet sæt',
    'køb', 420, NULL, '3-6 år',
    'Stor Playmobil bondegård med alle dyr, figurer og tilbehør. Over 200 dele — alt er med og talt.',
    'Meget god', '🐄', '#78716C', ARRAY['Playmobil','Rolleleg'],
    ARRAY['https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1559454403-b8fb88521f11?w=600&h=450&fit=crop'],
    true, inst3, city3, 'legetoj', 'Figurer & dukker', 8, 0, NOW() - INTERVAL '6 days'
  ),

  -- ── UDENDØRS ─────────────────────────────────────────────

  (
    'Løbecykler × 4 – passer 2-4 år',
    'køb', 600, NULL, '1-3 år',
    '4 løbecykler i god stand. Sæder justeret til 2-4 årige. Vi har købt ny flåde — sælges samlet.',
    'God', '🚲', '#2A7D4F', ARRAY['Cykel','Motorik'],
    ARRAY['https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=600&h=450&fit=crop'],
    true, inst1, city1, 'udendoers', 'Cykler & køretøjer', 11, 0, NOW() - INTERVAL '7 days'
  ),
  (
    'Sandlegetøj – komplet sæt',
    'byt', NULL, NULL, '1-6 år',
    'Ca. 30 dele: spande, skovle, forme, si og vandhjul. Skyllet og klar. Bytter til boldudstyr.',
    'God', '🏖️', '#F4D03F', ARRAY['Sand','Udeliv'],
    ARRAY['https://images.unsplash.com/photo-1619451334792-150fd785ee74?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1560717845-968823efbee1?w=600&h=450&fit=crop'],
    true, inst2, city2, 'udendoers', 'Sandlegetøj', 3, 0, NOW() - INTERVAL '8 days'
  ),
  (
    'Boldkasse – 20 blandede bolde',
    'køb', 150, NULL, '3-10 år',
    '20 bolde i alle størrelser: fodbold, basketball og skumbolde. Alle oppustede og klar til brug.',
    'God', '⚽', '#F97316', ARRAY['Bolde','Sport'],
    ARRAY['https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=600&h=450&fit=crop'],
    true, inst3, city3, 'udendoers', 'Bolde & sportsudstyr', 6, 0, NOW() - INTERVAL '9 days'
  ),
  (
    'Vandtabel til udendørs brug',
    'byt', NULL, NULL, '1-6 år',
    'Stor vandtabel i plast 100×60 cm med vandhjul, kummer og forme. Bytter til sandlegetøj.',
    'God', '💧', '#0EA5E9', ARRAY['Vand','Udeliv'],
    ARRAY['https://images.unsplash.com/photo-1560717845-968823efbee1?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1619451334792-150fd785ee74?w=600&h=450&fit=crop'],
    true, inst1, city1, 'udendoers', 'Vandlegetøj', 4, 0, NOW() - INTERVAL '10 days'
  ),

  -- ── KREATIVITET ───────────────────────────────────────────

  (
    'Malekasser – 8 komplette sæt',
    'køb', 240, NULL, '3-10 år',
    '8 malekasser med vandfarver, pensler og palette. Alle komplette. Bruges til kunstprojekter.',
    'God', '🎨', '#E91E63', ARRAY['Maling','Kunst'],
    ARRAY['https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&h=450&fit=crop'],
    true, inst2, city2, 'kreativitet', 'Maling & tegning', 4, 0, NOW() - INTERVAL '11 days'
  ),
  (
    'Perleplade sæt – 20.000 Hama-perler',
    'køb', 180, NULL, '6-10 år',
    'Over 20.000 perler i 30 farver sorteret i boks. 15 plader i forskellige former + strygepapir.',
    'Meget god', '🔵', '#3B82F6', ARRAY['Perler','Finmotorik'],
    ARRAY['https://images.unsplash.com/photo-1567225557594-88d73e55f2cb?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=600&h=450&fit=crop'],
    true, inst3, city3, 'kreativitet', 'Håndværk & hobby', 12, 0, NOW() - INTERVAL '12 days'
  ),
  (
    'Krea-kuffert – alt til projektuger',
    'køb', 380, NULL, '3-10 år',
    'Stor kuffert med karton, glitter, pailletter, lim, saks, tape, fjer og øjne. 500+ dele.',
    'God', '✂️', '#F43F5E', ARRAY['Kreativitet','Kunst'],
    ARRAY['https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=600&h=450&fit=crop'],
    true, inst1, city1, 'kreativitet', 'Håndværk & hobby', 6, 0, NOW() - INTERVAL '13 days'
  ),

  -- ── BØGER & SPIL ──────────────────────────────────────────

  (
    'Billedbøger – 40 stk til 3-6 år',
    'køb', 200, NULL, '3-6 år',
    '40 børnebøger i hardback på dansk. Blandede temaer: dyr, eventyr, venskab. Alle uden manglende sider.',
    'God', '📚', '#10B981', ARRAY['Bøger','Læsning'],
    ARRAY['https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&h=450&fit=crop'],
    true, inst2, city2, 'boeger-spil', 'Billedbøger', 7, 0, NOW() - INTERVAL '14 days'
  ),
  (
    'Brætspil samling – 12 spil',
    'køb', 320, NULL, '6-10 år',
    'Ludo, Matador, Uno, Jenga, Connect 4 m.fl. Alle komplette med alle brikker.',
    'Meget god', '🎲', '#7C3AED', ARRAY['Brætspil','Strategi'],
    ARRAY['https://images.unsplash.com/photo-1606503153255-59d8b8b82176?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1611371805429-8b5c1b2c34ba?w=600&h=450&fit=crop'],
    true, inst3, city3, 'boeger-spil', 'Brætspil', 5, 0, NOW() - INTERVAL '15 days'
  ),
  (
    'Puslespil 20-100 brikker – 15 stk',
    'byt', NULL, NULL, '3-6 år',
    '15 puslespil alle komplette (vi tæller altid). Temaer: dyr, køretøjer, eventyrfigurer.',
    'God', '🧩', '#F59E0B', ARRAY['Puslespil','Koncentration'],
    ARRAY['https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1509909756405-be0199881695?w=600&h=450&fit=crop'],
    true, inst1, city1, 'boeger-spil', 'Puslespil', 6, 0, NOW() - INTERVAL '16 days'
  ),

  -- ── MØBLER ───────────────────────────────────────────────

  (
    'Børneborde og stole – 4 sæt',
    'køb', 800, NULL, '3-6 år',
    '4 runde børneborde (ø 80 cm) med 4 stole hver. Laminat-top, justérbare ben. Udskiftes pga. nyt lokale.',
    'God', '🪑', '#6B7280', ARRAY['Møbler','Borde'],
    ARRAY['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&h=450&fit=crop'],
    true, inst2, city2, 'mobler', 'Borde & stole', 3, 0, NOW() - INTERVAL '17 days'
  ),
  (
    'IKEA Kallax reol med opbevaringskasser',
    'køb', 450, NULL, '3-10 år',
    'Kallax 4×4 i hvid (147×147 cm) med 8 farverige kasser. Perfekt til legetøjsopbevaring.',
    'Meget god', '📦', '#4B5563', ARRAY['Opbevaring','Møbler'],
    ARRAY['https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=450&fit=crop'],
    true, inst3, city3, 'mobler', 'Opbevaring & hylder', 8, 0, NOW() - INTERVAL '18 days'
  ),

  -- ── BABY & SMÅBØRN ────────────────────────────────────────

  (
    'Aktivitetstæppe med buer',
    'køb', 175, NULL, '0-1 år',
    'Blødt aktivitetstæppe 90×90 cm med to buer og 6 hængende legetøj. Maskinvaskbart.',
    'Meget god', '🍼', '#FBBF24', ARRAY['Baby','Motorik'],
    ARRAY['https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1587765566073-1e5acba89682?w=600&h=450&fit=crop'],
    true, inst1, city1, 'baby', 'Aktivitetslegetøj', 4, 0, NOW() - INTERVAL '19 days'
  ),
  (
    'Gå-stol med aktivitetsbræt',
    'byd', NULL, 250, '0-1 år',
    'Stabilt gå-stol med aktivitetsbræt. Inkluderer skummåtte 150×120 cm. CE-godkendt.',
    'God', '👶', '#34D399', ARRAY['Baby','Motorik'],
    ARRAY['https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&h=450&fit=crop'],
    true, inst2, city2, 'baby', 'Aktivitetslegetøj', 5, 1, NOW() - INTERVAL '20 days'
  ),

  -- ── KOSTUMER ─────────────────────────────────────────────

  (
    'Udklædningskasse – 25 kostumer',
    'køb', 350, NULL, '3-10 år',
    '25 kostumer: prinsesser, superhelte, dyr og fagfolk. Alle vasket ved 40°. Størrelser til 4-8 årige.',
    'God', '🎭', '#EC4899', ARRAY['Kostumer','Rolleleg'],
    ARRAY['https://images.unsplash.com/photo-1576105924584-3e2ca1e4e2e8?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=450&fit=crop'],
    true, inst3, city3, 'kostumer', 'Heldragter', 10, 0, NOW() - INTERVAL '21 days'
  ),
  (
    'Dukketøj og tilbehør – stor pose',
    'byt', NULL, NULL, '3-6 år',
    'Ca. 40 dele dukketøj til 30-40 cm dukker: kjoler, bukser, jakker og sko. Bytter til rollelege-udstyr.',
    'God', '👗', '#F472B6', ARRAY['Dukker','Rolleleg'],
    ARRAY['https://images.unsplash.com/photo-1561948955-570b270e7c36?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1576105924584-3e2ca1e4e2e8?w=600&h=450&fit=crop'],
    true, inst1, city1, 'kostumer', 'Tilbehør & rekvisitter', 3, 0, NOW() - INTERVAL '22 days'
  ),

  -- ── MUSIK ────────────────────────────────────────────────

  (
    'Rytmeinstrumenter – klassesæt 24 stk',
    'køb', 290, NULL, '1-10 år',
    '24 instrumenter: maracas, tamburiner, triangler, kastagnetter og xylofoner. Alle fungerer.',
    'God', '🎵', '#8B5CF6', ARRAY['Musik','Rytme'],
    ARRAY['https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=450&fit=crop'],
    true, inst2, city2, 'musik', 'Percussion & rytme', 6, 0, NOW() - INTERVAL '23 days'
  ),
  (
    'Casio keyboard – 61 tangenter',
    'byd', NULL, 150, '6-10 år',
    'Casio CTK-2550 med 400 lyde. Strøm via ledning eller batterier. Noder og headphone-stik medfølger.',
    'Meget god', '🎹', '#1D4ED8', ARRAY['Keyboard','Musik'],
    ARRAY['https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=600&h=450&fit=crop'],
    true, inst3, city3, 'musik', 'Tangentinstrumenter', 4, 2, NOW() - INTERVAL '24 days'
  ),

  -- ── SPORT & MOTORIK ───────────────────────────────────────

  (
    'Motorikbane – balancebrætter og tunnel',
    'køb', 480, NULL, '1-6 år',
    '2 balancebrætter, 3 stepping stones, 1 tunnel og 1 klatrebue. FSC-certificeret træ. Inde og ude.',
    'Meget god', '🏃', '#059669', ARRAY['Motorik','Balance'],
    ARRAY['https://images.unsplash.com/photo-1575783970733-1aaedde1db74?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&h=450&fit=crop'],
    true, inst1, city1, 'sport-motorik', 'Balance & motorik', 9, 0, NOW() - INTERVAL '25 days'
  ),
  (
    'Klatrevæg-sæt til indendørs brug',
    'byd', NULL, 600, '6-10 år',
    'Fri stående klatrevæg 1.8×1.2 m med 30 greb i 3 sværhedsgrader. Sikkerhedsmåtte medfølger.',
    'God', '🧗', '#7C3AED', ARRAY['Klatring','Sport'],
    ARRAY['https://images.unsplash.com/photo-1522163182402-834f871fd851?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1575783970733-1aaedde1db74?w=600&h=450&fit=crop'],
    true, inst2, city2, 'sport-motorik', 'Klatring & gymredskaber', 7, 3, NOW() - INTERVAL '26 days'
  ),
  (
    'Yogamåtter til børn – 12 stk',
    'køb', 240, NULL, '3-10 år',
    '12 farverige yogamåtter 150×60 cm med skridsikker bagside. Brugt til bevægelse og afslapning.',
    'God', '🧘', '#10B981', ARRAY['Yoga','Bevægelse'],
    ARRAY['https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&h=450&fit=crop'],
    true, inst3, city3, 'sport-motorik', 'Yoga & afslapning', 5, 0, NOW() - INTERVAL '27 days'
  ),

  (
    'Hoppepude stor – 120×80 cm',
    'byd', NULL, 300, '3-10 år',
    'Stor hoppepude til indendørs brug. Maks 50 kg. Sikkerhedsnet og pumpe medfølger. Ingen defekter.',
    'God', '🤸', '#8B5CF6', ARRAY['Motorik','Bevægelse'],
    ARRAY['https://images.unsplash.com/photo-1566125882500-87e10f726cdc?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=600&h=450&fit=crop'],
    true, inst1, city1, 'sport-motorik', 'Balance & motorik', 8, 2, NOW() - INTERVAL '28 days'
  ),

  (
    'Legesæt – legebutik med kasseapparat',
    'køb', 260, NULL, '3-6 år',
    '50 plastmadvarer, kasseapparat med lyd, kurve og prisskilte. Fremmer talforståelse og social leg.',
    'Meget god', '🛒', '#FBBF24', ARRAY['Rolleleg','Butik'],
    ARRAY['https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600&h=450&fit=crop'],
    true, inst2, city2, 'legetoj', 'Rolleleg & dukker', 10, 0, NOW() - INTERVAL '29 days'
  ),

  (
    'Aktivitetsvogn med legetøj – 0-12 mdr',
    'køb', 220, NULL, '0-1 år',
    'Aktivitetsvogn med ophæng, spejl, rasle og bid-legetøj. Stimulerer sanser og motorik. Vasket.',
    'Meget god', '🌟', '#F59E0B', ARRAY['Baby','Sanser'],
    ARRAY['https://images.unsplash.com/photo-1587765566073-1e5acba89682?w=600&h=450&fit=crop',
          'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&h=450&fit=crop'],
    true, inst3, city3, 'baby', 'Aktivitetslegetøj', 6, 0, NOW() - INTERVAL '30 days'
  );

  RAISE NOTICE 'Opslag oprettet på institutioner: %, %, %', inst1, inst2, inst3;
END $$;

-- 3. Bekræftelse
SELECT institution_name, city, COUNT(*) AS antal_opslag
FROM listings
GROUP BY institution_name, city
ORDER BY antal_opslag DESC;
