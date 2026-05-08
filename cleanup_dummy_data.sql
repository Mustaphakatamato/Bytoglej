-- Slet alle dummy-data oprettet via seed_dummy_data.sql og setup.sql
-- Kør dette i Supabase SQL Editor

-- ────────────────────────────────────────────────────────────
-- 1. Slet beskeder og samtaler tilknyttet dummy-opslag
-- ────────────────────────────────────────────────────────────
delete from chat_messages
where conversation_id in (
  select c.id from conversations c
  join listings l on l.id = c.listing_id
  where l.institution_name in (
    'Solstrålen Børnehave', 'Havblik Vuggestue', 'Skoven SFO',
    'Solsikken Vuggestue', 'Regnbuen Børnehave', 'Havet SFO',
    'Lindebjerg Skole', 'Månen Børnehave', 'Stjernerne SFO',
    'Eventyrhaven Børnehave', 'Bakkeskolen SFO', 'Skovtrolden Vuggestue'
  )
);

delete from conversations
where listing_id in (
  select id from listings
  where institution_name in (
    'Solstrålen Børnehave', 'Havblik Vuggestue', 'Skoven SFO',
    'Solsikken Vuggestue', 'Regnbuen Børnehave', 'Havet SFO',
    'Lindebjerg Skole', 'Månen Børnehave', 'Stjernerne SFO',
    'Eventyrhaven Børnehave', 'Bakkeskolen SFO', 'Skovtrolden Vuggestue'
  )
);

-- ────────────────────────────────────────────────────────────
-- 2. Slet bud tilknyttet dummy-opslag
-- ────────────────────────────────────────────────────────────
delete from bids
where listing_id in (
  select id from listings
  where institution_name in (
    'Solstrålen Børnehave', 'Havblik Vuggestue', 'Skoven SFO',
    'Solsikken Vuggestue', 'Regnbuen Børnehave', 'Havet SFO',
    'Lindebjerg Skole', 'Månen Børnehave', 'Stjernerne SFO',
    'Eventyrhaven Børnehave', 'Bakkeskolen SFO', 'Skovtrolden Vuggestue'
  )
);

-- ────────────────────────────────────────────────────────────
-- 3. Slet dummy-opslag
-- ────────────────────────────────────────────────────────────
delete from listings
where institution_name in (
  'Solstrålen Børnehave', 'Havblik Vuggestue', 'Skoven SFO',
  'Solsikken Vuggestue', 'Regnbuen Børnehave', 'Havet SFO',
  'Lindebjerg Skole', 'Månen Børnehave', 'Stjernerne SFO',
  'Eventyrhaven Børnehave', 'Bakkeskolen SFO', 'Skovtrolden Vuggestue'
);

-- ────────────────────────────────────────────────────────────
-- 4. Slet dummy-institutioner (kun de tre fra seed_dummy_data.sql)
-- ────────────────────────────────────────────────────────────
delete from institutions
where cvr in ('11111111', '22222222', '33333333');
