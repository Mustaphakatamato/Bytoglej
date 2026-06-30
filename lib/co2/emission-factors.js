// CO2 emission factors — methodology v1.0
// All values are CONSERVATIVE estimates (low end of published LCA ranges).
// Source IDs reference /baeredygtighed/metode and docs/CO2_METHODOLOGY.md.
// DO NOT change these values without bumping METHODOLOGY_VERSION and creating
// a new entry in co2_methodology_versions.

export const METHODOLOGY_VERSION = '1.1';

export const EMISSION_FACTORS = {
  'books':                { nameDA: 'Bøger',                       co2KgPerUnit: 1.0,  sources: ['S1', 'S5'] },
  'puzzles':              { nameDA: 'Puslespil',                   co2KgPerUnit: 1.5,  sources: ['S5'] },
  'board-games':          { nameDA: 'Brætspil',                    co2KgPerUnit: 2.0,  sources: ['S1', 'S5'] },
  'plush-small':          { nameDA: 'Bamser & plysdyr (lille)',     co2KgPerUnit: 2.5,  sources: ['S1', 'S2'] },
  'plush-large':          { nameDA: 'Bamser & plysdyr (stor)',      co2KgPerUnit: 5.0,  sources: ['S1', 'S2'] },
  'wooden-toys':          { nameDA: 'Trælegetøj & klodser',         co2KgPerUnit: 2.0,  sources: ['S1', 'S5'] },
  'plastic-toys-small':   { nameDA: 'Plastiklegetøj (lille)',       co2KgPerUnit: 1.5,  sources: ['S1', 'S2'] },
  'plastic-toys-medium':  { nameDA: 'Plastiklegetøj (medium)',      co2KgPerUnit: 3.0,  sources: ['S1', 'S2'] },
  'plastic-toys-large':   { nameDA: 'Plastiklegetøj (stor)',        co2KgPerUnit: 8.0,  sources: ['S1', 'S2'] },
  'construction-toys':    { nameDA: 'Konstruktionslegetøj',         co2KgPerUnit: 4.0,  sources: ['S1'] },
  'outdoor-toys':         { nameDA: 'Udelegetøj',                   co2KgPerUnit: 4.0,  sources: ['S1', 'S2'] },
  'ride-on-toys':         { nameDA: 'Cykler, løbehjul & lign.',     co2KgPerUnit: 30.0, sources: ['S4', 'S5'] },
  'electronic-toys':      { nameDA: 'Elektronisk legetøj',          co2KgPerUnit: 12.0, sources: ['S1', 'S2'] },
  'children-furniture':   { nameDA: 'Børnemøbler',                  co2KgPerUnit: 20.0, sources: ['S4', 'S5'] },
  'baby-equipment':       { nameDA: 'Babyudstyr',                   co2KgPerUnit: 15.0, sources: ['S4', 'S5'] },
  'musical-instruments':  { nameDA: 'Musikinstrumenter',            co2KgPerUnit: 4.0,  sources: ['S5'] },
  'sports-equipment':     { nameDA: 'Sportsudstyr',                 co2KgPerUnit: 3.0,  sources: ['S5'] },
  'costumes-roleplay':    { nameDA: 'Kostumer & rollespil',          co2KgPerUnit: 3.0,  sources: ['S2'] },
  'art-craft-supplies':   { nameDA: 'Kreativt & hobby',             co2KgPerUnit: 1.5,  sources: ['S5'] },
  'other':                { nameDA: 'Andet',                        co2KgPerUnit: 2.0,  sources: [] },
};

// Maps legacy category keys (pre-v1.0 taxonomy) to new keys.
// Used for backward-compat when displaying CO2 for old listings.
export const LEGACY_CATEGORY_MAP = {
  'legetoj':       'other',               // too broad — conservative fallback
  'udendoers':     'outdoor-toys',
  'kreativitet':   'art-craft-supplies',
  'boeger-spil':   'books',
  'mobler':        'children-furniture',
  'baby':          'baby-equipment',
  'kostumer':      'costumes-roleplay',
  'musik':         'musical-instruments',
  'sport-motorik': 'sports-equipment',
};
