-- ============================================================
-- RESET: Slet alt gammelt testdata + opret opslag fordelt på
--        ALLE dine eksisterende institutioner i Greve
-- Kør i Supabase SQL Editor
-- ============================================================

-- 1. Slet alle opslag der IKKE tilhører en Greve-institution
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
-- 2. Opret 30 opslag fordelt jævnt på ALLE Greve-institutioner
-- ============================================================

DO $$
DECLARE
  inst_names TEXT[];
  inst_cities TEXT[];
  n INTEGER;
  rec RECORD;
  i INTEGER := 0;

  -- De 30 opslag som rå data
  type     TEXT[] := ARRAY['køb','byt','køb','byd','køb','byt','køb','byd','køb','byt','køb','køb','byt','køb','byd','køb','byt','køb','byd','byt','køb','byt','køb','byd','køb','byt','byd','køb','byt','køb'];
  price_v  INT[]  := ARRAY[350,0,280,0,195,0,600,0,150,0,420,240,0,200,0,320,0,800,0,0,350,0,290,0,480,0,0,175,0,260];
  minbid_v INT[]  := ARRAY[0,0,0,200,0,0,0,0,0,300,0,0,0,0,0,0,0,0,600,0,0,0,0,150,0,0,300,0,250,0];
  titles   TEXT[] := ARRAY[
    'LEGO DUPLO stor kasse – 180 klodser',
    'Bamser og bløde dyr – stor pose',
    'Trælegetøj køkken med madvarer',
    'LEGO Classic klodser – 500+ styk',
    'Bilbane med 6 racerbiler',
    'Sandlegetøj – komplet sæt',
    'Løbecykler × 4 – passer 2-4 år',
    'Hoppepude stor – 120×80 cm',
    'Boldkasse – 20 blandede bolde',
    'Vandtabel til udendørs brug',
    'Playmobil bondegård – komplet sæt',
    'Malekasser – 8 komplette sæt',
    'Perleplade sæt – 20.000 Hama-perler',
    'Billedbøger – 40 stk til 3-6 år',
    'Brætspil samling – 12 spil',
    'Puslespil 20-100 brikker – 15 stk',
    'Udklædningskasse – 25 kostumer',
    'Børneborde og stole – 4 sæt',
    'Klatrevæg-sæt til indendørs brug',
    'Dukketøj og tilbehør – stor pose',
    'Rytmeinstrumenter – klassesæt 24 stk',
    'Aktivitetstæppe med buer',
    'Casio keyboard – 61 tangenter',
    'Krea-kuffert – alt til projektuger',
    'Motorikbane – balancebrætter og tunnel',
    'IKEA Kallax reol med opbevaringskasser',
    'Gå-stol med aktivitetsbræt',
    'Billedbøger til vuggestue – 0-3 år',
    'Yogamåtter til børn – 12 stk',
    'Legesæt – legebutik med kasseapparat'
  ];
  descs TEXT[] := ARRAY[
    'Stor samling DUPLO i mange farver og former. Inkluderer biler, dyr og figurer. Alt er vasket og klar til ny institution.',
    'Ca. 15 bløde bamser og dyr i god stand. Alle vasket ved 60°. Gode til myldretid og sovestund.',
    'Smukt trælegetøj-køkken med madvarer. Alt i massivt træ, malet med sikre farver. Fremmer rolleleg og fantasi.',
    'Stor kasse klassiske LEGO-klodser i alle farver. Sorteret og talt — ca. 520 styk. Ingen sæt, bare klodser.',
    'Komplet bilbane med løkker og ramper. Inkluderer 6 racerbiler. Alle dele medfølger.',
    'Ca. 30 dele: spande, skovle, forme, si og vandhjul. Skyllet og klar. Bytter til boldudstyr.',
    '4 løbecykler i god stand. Sæder justeret til 2-4 årige. Vi har købt ny flåde — sælges samlet.',
    'Stor hoppepude til indendørs brug. Maks 50 kg. Sikkerhedsnet og pumpe medfølger. Ingen defekter.',
    '20 bolde i alle størrelser: fodbold, basketball og skumbolde. Alle oppustede og klar til brug.',
    'Stor vandtabel i plast 100×60 cm med vandhjul, kummer og forme. Bytter til sandlegetøj.',
    'Stor Playmobil bondegård med alle dyr, figurer og tilbehør. Over 200 dele — alt er med og talt.',
    '8 malekasser med vandfarver, pensler og palette. Alle komplette. Bruges til kunstprojekter.',
    'Over 20.000 perler i 30 farver sorteret i boks. 15 plader i forskellige former + strygepapir.',
    '40 børnebøger i hardback på dansk. Blandede temaer: dyr, eventyr, venskab. Alle uden manglende sider.',
    'Ludo, Matador, Uno, Jenga, Connect 4 m.fl. Alle komplette med alle brikker.',
    '15 puslespil alle komplette (vi tæller altid). Temaer: dyr, køretøjer, eventyrfigurer.',
    '25 kostumer: prinsesser, superhelte, dyr og fagfolk. Alle vasket ved 40°. Størrelser til 4-8 årige.',
    '4 runde børneborde (ø 80 cm) med 4 stole hver. Laminat-top, justérbare ben. Udskiftes pga. nyt lokale.',
    'Fri stående klatrevæg 1.8×1.2 m med 30 greb i 3 sværhedsgrader. Sikkerhedsmåtte medfølger.',
    'Ca. 40 dele dukketøj til 30-40 cm dukker: kjoler, bukser, jakker og sko.',
    '24 instrumenter: maracas, tamburiner, triangler, kastagnetter og xylofoner. Alle fungerer.',
    'Blødt aktivitetstæppe 90×90 cm med to buer og 6 hængende legetøj. Maskinvaskbart.',
    'Casio CTK-2550 med 400 lyde. Strøm via ledning eller batterier. Noder og headphone-stik medfølger.',
    'Stor kuffert med karton, glitter, pailletter, lim, saks, tape, fjer og øjne. 500+ dele.',
    '2 balancebrætter, 3 stepping stones, 1 tunnel og 1 klatrebue. FSC-certificeret træ. Inde og ude.',
    'Kallax 4×4 i hvid (147×147 cm) med 8 farverige kasser. Perfekt til legetøjsopbevaring.',
    'Stabilt gå-stol med aktivitetsbræt. Inkluderer skummåtte 150×120 cm. CE-godkendt.',
    '20 bløde billedbøger med store illustrationer. Pap-sider til de mindste. Alle hele og rene.',
    '12 farverige yogamåtter 150×60 cm med skridsikker bagside. Bruges til bevægelse og afslapning.',
    '50 plastmadvarer, kasseapparat med lyd, kurve og prisskilte. Fremmer talforståelse og social leg.'
  ];
  conds TEXT[] := ARRAY['God','Meget god','Meget god','God','Acceptabel','God','God','God','God','God','Meget god','God','Meget god','God','Meget god','God','God','God','God','God','God','Meget god','Meget god','God','Meget god','Meget god','God','God','God','Meget god'];
  emojis TEXT[] := ARRAY['🧱','🧸','🍳','🔴','🏎️','🏖️','🚲','🤸','⚽','💧','🐄','🎨','🔵','📚','🎲','🧩','🎭','🪑','🧗','👗','🎵','🍼','🎹','✂️','🏃','📦','👶','📖','🧘','🛒'];
  ages TEXT[] := ARRAY['3-6 år','0-3 år','1-3 år','6-10 år','3-6 år','1-6 år','1-3 år','3-10 år','3-10 år','1-6 år','3-6 år','3-10 år','6-10 år','3-6 år','6-10 år','3-6 år','3-10 år','3-6 år','6-10 år','3-6 år','1-10 år','0-1 år','6-10 år','3-10 år','1-6 år','3-10 år','0-1 år','0-3 år','3-10 år','3-6 år'];
  cats TEXT[] := ARRAY['legetoj','legetoj','legetoj','legetoj','legetoj','udendoers','udendoers','sport-motorik','udendoers','udendoers','legetoj','kreativitet','kreativitet','boeger-spil','boeger-spil','boeger-spil','kostumer','mobler','sport-motorik','kostumer','musik','baby','musik','kreativitet','sport-motorik','mobler','baby','boeger-spil','sport-motorik','legetoj'];
  subcats TEXT[] := ARRAY['Konstruktionslegetøj','Bamser & blødt legetøj','Rolleleg & dukker','Konstruktionslegetøj','Biler & køretøjer','Sandlegetøj','Cykler & køretøjer','Balance & motorik','Bolde & sportsudstyr','Vandlegetøj','Figurer & dukker','Maling & tegning','Håndværk & hobby','Billedbøger','Brætspil','Puslespil','Heldragter','Borde & stole','Klatring & gymredskaber','Tilbehør & rekvisitter','Percussion & rytme','Aktivitetslegetøj','Tangentinstrumenter','Håndværk & hobby','Balance & motorik','Opbevaring & hylder','Aktivitetslegetøj','Billedbøger','Yoga & afslapning','Rolleleg & dukker'];
  imgs1 TEXT[] := ARRAY[
    'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1559454403-b8fb88521f11?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1619451334792-150fd785ee74?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1566125882500-87e10f726cdc?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1560717845-968823efbee1?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1567225557594-88d73e55f2cb?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1606503153255-59d8b8b82176?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1576105924584-3e2ca1e4e2e8?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1561948955-570b270e7c36?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1575783970733-1aaedde1db74?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600&h=450&fit=crop'
  ];
  imgs2 TEXT[] := ARRAY[
    'https://images.unsplash.com/photo-1585366119132-9e9d4e04df57?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1585366119132-9e9d4e04df57?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1560717845-968823efbee1?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1619451334792-150fd785ee74?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1559454403-b8fb88521f11?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1611371805429-8b5c1b2c34ba?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1509909756405-be0199881695?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1575783970733-1aaedde1db74?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1576105924584-3e2ca1e4e2e8?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1587765566073-1e5acba89682?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&h=450&fit=crop',
    'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600&h=450&fit=crop'
  ];

BEGIN
  -- Hent alle Greve-institutioner som arrays
  SELECT
    ARRAY_AGG(name ORDER BY created_at),
    ARRAY_AGG(city ORDER BY created_at)
  INTO inst_names, inst_cities
  FROM institutions
  WHERE city ILIKE '%greve%';

  n := array_length(inst_names, 1);

  IF n IS NULL OR n = 0 THEN
    RAISE EXCEPTION 'Ingen institutioner fundet i Greve — tjek city-feltet i institutions-tabellen';
  END IF;

  RAISE NOTICE 'Fandt % institutioner i Greve: %', n, array_to_string(inst_names, ', ');

  -- Indsæt hvert opslag på næste institution i round-robin
  FOR idx IN 1..30 LOOP
    i := ((idx - 1) % n) + 1; -- round-robin index (1-baseret)

    INSERT INTO listings
      (title, type, price, min_bid, age_group, description, condition, emoji, color,
       tags, images, is_active, institution_name, city, category, subcategory,
       fav_count, bid_count, created_at)
    VALUES (
      titles[idx],
      type[idx],
      CASE WHEN price_v[idx] = 0 THEN NULL ELSE price_v[idx] END,
      CASE WHEN minbid_v[idx] = 0 THEN NULL ELSE minbid_v[idx] END,
      ages[idx],
      descs[idx],
      conds[idx],
      emojis[idx],
      '#2A7D4F',
      ARRAY['legetøj'],
      ARRAY[imgs1[idx], imgs2[idx]],
      true,
      inst_names[i],
      inst_cities[i],
      cats[idx],
      subcats[idx],
      floor(random() * 10)::int,
      0,
      NOW() - (idx || ' days')::interval
    );
  END LOOP;

  RAISE NOTICE 'Færdig! 30 opslag oprettet fordelt på % institutioner.', n;
END $$;

-- 3. Bekræftelse — opslag per institution
SELECT institution_name, city, COUNT(*) AS antal_opslag
FROM listings
GROUP BY institution_name, city
ORDER BY antal_opslag DESC;
