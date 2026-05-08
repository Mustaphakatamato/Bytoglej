-- ================================================================
-- DEMO DATA: Greve Kommune daginstitutioner til LegetøjsByt
-- Kør dette i Supabase SQL Editor
-- ================================================================

-- ── 0. Ryd eksisterende Greve-demo data ────────────────────────
DELETE FROM bids WHERE listing_id IN (
  SELECT id FROM listings WHERE institution_name IN (
    'Børnehaven Abels Hus',
    'Børnehaven Vesterbo',
    'Børnehuset Rådhushaven',
    'Dagplejen Greve',
    'Damhuset afd. Damager',
    'Damhuset afd. Dammen',
    'Grevekæret afd. Grevehaven',
    'Grevekæret afd. Kæret',
    'Holmebo, Integreret institution',
    'Kernehuset, Integreret institution',
    'Luna''s Ark, Integreret institution',
    'Lundebo, Integreret institution',
    'Mosebo',
    'Møllehaven, Integreret institution',
    'Nova, Integreret institution',
    'Sanglærkerne',
    'Skattekisten, Integreret institution',
    'Solsikken',
    'Solstrålen, Integreret institution',
    'Toftegården, Integreret institution',
    'Troldebo, Integreret institution',
    'Troldehøjen',
    'Vibemosen',
    'Eriksminde Børnehus',
    'Lillebo (Børnehaven Lillebo)',
    'Prinsesseparken',
    'Sandrøjel',
    'Strandhuset',
    'Tjørnelyhuset',
    'Åsagergård',
    'Greve Privatskoles Børnehave',
    'Klax (Greve)',
    'Lundegårdens Frie Børnehave',
    'Nældebjerg Børnegård'
  ));
DELETE FROM listing_shares WHERE listing_id IN (
  SELECT id FROM listings WHERE institution_name IN (
    'Børnehaven Abels Hus',
    'Børnehaven Vesterbo',
    'Børnehuset Rådhushaven',
    'Dagplejen Greve',
    'Damhuset afd. Damager',
    'Damhuset afd. Dammen',
    'Grevekæret afd. Grevehaven',
    'Grevekæret afd. Kæret',
    'Holmebo, Integreret institution',
    'Kernehuset, Integreret institution',
    'Luna''s Ark, Integreret institution',
    'Lundebo, Integreret institution',
    'Mosebo',
    'Møllehaven, Integreret institution',
    'Nova, Integreret institution',
    'Sanglærkerne',
    'Skattekisten, Integreret institution',
    'Solsikken',
    'Solstrålen, Integreret institution',
    'Toftegården, Integreret institution',
    'Troldebo, Integreret institution',
    'Troldehøjen',
    'Vibemosen',
    'Eriksminde Børnehus',
    'Lillebo (Børnehaven Lillebo)',
    'Prinsesseparken',
    'Sandrøjel',
    'Strandhuset',
    'Tjørnelyhuset',
    'Åsagergård',
    'Greve Privatskoles Børnehave',
    'Klax (Greve)',
    'Lundegårdens Frie Børnehave',
    'Nældebjerg Børnegård'
  ));
DELETE FROM listings WHERE institution_name IN (
  'Børnehaven Abels Hus',
  'Børnehaven Vesterbo',
  'Børnehuset Rådhushaven',
  'Dagplejen Greve',
  'Damhuset afd. Damager',
  'Damhuset afd. Dammen',
  'Grevekæret afd. Grevehaven',
  'Grevekæret afd. Kæret',
  'Holmebo, Integreret institution',
  'Kernehuset, Integreret institution',
  'Luna''s Ark, Integreret institution',
  'Lundebo, Integreret institution',
  'Mosebo',
  'Møllehaven, Integreret institution',
  'Nova, Integreret institution',
  'Sanglærkerne',
  'Skattekisten, Integreret institution',
  'Solsikken',
  'Solstrålen, Integreret institution',
  'Toftegården, Integreret institution',
  'Troldebo, Integreret institution',
  'Troldehøjen',
  'Vibemosen',
  'Eriksminde Børnehus',
  'Lillebo (Børnehaven Lillebo)',
  'Prinsesseparken',
  'Sandrøjel',
  'Strandhuset',
  'Tjørnelyhuset',
  'Åsagergård',
  'Greve Privatskoles Børnehave',
  'Klax (Greve)',
  'Lundegårdens Frie Børnehave',
  'Nældebjerg Børnegård'
);
DELETE FROM institutions WHERE
  pnr IN ('1004416699', '1003285830', '1032384176', '1016094214', '1003285076', '1004416705', '1003285258', '1003285684', '1004245277', '1003428928', '1018016210', '1003285581', '1015221921', '1003285623', '1003285349', '1003285519', '1018003631', '1002200438', '1003285039', '1004416717', '1009244944', '1003285660', '1003285842', '1003098087', '1003246426', '1003063615', '1009814376', '1021485191', '1002077404', '1025574156', '1018342789', '1011992575')
  OR cvr IN ('33330928', '51917715', '35825517', '32550215', '27109101', '58277711', '41180862', '34782679', '29260966');

-- ── 1. Institutioner (34 stk) ───────────────────────────────────
INSERT INTO institutions (name, cvr, pnr, kommune, institution_type, ownership_type, address, zipcode, city, phone, email, leader_name, leader_phone, leader_email, contact_name)
VALUES
  ('Børnehaven Abels Hus', NULL, '1004416699', 'Greve Kommune', 'Børnehave', 'Offentlig', 'Skoleager 3', '2670', 'Greve', '43102311', 'abels-hus@greve-demo.dk', 'Hanne Nielsen', '40123456', 'hanne.nielsen@greve-demo.dk', 'Hanne Nielsen'),
  ('Børnehaven Vesterbo', NULL, '1003285830', 'Greve Kommune', 'Integreret institution', 'Offentlig', 'Vestergårdsvej 2-4', '2670', 'Greve', '43113024', 'vesterbo@greve-demo.dk', 'Lars Mortensen', '40123456', 'lars.mortensen@greve-demo.dk', 'Lars Mortensen'),
  ('Børnehuset Rådhushaven', NULL, '1032384176', 'Greve Kommune', 'Børnehave', 'Offentlig', 'Greveager 9A', '2670', 'Greve', '43123737', 'raadhushaven@greve-demo.dk', 'Dorte Hansen', '40123456', 'dorte.hansen@greve-demo.dk', 'Dorte Hansen'),
  ('Dagplejen Greve', NULL, '1016094214', 'Greve Kommune', 'Andet', 'Offentlig', 'Gersagerparken 74', '2670', 'Greve', '43134450', 'dagplejen@greve-demo.dk', 'Mette Christensen', '40123456', 'mette.christensen@greve-demo.dk', 'Mette Christensen'),
  ('Damhuset afd. Damager', NULL, '1003285076', 'Greve Kommune', 'Børnehave', 'Offentlig', 'Blågårdsvej 102', '2670', 'Greve', '43145163', 'damager@greve-demo.dk', 'Søren Larsen', '40123456', 'søren.larsen@greve-demo.dk', 'Søren Larsen'),
  ('Damhuset afd. Dammen', NULL, '1004416705', 'Greve Kommune', 'Integreret institution', 'Offentlig', 'Blågårdsvej 106', '2670', 'Greve', '43155876', 'dammen@greve-demo.dk', 'Anne Pedersen', '40123456', 'anne.pedersen@greve-demo.dk', 'Anne Pedersen'),
  ('Grevekæret afd. Grevehaven', NULL, '1003285258', 'Greve Kommune', 'Børnehave', 'Offentlig', 'Hedevangen 2', '2670', 'Greve', '43166589', 'grevehaven@greve-demo.dk', 'Jesper Jensen', '40123456', 'jesper.jensen@greve-demo.dk', 'Jesper Jensen'),
  ('Grevekæret afd. Kæret', NULL, '1003285684', 'Greve Kommune', 'Vuggestue', 'Offentlig', 'Rønnebærkæret 1', '2670', 'Greve', '43177202', 'kaeret@greve-demo.dk', 'Lotte Andersen', '40123456', 'lotte.andersen@greve-demo.dk', 'Lotte Andersen'),
  ('Holmebo, Integreret institution', NULL, '1004245277', 'Greve Kommune', 'Integreret institution', 'Offentlig', 'Nældebjergvej 2', '2670', 'Greve', '43187915', 'holmebo@greve-demo.dk', 'Kim Rasmussen', '40123456', 'kim.rasmussen@greve-demo.dk', 'Kim Rasmussen'),
  ('Kernehuset, Integreret institution', NULL, '1003428928', 'Greve Kommune', 'Integreret institution', 'Offentlig', 'Grønlykkeparken 35', '2670', 'Greve', '43198628', 'kernehuset@greve-demo.dk', 'Pia Olsen', '40123456', 'pia.olsen@greve-demo.dk', 'Pia Olsen'),
  ('Luna''s Ark, Integreret institution', NULL, '1018016210', 'Greve Kommune', 'Integreret institution', 'Offentlig', 'Hundigegårdsvej 16-20', '2670', 'Greve', '43209341', 'lunas-ark@greve-demo.dk', 'Bo Henriksen', '40123456', 'bo.henriksen@greve-demo.dk', 'Bo Henriksen'),
  ('Lundebo, Integreret institution', NULL, '1003285581', 'Greve Kommune', 'Integreret institution', 'Offentlig', 'Lundegårdshegnet 7', '4030', 'Tune', '43210054', 'lundebo@greve-demo.dk', 'Tina Madsen', '40123456', 'tina.madsen@greve-demo.dk', 'Tina Madsen'),
  ('Mosebo', NULL, '1015221921', 'Greve Kommune', 'Børnehave', 'Offentlig', 'Lundemosen 38', '2670', 'Greve', '43220767', 'mosebo@greve-demo.dk', 'Anders Poulsen', '40123456', 'anders.poulsen@greve-demo.dk', 'Anders Poulsen'),
  ('Møllehaven, Integreret institution', NULL, '1003285623', 'Greve Kommune', 'Integreret institution', 'Offentlig', 'Møllehaven 6', '2690', 'Karlslunde', '43231480', 'moellehaven@greve-demo.dk', 'Susanne Møller', '40123456', 'susanne.møller@greve-demo.dk', 'Susanne Møller'),
  ('Nova, Integreret institution', NULL, '1003285349', 'Greve Kommune', 'Integreret institution', 'Offentlig', 'Hundige Alle 13', '2670', 'Greve', '43242193', 'nova@greve-demo.dk', 'Martin Christoffersen', '40123456', 'martin.christoffersen@greve-demo.dk', 'Martin Christoffersen'),
  ('Sanglærkerne', NULL, '1003285519', 'Greve Kommune', 'Vuggestue', 'Offentlig', 'Krogårdsvej 1', '2670', 'Greve', '43252806', 'sanglaerkerne@greve-demo.dk', 'Gitte Thomsen', '40123456', 'gitte.thomsen@greve-demo.dk', 'Gitte Thomsen'),
  ('Skattekisten, Integreret institution', NULL, '1018003631', 'Greve Kommune', 'Integreret institution', 'Offentlig', 'Jerismosevej 95', '2670', 'Greve', '43263519', 'skattekisten@greve-demo.dk', 'Rune Eriksen', '40123456', 'rune.eriksen@greve-demo.dk', 'Rune Eriksen'),
  ('Solsikken', NULL, '1002200438', 'Greve Kommune', 'Børnehave', 'Offentlig', 'Vangeleddet 11', '2670', 'Greve', '43274232', 'solsikken@greve-demo.dk', 'Charlotte Pedersen', '40123456', 'charlotte.pedersen@greve-demo.dk', 'Charlotte Pedersen'),
  ('Solstrålen, Integreret institution', NULL, '1003285039', 'Greve Kommune', 'Integreret institution', 'Offentlig', 'Blågårdsvej 98', '2670', 'Greve', '43284945', 'solstraalen@greve-demo.dk', 'Mikkel Hansen', '40123456', 'mikkel.hansen@greve-demo.dk', 'Mikkel Hansen'),
  ('Toftegården, Integreret institution', NULL, '1004416717', 'Greve Kommune', 'Integreret institution', 'Offentlig', 'Hundigevænget 1', '2670', 'Greve', '43295658', 'toftegaarden@greve-demo.dk', 'Birgit Sørensen', '40123456', 'birgit.sørensen@greve-demo.dk', 'Birgit Sørensen'),
  ('Troldebo, Integreret institution', NULL, '1009244944', 'Greve Kommune', 'Integreret institution', 'Offentlig', 'Tjurgården 215B', '2670', 'Greve', '43306371', 'troldebo@greve-demo.dk', 'Jakob Nielsen', '40123456', 'jakob.nielsen@greve-demo.dk', 'Jakob Nielsen'),
  ('Troldehøjen', NULL, '1003285660', 'Greve Kommune', 'Integreret institution', 'Offentlig', 'Tunehøj 1', '4030', 'Tune', '43317084', 'troldehoejen@greve-demo.dk', 'Camilla Larsen', '40123456', 'camilla.larsen@greve-demo.dk', 'Camilla Larsen'),
  ('Vibemosen', NULL, '1003285842', 'Greve Kommune', 'Integreret institution', 'Offentlig', 'Vibemosen 14', '2670', 'Greve', '43327797', 'vibemosen@greve-demo.dk', 'Louise Jensen', '40123456', 'louise.jensen@greve-demo.dk', 'Louise Jensen'),
  ('Eriksminde Børnehus', '33330928', NULL, NULL, 'Integreret institution', 'Selvejende', 'Eriksmindevej 22-24', '2670', 'Greve', '43338410', 'eriksminde@greve-demo.dk', 'Peter Andersen', '40123456', 'peter.andersen@greve-demo.dk', 'Peter Andersen'),
  ('Lillebo (Børnehaven Lillebo)', '51917715', '1003098087', NULL, 'Børnehave', 'Selvejende', 'Vårgyvelvej 1D', '2690', 'Karlslunde', '43349123', 'lillebo@greve-demo.dk', 'Sofie Rasmussen', '40123456', 'sofie.rasmussen@greve-demo.dk', 'Sofie Rasmussen'),
  ('Prinsesseparken', '35825517', NULL, NULL, 'Integreret institution', 'Selvejende', 'Anne Marie Allé 2-6', '2690', 'Karlslunde', '43359836', 'prinsesseparken@greve-demo.dk', 'Henrik Olsen', '40123456', 'henrik.olsen@greve-demo.dk', 'Henrik Olsen'),
  ('Sandrøjel', '32550215', '1003246426', NULL, 'Integreret institution', 'Selvejende', 'Sandrøjel 1-5', '2670', 'Greve', '43360549', 'sandroejel@greve-demo.dk', 'Maria Henriksen', '40123456', 'maria.henriksen@greve-demo.dk', 'Maria Henriksen'),
  ('Strandhuset', NULL, '1003063615', NULL, 'Integreret institution', 'Selvejende', 'Egedalsvej 25-29', '2690', 'Karlslunde', '43371262', 'strandhuset@greve-demo.dk', 'Thomas Madsen', '40123456', 'thomas.madsen@greve-demo.dk', 'Thomas Madsen'),
  ('Tjørnelyhuset', '27109101', '1009814376', NULL, 'Integreret institution', 'Selvejende', 'Tjørnelyparken 37-39', '2670', 'Greve', '43381975', 'tjoernelyhuset@greve-demo.dk', 'Julie Poulsen', '40123456', 'julie.poulsen@greve-demo.dk', 'Julie Poulsen'),
  ('Åsagergård', NULL, '1021485191', NULL, 'Integreret institution', 'Selvejende', 'Hirseager 4', '2690', 'Karlslunde', '43392688', 'aasagergaard@greve-demo.dk', 'Simon Møller', '40123456', 'simon.møller@greve-demo.dk', 'Simon Møller'),
  ('Greve Privatskoles Børnehave', '58277711', '1002077404', NULL, 'Børnehave', 'Privat', 'Hundige Bygade 2', '2670', 'Greve', '43403301', 'privatskolen@greve-demo.dk', 'Anna Christoffersen', '40123456', 'anna.christoffersen@greve-demo.dk', 'Anna Christoffersen'),
  ('Klax (Greve)', '41180862', '1025574156', NULL, 'Integreret institution', 'Privat', 'Frydenhøj Allé 57', '2670', 'Greve', '43414014', 'klax@greve-demo.dk', 'Rasmus Thomsen', '40123456', 'rasmus.thomsen@greve-demo.dk', 'Rasmus Thomsen'),
  ('Lundegårdens Frie Børnehave', '34782679', '1018342789', NULL, 'Børnehave', 'Privat', 'Lundegårdshegnet 5', '4030', 'Tune', '43424727', 'lundegaarden@greve-demo.dk', 'Ida Eriksen', '40123456', 'ida.eriksen@greve-demo.dk', 'Ida Eriksen'),
  ('Nældebjerg Børnegård', '29260966', '1011992575', NULL, 'Integreret institution', 'Privat', 'Pileås 22', '2670', 'Greve', '43435440', 'naeldebjerg@greve-demo.dk', 'Oliver Pedersen', '40123456', 'oliver.pedersen@greve-demo.dk', 'Oliver Pedersen');

-- ── 2. Opslag (3 per institution = 102 opslag) ──────────────────
INSERT INTO listings (title, description, type, price, condition, age_group, city, institution_name, emoji, color, tags, images, bid_count, fav_count, is_active, min_bid)
VALUES
  ('LEGO Duplo sæt – stor kasse', 'Ca. 150 klodser i god stand. Sælges da vi har fået nyt sæt.', 'køb', 180, 'God', '3-6 år', 'Greve', 'Børnehaven Abels Hus', '🧱', '#FFD166', ARRAY['konstruktion','klassisk'], '{}', 0, 2, true, NULL),
  ('Gyngehest i træ', 'Klassisk gyngehest, let slitage på maling. Afhentes.', 'køb', 250, 'God', '3-6 år', 'Greve', 'Børnehaven Abels Hus', '🐴', '#A78BFA', ARRAY['motorik','klassisk'], '{}', 0, 5, true, NULL),
  ('Motorikpuder (6 stk)', 'Skumpuder til bevægelse og balance. Næsten nye.', 'køb', 300, 'Meget god', '3-6 år', 'Greve', 'Børnehaven Abels Hus', '🟦', '#06D6A0', ARRAY['motorik','bevægelse'], '{}', 0, 2, true, NULL),
  ('Bløde bamser (pose med 12)', 'Diverse bamser i god stand, vasket og klar.', 'køb', 120, 'God', '0-2 år', 'Greve', 'Børnehaven Vesterbo', '🧸', '#FFD166', ARRAY['sansestimulering'], '{}', 0, 1, true, NULL),
  ('Sandkasse-legetøj sæt', 'Spande, forme og skovle. Alt medfølger.', 'køb', 80, 'God', '1-4 år', 'Greve', 'Børnehaven Vesterbo', '🏖️', '#F4831F', ARRAY['udeleg'], '{}', 0, 2, true, NULL),
  ('Malerier og pensler (sæt)', '3 sæt akvarelfarver + 20 pensler, ubrugte.', 'køb', 90, 'Meget god', '3-6 år', 'Greve', 'Børnehaven Vesterbo', '🎨', '#EF476F', ARRAY['kreativitet'], '{}', 0, 6, true, NULL),
  ('Kravlegård i birketræ', '120×120 cm, alle stænger intakte. Demonteret.', 'køb', 400, 'Meget god', '3-6 år', 'Greve', 'Børnehuset Rådhushaven', '🏡', '#FFB347', ARRAY['møbler','baby'], '{}', 0, 8, true, NULL),
  ('Brætspil-samling (8 stk)', 'Ludo, Uno, Skip-Bo og flere. De fleste komplette.', 'køb', 150, 'God', '3-6 år', 'Greve', 'Børnehuset Rådhushaven', '🎲', '#FF6B9D', ARRAY['spil','indendørs'], '{}', 0, 4, true, NULL),
  ('Klatrestativ til udeleg', 'Bærbart stativ i galvaniseret stål.', 'køb', 600, 'God', '3-6 år', 'Greve', 'Børnehuset Rådhushaven', '🧗', '#4CAF50', ARRAY['udeleg','bevægelse'], '{}', 0, 1, true, NULL),
  ('Aktivitetsmåtte med spejl', 'Stor aktivitetsmåtte til baby med hængende legetøj og spejl.', 'køb', 200, 'Meget god', '0-1 år', 'Greve', 'Dagplejen Greve', '🪞', '#06D6A0', ARRAY['sansestimulering','baby'], '{}', 0, 0, true, NULL),
  ('Rollespilskostumer (10 stk)', 'Superhelte, dyr og prinsesser. Vasket og klar.', 'køb', 200, 'God', '3-6 år', 'Greve', 'Dagplejen Greve', '🎭', '#EF476F', ARRAY['kreativitet','rolleleg'], '{}', 0, 4, true, NULL),
  ('Cykler til børn (3 stk)', 'Løbecykel + 2 trehjulede cykler. Hjelme medfølger.', 'køb', 450, 'God', '2-5 år', 'Greve', 'Dagplejen Greve', '🚲', '#118AB2', ARRAY['udeleg','bevægelse'], '{}', 0, 0, true, NULL),
  ('Puslespil-samling (15 stk)', 'Puslespil fra 12 til 100 brikker. Byd hvad du synes.', 'byd', NULL, 'God', '3-6 år', 'Greve', 'Damhuset afd. Damager', '🧩', '#A78BFA', ARRAY['konstruktion','indendørs'], '{}', 2, 7, true, 50),
  ('Trampolin (ø 3 m)', 'Udendørs trampolin med sikkerhedsnet. Startbud 300 kr.', 'byd', NULL, 'Acceptabel', '3-6 år', 'Greve', 'Damhuset afd. Damager', '⭕', '#4CAF50', ARRAY['udeleg','bevægelse'], '{}', 1, 6, true, 300),
  ('Vandlegetøj til badekar (3 sæt)', 'Badedyr, vandbøtter og formklodser. Byd.', 'byd', NULL, 'God', '3-6 år', 'Greve', 'Damhuset afd. Damager', '🛁', '#118AB2', ARRAY['vand','sansestimulering'], '{}', 0, 5, true, 30),
  ('Musikinstrumenter til børn (sæt)', 'Tamburin, maracas, triangel og tromme. Startbud 75 kr.', 'byd', NULL, 'God', '1-4 år', 'Greve', 'Damhuset afd. Dammen', '🥁', '#EF476F', ARRAY['musik','kreativitet'], '{}', 2, 6, true, 75),
  ('Scooter (12-tommer hjul)', 'God scooter med justerbart styr. Startbud 150 kr.', 'byd', NULL, 'God', '3-8 år', 'Greve', 'Damhuset afd. Dammen', '🛴', '#FFD166', ARRAY['udeleg','bevægelse'], '{}', 3, 5, true, 150),
  ('Tegnebrætter og perler', 'Hama-perler (store sæt) + 3 peg-brætter. Byd.', 'byd', NULL, 'God', '3-6 år', 'Greve', 'Damhuset afd. Dammen', '🎨', '#FF6B9D', ARRAY['kreativitet'], '{}', 2, 7, true, 40),
  ('Gynger til legeplads (2 stk)', 'To robuste gynger med kæder. Kan skilles ad. Startbud 200.', 'byd', NULL, 'God', '3-6 år', 'Greve', 'Grevekæret afd. Grevehaven', '🕹️', '#F4831F', ARRAY['udeleg'], '{}', 0, 5, true, 200),
  ('Håndbold-sæt (8 bolde)', 'Otte håndboldbolde str. 0. Startbud 100 kr.', 'byd', NULL, 'Acceptabel', '3-6 år', 'Greve', 'Grevekæret afd. Grevehaven', '🤾', '#4CAF50', ARRAY['sport','udeleg'], '{}', 1, 1, true, 100),
  ('Duplo-tog sæt – bytter gerne', 'Togbane med tog og vogne. Bytter mod andet konstruktionslegetøj.', 'byt', NULL, 'God', '3-6 år', 'Greve', 'Grevekæret afd. Grevehaven', '🚂', '#FFD166', ARRAY['konstruktion','klassisk'], '{}', 0, 4, true, NULL),
  ('Køkkenlegesæt i træ', 'Komplet legetøjskøkken med gryder og madvarer. Bytter mod udelegetøj.', 'byt', NULL, 'Meget god', '0-2 år', 'Greve', 'Grevekæret afd. Kæret', '🍳', '#EF476F', ARRAY['rolleleg','kreativitet'], '{}', 0, 6, true, NULL),
  ('Malebøger (20 stk ubrugte)', 'Diverse malebøger til børnehave. Bytter mod perler eller klæg.', 'byt', NULL, 'Meget god', '0-2 år', 'Greve', 'Grevekæret afd. Kæret', '📚', '#A78BFA', ARRAY['kreativitet'], '{}', 0, 2, true, NULL),
  ('Ridehjelm str. 50-54', 'Ridehjelm næsten ny. Bytter mod sportsudstyr eller cykelhjelm.', 'byt', NULL, 'Meget god', '0-2 år', 'Greve', 'Grevekæret afd. Kæret', '⛑️', '#06D6A0', ARRAY['sport'], '{}', 0, 2, true, NULL),
  ('Legoklodser (blandet, 2 kg)', 'Blandet Lego, ikke Duplo. Bytter mod puslespil eller brætspil.', 'byt', NULL, 'God', '5-10 år', 'Greve', 'Holmebo, Integreret institution', '🟥', '#FF6B9D', ARRAY['konstruktion'], '{}', 0, 2, true, NULL),
  ('Boldspil og nettet (badminton)', 'To ketchere og shuttle + lille net. Bytter mod andet udeleg.', 'byt', NULL, 'God', '5-12 år', 'Greve', 'Holmebo, Integreret institution', '🏸', '#118AB2', ARRAY['sport','udeleg'], '{}', 0, 4, true, NULL),
  ('LEGO Duplo sæt – stor kasse', 'Ca. 150 klodser i god stand. Sælges da vi har fået nyt sæt.', 'køb', 180, 'God', '1-3 år', 'Greve', 'Holmebo, Integreret institution', '🧱', '#FFD166', ARRAY['konstruktion','klassisk'], '{}', 0, 7, true, NULL),
  ('Gyngehest i træ', 'Klassisk gyngehest, let slitage på maling. Afhentes.', 'køb', 250, 'God', '1-4 år', 'Greve', 'Kernehuset, Integreret institution', '🐴', '#A78BFA', ARRAY['motorik','klassisk'], '{}', 0, 4, true, NULL),
  ('Motorikpuder (6 stk)', 'Skumpuder til bevægelse og balance. Næsten nye.', 'køb', 300, 'Meget god', '0-2 år', 'Greve', 'Kernehuset, Integreret institution', '🟦', '#06D6A0', ARRAY['motorik','bevægelse'], '{}', 0, 3, true, NULL),
  ('Bløde bamser (pose med 12)', 'Diverse bamser i god stand, vasket og klar.', 'køb', 120, 'God', '0-2 år', 'Greve', 'Kernehuset, Integreret institution', '🧸', '#FFD166', ARRAY['sansestimulering'], '{}', 0, 1, true, NULL),
  ('Sandkasse-legetøj sæt', 'Spande, forme og skovle. Alt medfølger.', 'køb', 80, 'God', '1-4 år', 'Greve', 'Luna''s Ark, Integreret institution', '🏖️', '#F4831F', ARRAY['udeleg'], '{}', 0, 3, true, NULL),
  ('Malerier og pensler (sæt)', '3 sæt akvarelfarver + 20 pensler, ubrugte.', 'køb', 90, 'Meget god', '3-6 år', 'Greve', 'Luna''s Ark, Integreret institution', '🎨', '#EF476F', ARRAY['kreativitet'], '{}', 0, 8, true, NULL),
  ('Kravlegård i birketræ', '120×120 cm, alle stænger intakte. Demonteret.', 'køb', 400, 'Meget god', '0-1 år', 'Greve', 'Luna''s Ark, Integreret institution', '🏡', '#FFB347', ARRAY['møbler','baby'], '{}', 0, 3, true, NULL),
  ('Brætspil-samling (8 stk)', 'Ludo, Uno, Skip-Bo og flere. De fleste komplette.', 'køb', 150, 'God', '6-12 år', 'Tune', 'Lundebo, Integreret institution', '🎲', '#FF6B9D', ARRAY['spil','indendørs'], '{}', 0, 1, true, NULL),
  ('Klatrestativ til udeleg', 'Bærbart stativ i galvaniseret stål.', 'køb', 600, 'God', '3-8 år', 'Tune', 'Lundebo, Integreret institution', '🧗', '#4CAF50', ARRAY['udeleg','bevægelse'], '{}', 0, 4, true, NULL),
  ('Aktivitetsmåtte med spejl', 'Stor aktivitetsmåtte til baby med hængende legetøj og spejl.', 'køb', 200, 'Meget god', '0-1 år', 'Tune', 'Lundebo, Integreret institution', '🪞', '#06D6A0', ARRAY['sansestimulering','baby'], '{}', 0, 5, true, NULL),
  ('Rollespilskostumer (10 stk)', 'Superhelte, dyr og prinsesser. Vasket og klar.', 'køb', 200, 'God', '3-6 år', 'Greve', 'Mosebo', '🎭', '#EF476F', ARRAY['kreativitet','rolleleg'], '{}', 0, 8, true, NULL),
  ('Cykler til børn (3 stk)', 'Løbecykel + 2 trehjulede cykler. Hjelme medfølger.', 'køb', 450, 'God', '3-6 år', 'Greve', 'Mosebo', '🚲', '#118AB2', ARRAY['udeleg','bevægelse'], '{}', 0, 4, true, NULL),
  ('Puslespil-samling (15 stk)', 'Puslespil fra 12 til 100 brikker. Byd hvad du synes.', 'byd', NULL, 'God', '3-6 år', 'Greve', 'Mosebo', '🧩', '#A78BFA', ARRAY['konstruktion','indendørs'], '{}', 1, 6, true, 50),
  ('Trampolin (ø 3 m)', 'Udendørs trampolin med sikkerhedsnet. Startbud 300 kr.', 'byd', NULL, 'Acceptabel', '3-12 år', 'Karlslunde', 'Møllehaven, Integreret institution', '⭕', '#4CAF50', ARRAY['udeleg','bevægelse'], '{}', 0, 2, true, 300),
  ('Vandlegetøj til badekar (3 sæt)', 'Badedyr, vandbøtter og formklodser. Byd.', 'byd', NULL, 'God', '0-2 år', 'Karlslunde', 'Møllehaven, Integreret institution', '🛁', '#118AB2', ARRAY['vand','sansestimulering'], '{}', 0, 3, true, 30),
  ('Musikinstrumenter til børn (sæt)', 'Tamburin, maracas, triangel og tromme. Startbud 75 kr.', 'byd', NULL, 'God', '1-4 år', 'Karlslunde', 'Møllehaven, Integreret institution', '🥁', '#EF476F', ARRAY['musik','kreativitet'], '{}', 3, 8, true, 75),
  ('Scooter (12-tommer hjul)', 'God scooter med justerbart styr. Startbud 150 kr.', 'byd', NULL, 'God', '3-8 år', 'Greve', 'Nova, Integreret institution', '🛴', '#FFD166', ARRAY['udeleg','bevægelse'], '{}', 0, 1, true, 150),
  ('Tegnebrætter og perler', 'Hama-perler (store sæt) + 3 peg-brætter. Byd.', 'byd', NULL, 'God', '3-6 år', 'Greve', 'Nova, Integreret institution', '🎨', '#FF6B9D', ARRAY['kreativitet'], '{}', 3, 6, true, 40),
  ('Gynger til legeplads (2 stk)', 'To robuste gynger med kæder. Kan skilles ad. Startbud 200.', 'byd', NULL, 'God', '2-10 år', 'Greve', 'Nova, Integreret institution', '🕹️', '#F4831F', ARRAY['udeleg'], '{}', 0, 3, true, 200),
  ('Håndbold-sæt (8 bolde)', 'Otte håndboldbolde str. 0. Startbud 100 kr.', 'byd', NULL, 'Acceptabel', '0-2 år', 'Greve', 'Sanglærkerne', '🤾', '#4CAF50', ARRAY['sport','udeleg'], '{}', 0, 2, true, 100),
  ('Duplo-tog sæt – bytter gerne', 'Togbane med tog og vogne. Bytter mod andet konstruktionslegetøj.', 'byt', NULL, 'God', '0-2 år', 'Greve', 'Sanglærkerne', '🚂', '#FFD166', ARRAY['konstruktion','klassisk'], '{}', 0, 1, true, NULL),
  ('Køkkenlegesæt i træ', 'Komplet legetøjskøkken med gryder og madvarer. Bytter mod udelegetøj.', 'byt', NULL, 'Meget god', '0-2 år', 'Greve', 'Sanglærkerne', '🍳', '#EF476F', ARRAY['rolleleg','kreativitet'], '{}', 0, 8, true, NULL),
  ('Malebøger (20 stk ubrugte)', 'Diverse malebøger til børnehave. Bytter mod perler eller klæg.', 'byt', NULL, 'Meget god', '3-6 år', 'Greve', 'Skattekisten, Integreret institution', '📚', '#A78BFA', ARRAY['kreativitet'], '{}', 0, 6, true, NULL),
  ('Ridehjelm str. 50-54', 'Ridehjelm næsten ny. Bytter mod sportsudstyr eller cykelhjelm.', 'byt', NULL, 'Meget god', '4-8 år', 'Greve', 'Skattekisten, Integreret institution', '⛑️', '#06D6A0', ARRAY['sport'], '{}', 0, 5, true, NULL),
  ('Legoklodser (blandet, 2 kg)', 'Blandet Lego, ikke Duplo. Bytter mod puslespil eller brætspil.', 'byt', NULL, 'God', '5-10 år', 'Greve', 'Skattekisten, Integreret institution', '🟥', '#FF6B9D', ARRAY['konstruktion'], '{}', 0, 8, true, NULL),
  ('Boldspil og nettet (badminton)', 'To ketchere og shuttle + lille net. Bytter mod andet udeleg.', 'byt', NULL, 'God', '3-6 år', 'Greve', 'Solsikken', '🏸', '#118AB2', ARRAY['sport','udeleg'], '{}', 0, 0, true, NULL),
  ('LEGO Duplo sæt – stor kasse', 'Ca. 150 klodser i god stand. Sælges da vi har fået nyt sæt.', 'køb', 180, 'God', '3-6 år', 'Greve', 'Solsikken', '🧱', '#FFD166', ARRAY['konstruktion','klassisk'], '{}', 0, 5, true, NULL),
  ('Gyngehest i træ', 'Klassisk gyngehest, let slitage på maling. Afhentes.', 'køb', 250, 'God', '3-6 år', 'Greve', 'Solsikken', '🐴', '#A78BFA', ARRAY['motorik','klassisk'], '{}', 0, 5, true, NULL),
  ('Motorikpuder (6 stk)', 'Skumpuder til bevægelse og balance. Næsten nye.', 'køb', 300, 'Meget god', '0-2 år', 'Greve', 'Solstrålen, Integreret institution', '🟦', '#06D6A0', ARRAY['motorik','bevægelse'], '{}', 0, 7, true, NULL),
  ('Bløde bamser (pose med 12)', 'Diverse bamser i god stand, vasket og klar.', 'køb', 120, 'God', '0-2 år', 'Greve', 'Solstrålen, Integreret institution', '🧸', '#FFD166', ARRAY['sansestimulering'], '{}', 0, 4, true, NULL),
  ('Sandkasse-legetøj sæt', 'Spande, forme og skovle. Alt medfølger.', 'køb', 80, 'God', '1-4 år', 'Greve', 'Solstrålen, Integreret institution', '🏖️', '#F4831F', ARRAY['udeleg'], '{}', 0, 3, true, NULL),
  ('Malerier og pensler (sæt)', '3 sæt akvarelfarver + 20 pensler, ubrugte.', 'køb', 90, 'Meget god', '3-6 år', 'Greve', 'Toftegården, Integreret institution', '🎨', '#EF476F', ARRAY['kreativitet'], '{}', 0, 2, true, NULL),
  ('Kravlegård i birketræ', '120×120 cm, alle stænger intakte. Demonteret.', 'køb', 400, 'Meget god', '0-1 år', 'Greve', 'Toftegården, Integreret institution', '🏡', '#FFB347', ARRAY['møbler','baby'], '{}', 0, 5, true, NULL),
  ('Brætspil-samling (8 stk)', 'Ludo, Uno, Skip-Bo og flere. De fleste komplette.', 'køb', 150, 'God', '6-12 år', 'Greve', 'Toftegården, Integreret institution', '🎲', '#FF6B9D', ARRAY['spil','indendørs'], '{}', 0, 1, true, NULL),
  ('Klatrestativ til udeleg', 'Bærbart stativ i galvaniseret stål.', 'køb', 600, 'God', '3-8 år', 'Greve', 'Troldebo, Integreret institution', '🧗', '#4CAF50', ARRAY['udeleg','bevægelse'], '{}', 0, 6, true, NULL),
  ('Aktivitetsmåtte med spejl', 'Stor aktivitetsmåtte til baby med hængende legetøj og spejl.', 'køb', 200, 'Meget god', '0-1 år', 'Greve', 'Troldebo, Integreret institution', '🪞', '#06D6A0', ARRAY['sansestimulering','baby'], '{}', 0, 6, true, NULL),
  ('Rollespilskostumer (10 stk)', 'Superhelte, dyr og prinsesser. Vasket og klar.', 'køb', 200, 'God', '3-6 år', 'Greve', 'Troldebo, Integreret institution', '🎭', '#EF476F', ARRAY['kreativitet','rolleleg'], '{}', 0, 6, true, NULL),
  ('Cykler til børn (3 stk)', 'Løbecykel + 2 trehjulede cykler. Hjelme medfølger.', 'køb', 450, 'God', '2-5 år', 'Tune', 'Troldehøjen', '🚲', '#118AB2', ARRAY['udeleg','bevægelse'], '{}', 0, 0, true, NULL),
  ('Puslespil-samling (15 stk)', 'Puslespil fra 12 til 100 brikker. Byd hvad du synes.', 'byd', NULL, 'God', '3-6 år', 'Tune', 'Troldehøjen', '🧩', '#A78BFA', ARRAY['konstruktion','indendørs'], '{}', 1, 3, true, 50),
  ('Trampolin (ø 3 m)', 'Udendørs trampolin med sikkerhedsnet. Startbud 300 kr.', 'byd', NULL, 'Acceptabel', '3-12 år', 'Tune', 'Troldehøjen', '⭕', '#4CAF50', ARRAY['udeleg','bevægelse'], '{}', 3, 2, true, 300),
  ('Vandlegetøj til badekar (3 sæt)', 'Badedyr, vandbøtter og formklodser. Byd.', 'byd', NULL, 'God', '0-2 år', 'Greve', 'Vibemosen', '🛁', '#118AB2', ARRAY['vand','sansestimulering'], '{}', 3, 6, true, 30),
  ('Musikinstrumenter til børn (sæt)', 'Tamburin, maracas, triangel og tromme. Startbud 75 kr.', 'byd', NULL, 'God', '1-4 år', 'Greve', 'Vibemosen', '🥁', '#EF476F', ARRAY['musik','kreativitet'], '{}', 1, 7, true, 75),
  ('Scooter (12-tommer hjul)', 'God scooter med justerbart styr. Startbud 150 kr.', 'byd', NULL, 'God', '3-8 år', 'Greve', 'Vibemosen', '🛴', '#FFD166', ARRAY['udeleg','bevægelse'], '{}', 0, 7, true, 150),
  ('Tegnebrætter og perler', 'Hama-perler (store sæt) + 3 peg-brætter. Byd.', 'byd', NULL, 'God', '3-6 år', 'Greve', 'Eriksminde Børnehus', '🎨', '#FF6B9D', ARRAY['kreativitet'], '{}', 2, 4, true, 40),
  ('Gynger til legeplads (2 stk)', 'To robuste gynger med kæder. Kan skilles ad. Startbud 200.', 'byd', NULL, 'God', '2-10 år', 'Greve', 'Eriksminde Børnehus', '🕹️', '#F4831F', ARRAY['udeleg'], '{}', 2, 8, true, 200),
  ('Håndbold-sæt (8 bolde)', 'Otte håndboldbolde str. 0. Startbud 100 kr.', 'byd', NULL, 'Acceptabel', '5-12 år', 'Greve', 'Eriksminde Børnehus', '🤾', '#4CAF50', ARRAY['sport','udeleg'], '{}', 0, 5, true, 100),
  ('Duplo-tog sæt – bytter gerne', 'Togbane med tog og vogne. Bytter mod andet konstruktionslegetøj.', 'byt', NULL, 'God', '3-6 år', 'Karlslunde', 'Lillebo (Børnehaven Lillebo)', '🚂', '#FFD166', ARRAY['konstruktion','klassisk'], '{}', 0, 0, true, NULL),
  ('Køkkenlegesæt i træ', 'Komplet legetøjskøkken med gryder og madvarer. Bytter mod udelegetøj.', 'byt', NULL, 'Meget god', '3-6 år', 'Karlslunde', 'Lillebo (Børnehaven Lillebo)', '🍳', '#EF476F', ARRAY['rolleleg','kreativitet'], '{}', 0, 5, true, NULL),
  ('Malebøger (20 stk ubrugte)', 'Diverse malebøger til børnehave. Bytter mod perler eller klæg.', 'byt', NULL, 'Meget god', '3-6 år', 'Karlslunde', 'Lillebo (Børnehaven Lillebo)', '📚', '#A78BFA', ARRAY['kreativitet'], '{}', 0, 3, true, NULL),
  ('Ridehjelm str. 50-54', 'Ridehjelm næsten ny. Bytter mod sportsudstyr eller cykelhjelm.', 'byt', NULL, 'Meget god', '4-8 år', 'Karlslunde', 'Prinsesseparken', '⛑️', '#06D6A0', ARRAY['sport'], '{}', 0, 7, true, NULL),
  ('Legoklodser (blandet, 2 kg)', 'Blandet Lego, ikke Duplo. Bytter mod puslespil eller brætspil.', 'byt', NULL, 'God', '5-10 år', 'Karlslunde', 'Prinsesseparken', '🟥', '#FF6B9D', ARRAY['konstruktion'], '{}', 0, 8, true, NULL),
  ('Boldspil og nettet (badminton)', 'To ketchere og shuttle + lille net. Bytter mod andet udeleg.', 'byt', NULL, 'God', '5-12 år', 'Karlslunde', 'Prinsesseparken', '🏸', '#118AB2', ARRAY['sport','udeleg'], '{}', 0, 8, true, NULL),
  ('LEGO Duplo sæt – stor kasse', 'Ca. 150 klodser i god stand. Sælges da vi har fået nyt sæt.', 'køb', 180, 'God', '1-3 år', 'Greve', 'Sandrøjel', '🧱', '#FFD166', ARRAY['konstruktion','klassisk'], '{}', 0, 0, true, NULL),
  ('Gyngehest i træ', 'Klassisk gyngehest, let slitage på maling. Afhentes.', 'køb', 250, 'God', '1-4 år', 'Greve', 'Sandrøjel', '🐴', '#A78BFA', ARRAY['motorik','klassisk'], '{}', 0, 5, true, NULL),
  ('Motorikpuder (6 stk)', 'Skumpuder til bevægelse og balance. Næsten nye.', 'køb', 300, 'Meget god', '0-2 år', 'Greve', 'Sandrøjel', '🟦', '#06D6A0', ARRAY['motorik','bevægelse'], '{}', 0, 0, true, NULL),
  ('Bløde bamser (pose med 12)', 'Diverse bamser i god stand, vasket og klar.', 'køb', 120, 'God', '0-2 år', 'Karlslunde', 'Strandhuset', '🧸', '#FFD166', ARRAY['sansestimulering'], '{}', 0, 3, true, NULL),
  ('Sandkasse-legetøj sæt', 'Spande, forme og skovle. Alt medfølger.', 'køb', 80, 'God', '1-4 år', 'Karlslunde', 'Strandhuset', '🏖️', '#F4831F', ARRAY['udeleg'], '{}', 0, 2, true, NULL),
  ('Malerier og pensler (sæt)', '3 sæt akvarelfarver + 20 pensler, ubrugte.', 'køb', 90, 'Meget god', '3-6 år', 'Karlslunde', 'Strandhuset', '🎨', '#EF476F', ARRAY['kreativitet'], '{}', 0, 0, true, NULL),
  ('Kravlegård i birketræ', '120×120 cm, alle stænger intakte. Demonteret.', 'køb', 400, 'Meget god', '0-1 år', 'Greve', 'Tjørnelyhuset', '🏡', '#FFB347', ARRAY['møbler','baby'], '{}', 0, 5, true, NULL),
  ('Brætspil-samling (8 stk)', 'Ludo, Uno, Skip-Bo og flere. De fleste komplette.', 'køb', 150, 'God', '6-12 år', 'Greve', 'Tjørnelyhuset', '🎲', '#FF6B9D', ARRAY['spil','indendørs'], '{}', 0, 4, true, NULL),
  ('Klatrestativ til udeleg', 'Bærbart stativ i galvaniseret stål.', 'køb', 600, 'God', '3-8 år', 'Greve', 'Tjørnelyhuset', '🧗', '#4CAF50', ARRAY['udeleg','bevægelse'], '{}', 0, 0, true, NULL),
  ('Aktivitetsmåtte med spejl', 'Stor aktivitetsmåtte til baby med hængende legetøj og spejl.', 'køb', 200, 'Meget god', '0-1 år', 'Karlslunde', 'Åsagergård', '🪞', '#06D6A0', ARRAY['sansestimulering','baby'], '{}', 0, 0, true, NULL),
  ('Rollespilskostumer (10 stk)', 'Superhelte, dyr og prinsesser. Vasket og klar.', 'køb', 200, 'God', '3-6 år', 'Karlslunde', 'Åsagergård', '🎭', '#EF476F', ARRAY['kreativitet','rolleleg'], '{}', 0, 4, true, NULL),
  ('Cykler til børn (3 stk)', 'Løbecykel + 2 trehjulede cykler. Hjelme medfølger.', 'køb', 450, 'God', '2-5 år', 'Karlslunde', 'Åsagergård', '🚲', '#118AB2', ARRAY['udeleg','bevægelse'], '{}', 0, 0, true, NULL),
  ('Puslespil-samling (15 stk)', 'Puslespil fra 12 til 100 brikker. Byd hvad du synes.', 'byd', NULL, 'God', '3-6 år', 'Greve', 'Greve Privatskoles Børnehave', '🧩', '#A78BFA', ARRAY['konstruktion','indendørs'], '{}', 2, 4, true, 50),
  ('Trampolin (ø 3 m)', 'Udendørs trampolin med sikkerhedsnet. Startbud 300 kr.', 'byd', NULL, 'Acceptabel', '3-6 år', 'Greve', 'Greve Privatskoles Børnehave', '⭕', '#4CAF50', ARRAY['udeleg','bevægelse'], '{}', 3, 7, true, 300),
  ('Vandlegetøj til badekar (3 sæt)', 'Badedyr, vandbøtter og formklodser. Byd.', 'byd', NULL, 'God', '3-6 år', 'Greve', 'Greve Privatskoles Børnehave', '🛁', '#118AB2', ARRAY['vand','sansestimulering'], '{}', 0, 2, true, 30),
  ('Musikinstrumenter til børn (sæt)', 'Tamburin, maracas, triangel og tromme. Startbud 75 kr.', 'byd', NULL, 'God', '1-4 år', 'Greve', 'Klax (Greve)', '🥁', '#EF476F', ARRAY['musik','kreativitet'], '{}', 0, 4, true, 75),
  ('Scooter (12-tommer hjul)', 'God scooter med justerbart styr. Startbud 150 kr.', 'byd', NULL, 'God', '3-8 år', 'Greve', 'Klax (Greve)', '🛴', '#FFD166', ARRAY['udeleg','bevægelse'], '{}', 1, 3, true, 150),
  ('Tegnebrætter og perler', 'Hama-perler (store sæt) + 3 peg-brætter. Byd.', 'byd', NULL, 'God', '3-6 år', 'Greve', 'Klax (Greve)', '🎨', '#FF6B9D', ARRAY['kreativitet'], '{}', 2, 1, true, 40),
  ('Gynger til legeplads (2 stk)', 'To robuste gynger med kæder. Kan skilles ad. Startbud 200.', 'byd', NULL, 'God', '3-6 år', 'Tune', 'Lundegårdens Frie Børnehave', '🕹️', '#F4831F', ARRAY['udeleg'], '{}', 1, 8, true, 200),
  ('Håndbold-sæt (8 bolde)', 'Otte håndboldbolde str. 0. Startbud 100 kr.', 'byd', NULL, 'Acceptabel', '3-6 år', 'Tune', 'Lundegårdens Frie Børnehave', '🤾', '#4CAF50', ARRAY['sport','udeleg'], '{}', 2, 0, true, 100),
  ('Duplo-tog sæt – bytter gerne', 'Togbane med tog og vogne. Bytter mod andet konstruktionslegetøj.', 'byt', NULL, 'God', '3-6 år', 'Tune', 'Lundegårdens Frie Børnehave', '🚂', '#FFD166', ARRAY['konstruktion','klassisk'], '{}', 0, 3, true, NULL),
  ('Køkkenlegesæt i træ', 'Komplet legetøjskøkken med gryder og madvarer. Bytter mod udelegetøj.', 'byt', NULL, 'Meget god', '2-5 år', 'Greve', 'Nældebjerg Børnegård', '🍳', '#EF476F', ARRAY['rolleleg','kreativitet'], '{}', 0, 6, true, NULL),
  ('Malebøger (20 stk ubrugte)', 'Diverse malebøger til børnehave. Bytter mod perler eller klæg.', 'byt', NULL, 'Meget god', '3-6 år', 'Greve', 'Nældebjerg Børnegård', '📚', '#A78BFA', ARRAY['kreativitet'], '{}', 0, 8, true, NULL),
  ('Ridehjelm str. 50-54', 'Ridehjelm næsten ny. Bytter mod sportsudstyr eller cykelhjelm.', 'byt', NULL, 'Meget god', '4-8 år', 'Greve', 'Nældebjerg Børnegård', '⛑️', '#06D6A0', ARRAY['sport'], '{}', 0, 6, true, NULL);

-- ── 3. Bud fra institutioner på hinandens opslag ────────────────
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Holmebo, Integreret institution', 120
FROM listings WHERE institution_name = 'Nova, Integreret institution'
  AND title ILIKE '%Puslespil%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Kernehuset, Integreret institution', 90
FROM listings WHERE institution_name = 'Nova, Integreret institution'
  AND title ILIKE '%Puslespil%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Skattekisten, Integreret institution', 450
FROM listings WHERE institution_name = 'Solstrålen, Integreret institution'
  AND title ILIKE '%Trampolin%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Damhuset afd. Dammen', 350
FROM listings WHERE institution_name = 'Solstrålen, Integreret institution'
  AND title ILIKE '%Trampolin%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Grevekæret afd. Kæret', 60
FROM listings WHERE institution_name = 'Kernehuset, Integreret institution'
  AND title ILIKE '%Vandlegetøj%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Sanglærkerne', 45
FROM listings WHERE institution_name = 'Kernehuset, Integreret institution'
  AND title ILIKE '%Vandlegetøj%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Troldebo, Integreret institution', 110
FROM listings WHERE institution_name = 'Holmebo, Integreret institution'
  AND title ILIKE '%Musikinstrumenter%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Vibemosen', 80
FROM listings WHERE institution_name = 'Holmebo, Integreret institution'
  AND title ILIKE '%Musikinstrumenter%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Mosebo', 200
FROM listings WHERE institution_name = 'Vibemosen'
  AND title ILIKE '%Scooter%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Solsikken', 175
FROM listings WHERE institution_name = 'Vibemosen'
  AND title ILIKE '%Scooter%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Toftegården, Integreret institution', 65
FROM listings WHERE institution_name = 'Troldebo, Integreret institution'
  AND title ILIKE '%Tegnebrætter%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Lundebo, Integreret institution', 350
FROM listings WHERE institution_name = 'Toftegården, Integreret institution'
  AND title ILIKE '%Gynger%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Troldehøjen', 275
FROM listings WHERE institution_name = 'Toftegården, Integreret institution'
  AND title ILIKE '%Gynger%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Eriksminde Børnehus', 180
FROM listings WHERE institution_name = 'Lundebo, Integreret institution'
  AND title ILIKE '%Håndbold%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Strandhuset', 100
FROM listings WHERE institution_name = 'Eriksminde Børnehus'
  AND title ILIKE '%Puslespil%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Prinsesseparken', 500
FROM listings WHERE institution_name = 'Strandhuset'
  AND title ILIKE '%Trampolin%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Åsagergård', 55
FROM listings WHERE institution_name = 'Sandrøjel'
  AND title ILIKE '%Vandlegetøj%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Nældebjerg Børnegård', 100
FROM listings WHERE institution_name = 'Klax (Greve)'
  AND title ILIKE '%Musikinstrumenter%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Greve Privatskoles Børnehave', 160
FROM listings WHERE institution_name = 'Nældebjerg Børnegård'
  AND title ILIKE '%Scooter%' AND type = 'byd' LIMIT 1;
INSERT INTO bids (listing_id, bidder_name, amount)
SELECT id, 'Lundegårdens Frie Børnehave', 50
FROM listings WHERE institution_name = 'Lillebo (Børnehaven Lillebo)'
  AND title ILIKE '%Tegnebrætter%' AND type = 'byd' LIMIT 1;

-- ── 4. Synkronisér bid_count ────────────────────────────────────
UPDATE listings SET bid_count = (
  SELECT COUNT(*) FROM bids WHERE bids.listing_id = listings.id
) WHERE type = 'byd';

-- ── 5. Bekræft ──────────────────────────────────────────────────
SELECT ownership_type, COUNT(*) as institutioner FROM institutions
WHERE email LIKE '%greve-demo%' GROUP BY ownership_type;

SELECT COUNT(*) as opslag, type FROM listings
WHERE institution_name IN ('Børnehaven Abels Hus', 'Børnehaven Vesterbo', 'Børnehuset Rådhushaven', 'Dagplejen Greve', 'Damhuset afd. Damager', /* ... */ 'Nældebjerg Børnegård')
GROUP BY type;

SELECT COUNT(*) as bud FROM bids;