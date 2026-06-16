// CO2-aware category taxonomy v1.0
// Each key maps 1:1 to co2_emission_factors.id in the database
// and to EMISSION_FACTORS in lib/co2/emission-factors.js
// NOTE: subcategories are frontend-only and do NOT affect CO2 calculations
export const CATEGORIES = [
  { key: 'books',               label: 'Bøger',                    emoji: '📚', sub: ['Billedbøger', 'Lærings- & fagbøger', 'Pædagogiske materialer', 'Ordkort & flashcards', 'Sansebøger & aktivitetsbøger'] },
  { key: 'puzzles',             label: 'Puslespil',                emoji: '🧩', sub: ['Puslespil under 50 brikker', 'Puslespil 50–200 brikker', 'Puslespil 200+ brikker', 'Gulvpuslespil & kæmpepuslespil', '3D-puslespil'] },
  { key: 'board-games',         label: 'Brætspil',                 emoji: '🎲', sub: ['Brætspil & kortspil', 'Sanglege & rytmik', 'Huskelege & ordspil', 'Terningspil', 'Lotto & matchingspil'] },
  { key: 'plush-small',         label: 'Bamser & plysdyr (lille)', emoji: '🐻', sub: ['Dukker & bløddyr', 'Bamser & tøjdyr', 'Fingerdukker & hånddukker'] },
  { key: 'plush-large',         label: 'Bamser & plysdyr (stor)',  emoji: '🧸', sub: ['Store bamser & kæledyr', 'Store plysdyr', 'Store hygge- & liggedyr'] },
  { key: 'wooden-toys',         label: 'Trælegetøj & klodser',     emoji: '🪵', sub: ['Træklodser & byggelegetøj', 'Ringstabler & sorteringsspil', 'Jernbane & køretøjer i træ', 'Dukkehus & træfigurer', 'Labyrint & motorikbræt', 'Magnetisk trælegetøj'] },
  { key: 'plastic-toys-small',  label: 'Plastiklegetøj (lille)',   emoji: '🪀', sub: ['Figurer & minidyr', 'Magnetlegetøj & brikker', 'Badekar & vandlegetøj (lille)', 'Diverse plastiklegetøj (lille)'] },
  { key: 'plastic-toys-medium', label: 'Plastiklegetøj (medium)',  emoji: '🚗', sub: ['Biler & køretøjer', 'Køkken & maddelegetøj', 'Byggesæt & konstruktion (plast)', 'Diverse plastiklegetøj (medium)'] },
  { key: 'plastic-toys-large',  label: 'Plastiklegetøj (stor)',    emoji: '🏰', sub: ['Rollespil & figurer', 'Dukkehus & tilbehør', 'Legekøkken & legeshop', 'Diverse plastiklegetøj (stor)'] },
  { key: 'construction-toys',   label: 'Konstruktionslegetøj',     emoji: '🔧', sub: ['Konstruktion & klodser (generisk)', 'LEGO & LEGO Duplo', 'Magnetisk konstruktion', 'Mekanik & tandhjul', 'Genanvendelige & kreative byggematerialer'] },
  { key: 'outdoor-toys',        label: 'Udelegetøj',               emoji: '🌳', sub: ['Sandkasse & vandleg', 'Trampoliner & klatrestativer', 'Boldspil & kasteredskaber', 'Haveleg & plantning', 'Gynger & rutsjebaner', 'Vandlege & sprinkler'] },
  { key: 'ride-on-toys',        label: 'Cykler, løbehjul & lign.', emoji: '🚲', sub: ['Cykler & løbecykler', 'Løbehjul & skateboard', 'Gå-bil & ride-on', 'El-køretøjer (børn)'] },
  { key: 'electronic-toys',     label: 'Elektronisk legetøj',      emoji: '🎮', sub: ['Lyd & musiklegetøj', 'Interaktivt & lærings-elektronik', 'Fjernstyret legetøj', 'Lys & effektlegetøj', 'Højttalere & afspillere (børn)'] },
  { key: 'children-furniture',  label: 'Børnemøbler',              emoji: '🪑', sub: ['Hylder & reoler', 'Borde & stole', 'Opbevaringskasser & kurve', 'Telte & hytter', 'Madrasser & puder', 'Bænke & garderobestativer'] },
  { key: 'baby-equipment',      label: 'Babyudstyr',               emoji: '👶', sub: ['Babylegetøj 0–1 år', 'Sanselegetøj', 'Aktivitetslegetøj 1–3 år', 'Gå- & kravleredskaber', 'Badelegetøj', 'Mobiler & uro'] },
  { key: 'musical-instruments', label: 'Musikinstrumenter',        emoji: '🎵', sub: ['Slagtøj & rytmeinstrumenter', 'Strenge- & blæseinstrumenter', 'Xylofon & klokkespil', 'Keyboard & klaver (børn)', 'Lyd & effektmaskiner'] },
  { key: 'sports-equipment',    label: 'Sportsudstyr',             emoji: '🏃', sub: ['Boldspil & bolde', 'Gymnastikmåtter & puder', 'Balance & koordination', 'Hoppelege & motorik', 'Klatring & baneaktiviteter', 'Svømning & vandsport'] },
  { key: 'costumes-roleplay',   label: 'Kostumer & rollespil',     emoji: '🎭', sub: ['Udklædning & kostumer', 'Dukketeater & håndpupper', 'Rollespilsudstyr (generisk)', 'Køkken- & butikrollespil', 'Helte- & eventyrkostumer'] },
  { key: 'art-craft-supplies',  label: 'Kreativt & hobby',         emoji: '🎨', sub: ['Tegning & maleri', 'Håndværk & collage', 'Ler & modellering', 'Perler & smykker', 'Stempel & tryk', 'Syning & tekstil'] },
  { key: 'other',               label: 'Andet',                    emoji: '📦', sub: ['Terapi & sanseudstyr', 'Institutionsudstyr', 'Sæsonlegetøj & pynt', 'Samlede sæt & pakker', 'Diverse'] },
];
