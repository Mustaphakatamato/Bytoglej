// CO2-aware category taxonomy v1.0
// Each key maps 1:1 to co2_emission_factors.id in the database
// and to EMISSION_FACTORS in lib/co2/emission-factors.js
export const CATEGORIES = [
  { key: 'books',               label: 'Bøger',                    emoji: '📚', sub: ['Billedbøger', 'Lærings- & fagbøger'] },
  { key: 'puzzles',             label: 'Puslespil',                emoji: '🧩', sub: [] },
  { key: 'board-games',         label: 'Brætspil',                 emoji: '🎲', sub: ['Brætspil & Kortspil', 'Sanglege & Rytmik'] },
  { key: 'plush-small',         label: 'Bamser & plysdyr (lille)', emoji: '🐻', sub: ['Dukker & Bløddyr'] },
  { key: 'plush-large',         label: 'Bamser & plysdyr (stor)',  emoji: '🧸', sub: [] },
  { key: 'wooden-toys',         label: 'Trælegetøj & klodser',     emoji: '🪵', sub: ['Trælegetøj'] },
  { key: 'plastic-toys-small',  label: 'Plastiklegetøj (lille)',   emoji: '🪀', sub: [] },
  { key: 'plastic-toys-medium', label: 'Plastiklegetøj (medium)',  emoji: '🚗', sub: ['Biler & Køretøjer'] },
  { key: 'plastic-toys-large',  label: 'Plastiklegetøj (stor)',    emoji: '🏰', sub: ['Rollespil & Figurer'] },
  { key: 'construction-toys',   label: 'Konstruktionslegetøj',     emoji: '🔧', sub: ['Konstruktion & Klodser'] },
  { key: 'outdoor-toys',        label: 'Udelegetøj',               emoji: '🌳', sub: ['Sandkasse & Vandleg', 'Trampoliner & Klatrestativer', 'Boldspil & Kasteredskaber', 'Haveleg'] },
  { key: 'ride-on-toys',        label: 'Cykler, løbehjul & lign.', emoji: '🚲', sub: ['Cykler & Løbecykler'] },
  { key: 'electronic-toys',     label: 'Elektronisk legetøj',      emoji: '🎮', sub: [] },
  { key: 'children-furniture',  label: 'Børnemøbler',              emoji: '🪑', sub: ['Hylder & Reoler', 'Borde & Stole', 'Opbevaringskasser', 'Telte & Hytter'] },
  { key: 'baby-equipment',      label: 'Babyudstyr',               emoji: '👶', sub: ['Babylegetøj 0-1 år', 'Sanselegetøj', 'Aktivitetslegetøj 1-3 år', 'Gå- & kravleredskaber'] },
  { key: 'musical-instruments', label: 'Musikinstrumenter',        emoji: '🎵', sub: ['Slagtøj & Rytmeinstrumenter', 'Strenge- & blæseinstrumenter', 'Lyd & Effektmaskiner'] },
  { key: 'sports-equipment',    label: 'Sportsudstyr',             emoji: '🏃', sub: ['Boldspil', 'Gymnastikmåtter & Puder', 'Balance & Koordination'] },
  { key: 'costumes-roleplay',   label: 'Kostumer & rollespil',     emoji: '🎭', sub: ['Udklædning & Kostumer', 'Dukketeater', 'Rollespilsudstyr'] },
  { key: 'art-craft-supplies',  label: 'Kreativt & hobby',         emoji: '🎨', sub: ['Tegning & Maleri', 'Håndværk & Collage', 'Ler & Modellering', 'Perler & Smykker'] },
  { key: 'other',               label: 'Andet',                    emoji: '📦', sub: [] },
];
