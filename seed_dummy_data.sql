-- Dummy data: 3 test-institutioner med opslag
-- Kør dette i Supabase SQL Editor
-- OBS: user_id er NULL på opslag (ingen tilknyttet auth-bruger)

-- ────────────────────────────────────────────────────────────
-- 1. Institutioner
-- ────────────────────────────────────────────────────────────
insert into institutions (cvr, name, institution_type, ownership_type, address, zipcode, city, children_count, phone, email, leader_name, contact_name)
values
  ('11111111', 'Solstrålen Børnehave',  'Børnehave',  'Kommunal',  'Blomstervej 12',    '2600', 'Glostrup',   48, '43218765', 'solstraalen@test.dk',  'Hanne Nielsen',  'Hanne Nielsen'),
  ('22222222', 'Havblik Vuggestue',     'Vuggestue',  'Privat',    'Strandpromenaden 3','3000', 'Helsingør',  22, '49123456', 'havblik@test.dk',      'Lars Mortensen', 'Lars Mortensen'),
  ('33333333', 'Skoven SFO',            'SFO',        'Kommunal',  'Skovvej 55',        '8000', 'Aarhus C',   85, '86543210', 'skoven-sfo@test.dk',   'Dorte Hansen',   'Dorte Hansen')
on conflict (cvr) do nothing;

-- ────────────────────────────────────────────────────────────
-- 2. Opslag tilknyttet institutionerne
-- ────────────────────────────────────────────────────────────

-- Solstrålen Børnehave – Glostrup
insert into listings (title, description, type, price, condition, age_group, city, institution_name, emoji, color, tags, images, bid_count, is_active)
values
  (
    'LEGO Duplo – stor kasse',
    'Ca. 200 LEGO Duplo klodser i god stand. Sælges da vi har fået doneret nyt sæt. Afhentes i Glostrup.',
    'køb', 150, 'God', '1-3 år', 'Glostrup', 'Solstrålen Børnehave',
    '🧱', '#FFD166', ARRAY['konstruktion','klassisk'], '{}', 0, true
  ),
  (
    'Gyngehest i træ',
    'Klassisk gyngehest i massivt træ. Lettere slitage på maling men ellers i fin stand. Bytter gerne mod andet motoriklegetøj.',
    'byt', null, 'God', '1-4 år', 'Glostrup', 'Solstrålen Børnehave',
    '🐴', '#A78BFA', ARRAY['motorik','klassisk'], '{}', 0, true
  ),
  (
    'Rollespils-kostumer (10 stk)',
    'Diverse kostumer: superhelte, dyr og prinsesser. Alt er vasket og klar. Startbud 50 kr.',
    'byd', null, 'God', '3-6 år', 'Glostrup', 'Solstrålen Børnehave',
    '🎭', '#EF476F', ARRAY['kreativitet','rolleleg'], '{}', 0, true
  ),

-- Havblik Vuggestue – Helsingør
  (
    'Bløde motorikpuder (6 stk)',
    'Sæt motorikpuder i skum. Bruges til bevægelse og balance. Næsten nye – institutionen er lukket ned og vi sælger ud.',
    'køb', 250, 'Meget god', '0-2 år', 'Helsingør', 'Havblik Vuggestue',
    '🟦', '#06D6A0', ARRAY['motorik','bevægelse'], '{}', 0, true
  ),
  (
    'Badekar-legetøj sæt',
    'Tre sæt badekar-legetøj med badedyr, vandbøtter og formklodser. Bytter gerne mod puslespil eller bøger.',
    'byt', null, 'God', '0-2 år', 'Helsingør', 'Havblik Vuggestue',
    '🛁', '#118AB2', ARRAY['vand','sansestimulering'], '{}', 0, true
  ),
  (
    'Kravlegård i træ',
    'Solid kravlegård i birketræ, 120×120 cm. Alle stænger intakte. Demonteret og klar til afhentning. Byd hvad du synes.',
    'byd', null, 'Meget god', '0-1 år', 'Helsingør', 'Havblik Vuggestue',
    '🏡', '#FFB347', ARRAY['møbler','baby'], '{}', 0, true
  ),

-- Skoven SFO – Aarhus
  (
    'Klatrestativer til udeleg (2 stk)',
    'To bærbare klatrestativer i galvaniseret stål. Bruges til forhindringsbane. Sælges samlet, pris pr. stk. 400 kr.',
    'køb', 800, 'God', '6-12 år', 'Aarhus C', 'Skoven SFO',
    '🧗', '#4CAF50', ARRAY['udeleg','bevægelse'], '{}', 0, true
  ),
  (
    'Brætspil-samling (12 stk)',
    'Bl.a. Ludo, Uno, Skip-Bo, Matador og Trivial Pursuit Junior. De fleste er komplette. Bytter gerne mod kreativt materiale.',
    'byt', null, 'God', '6-12 år', 'Aarhus C', 'Skoven SFO',
    '🎲', '#FF6B9D', ARRAY['spil','indendørs'], '{}', 0, true
  ),
  (
    'Håndbold-sæt (10 bolde + mål)',
    'Ti håndboldbolde i str. 0 + et sammenfoldeligt mål. Startbud 100 kr. for hele pakken.',
    'byd', null, 'Acceptabel', '6-12 år', 'Aarhus C', 'Skoven SFO',
    '🤾', '#F4831F', ARRAY['sport','udeleg'], '{}', 0, true
  );
