// ────────────────────────────────────────────────────────────────────────────
// HJÆLPECENTER, fælles indholdsbibliotek
//
// Dette er ÉN kilde til hjælp på byt&leg. Den driver:
//   1. Hjælpecentret (/hjaelp), det brugeren læser
//   2. (planlagt) Support-AI'en, så svar og artikler aldrig kommer ud af sync
//
// VIGTIGT: Alt indhold her skal være FAKTUELT korrekt og i sync med
// lib/support-knowledge.js og lib/pricing.js. Gæt aldrig priser, regler eller
// løfter. Findes en funktion ikke endnu (fx EAN-fakturering), så skriv det ikke.
//
// Skema:
//   CATEGORIES: { slug, title, icon, color, desc }
//   ARTICLES:   { slug, category, title, icon, excerpt, blocks[], related[] }
//   blocks[]:   { type: 'p' | 'h' | 'ul' | 'ol' | 'note' | 'cta', ... }
// ────────────────────────────────────────────────────────────────────────────

import { PRIMARY, BUTTER, SKY, CORAL } from '@/lib/constants';

const PURPLE = '#7C3AED';

export const CATEGORIES = [
  { slug: 'kom-godt-i-gang', title: 'Kom godt i gang', icon: '🚀', color: PRIMARY,
    desc: 'Hvad byt&leg er, hvem der kan være med, og hvordan I opretter konto.' },
  { slug: 'saelg-og-opret', title: 'Sælg & opret opslag', icon: '🏷️', color: BUTTER,
    desc: 'Opret opslag med AI, vælg handelstype og send når du har solgt.' },
  { slug: 'koeb-byd-byt', title: 'Køb, byd & byt', icon: '🛍️', color: CORAL,
    desc: 'Sådan køber, byder og bytter I trygt med andre institutioner.' },
  { slug: 'betaling-og-gebyrer', title: 'Betaling & gebyrer', icon: '💳', color: PRIMARY,
    desc: 'Hvad det koster, køber- og byttebeskyttelse, og hvordan betaling foregår.' },
  { slug: 'forsendelse', title: 'Forsendelse & levering', icon: '📦', color: SKY,
    desc: 'Fragtfirmaer, pris, afhentning og sporing af pakker.' },
  { slug: 'tryghed-og-konto', title: 'Tryghed & konto', icon: '🛡️', color: PURPLE,
    desc: 'Verificering, tvister, notifikationer, GDPR og sletning af konto.' },
  { slug: 'baeredygtighed', title: 'Bæredygtighed', icon: '🌱', color: PRIMARY,
    desc: 'Sådan beregner vi CO₂-besparelsen ved hver handel.' },
];

export const ARTICLES = [
  // ── Kom godt i gang ───────────────────────────────────────────────────────
  {
    slug: 'hvad-er-byt-og-leg',
    category: 'kom-godt-i-gang',
    title: 'Hvad er byt&leg?',
    icon: '👋',
    excerpt: 'En dansk markedsplads hvor institutioner køber, sælger og bytter brugt legetøj.',
    blocks: [
      { type: 'p', text: 'byt&leg er en dansk B2B-markedsplads, hvor institutioner køber, sælger og bytter brugt legetøj. Formålet er at fremme bæredygtig genbrug af legetøj i institutionssektoren, så godt legetøj får nyt liv et nyt sted i stedet for at blive smidt ud.' },
      { type: 'p', text: 'Platformen findes både som hjemmeside og som app, du kan installere på telefonen (en såkaldt PWA).' },
      { type: 'h', text: 'Hvad kan I på platformen?' },
      { type: 'ul', items: [
        'Sælge legetøj I ikke længere bruger, til en fast pris',
        'Modtage bud og forhandle prisen',
        'Bytte legetøj direkte med en anden institution',
        'Efterlyse noget bestemt, I mangler ("Søges")',
      ] },
      { type: 'cta', href: '/hvordan', label: 'Se den visuelle gennemgang af hvordan det virker' },
    ],
    related: ['hvem-kan-bruge-platformen', 'opret-konto-og-godkendelse'],
  },
  {
    slug: 'hvem-kan-bruge-platformen',
    category: 'kom-godt-i-gang',
    title: 'Hvem kan bruge byt&leg?',
    icon: '🏫',
    excerpt: 'Kun CVR-registrerede institutioner i Danmark. Ikke private.',
    blocks: [
      { type: 'p', text: 'byt&leg er udelukkende for CVR-registrerede institutioner i Danmark.' },
      { type: 'ul', items: [
        'Vuggestuer og børnehaver',
        'SFO\'er og folkeskoler',
        'Fritidsklubber og lignende institutioner',
      ] },
      { type: 'note', tone: 'info', text: 'Private enkeltpersoner kan ikke oprette konto. Alt legetøj på platformen skal tilhøre institutionen og bruges i institutionsmæssig sammenhæng.' },
    ],
    related: ['opret-konto-og-godkendelse', 'hvad-er-byt-og-leg'],
  },
  {
    slug: 'opret-konto-og-godkendelse',
    category: 'kom-godt-i-gang',
    title: 'Opret konto & bliv godkendt',
    icon: '✅',
    excerpt: 'Tilmeld med CVR. Godkendelse tager typisk 1-2 hverdage.',
    blocks: [
      { type: 'p', text: 'Det er gratis at oprette konto og tilmelde institutionen. Sådan kommer I i gang:' },
      { type: 'ol', items: [
        'Gå til tilmelding og angiv jeres CVR-nummer.',
        'Vi slår automatisk CVR-nummeret op i Erhvervsstyrelsens register og bekræfter, at institutionen er aktiv.',
        'I modtager en e-mail, når I er godkendt, det tager typisk 1-2 hverdage.',
        'Når I er godkendt, kan I logge ind og begynde at oprette opslag.',
      ] },
      { type: 'note', tone: 'tip', text: 'Mens I venter på godkendelse, kan I allerede se jer omkring på markedspladsen.' },
      { type: 'cta', href: '/signup', label: 'Tilmeld jeres institution' },
    ],
    related: ['hvem-kan-bruge-platformen', 'tilfoej-medarbejdere', 'installer-app'],
  },
  {
    slug: 'tilfoej-medarbejdere',
    category: 'kom-godt-i-gang',
    title: 'Tilføj medarbejdere til kontoen',
    icon: '👥',
    excerpt: 'Inviter kolleger, så flere kan oprette og håndtere opslag.',
    blocks: [
      { type: 'p', text: 'Flere kolleger fra samme institution kan dele kontoen. Det er praktisk, så det ikke kun er én person, der står for alt.' },
      { type: 'ol', items: [
        'Gå til Medarbejdere fra din profil.',
        'Inviter en kollega med deres e-mail.',
        'De får en invitation og kan logge ind under jeres institution.',
      ] },
      { type: 'cta', href: '/medarbejdere', label: 'Gå til Medarbejdere' },
    ],
    related: ['opret-konto-og-godkendelse'],
  },
  {
    slug: 'installer-app',
    category: 'kom-godt-i-gang',
    title: 'Installer byt&leg som app',
    icon: '📲',
    excerpt: 'byt&leg kan installeres på telefonen som en app (PWA).',
    blocks: [
      { type: 'p', text: 'byt&leg er en PWA, hvilket betyder at du kan installere hjemmesiden som en app på din telefon, uden at gå i App Store eller Google Play.' },
      { type: 'ul', items: [
        'På iPhone (Safari): tryk på Del-ikonet og vælg "Føj til hjemmeskærm".',
        'På Android (Chrome): tryk på menuen og vælg "Installér app" / "Føj til startskærm".',
      ] },
      { type: 'note', tone: 'tip', text: 'Med app\'en installeret kan du også slå notifikationer til, så du får besked om bud, beskeder og handler.' },
    ],
    related: ['notifikationer', 'opret-konto-og-godkendelse'],
  },

  // ── Sælg & opret opslag ───────────────────────────────────────────────────
  {
    slug: 'opret-opslag-med-ai',
    category: 'saelg-og-opret',
    title: 'Opret et opslag med AI',
    icon: '✨',
    excerpt: 'Tag ét billede. AI foreslår titel, kategori, alder, stand og tekst.',
    blocks: [
      { type: 'p', text: 'Det tager under to minutter at oprette et opslag. Du behøver kun at tage ét billede. Vores AI klarer det meste af resten.' },
      { type: 'ol', items: [
        'Tag ét billede af legetøjet med telefonen.',
        'AI foreslår automatisk titel, kategori, aldersgruppe, stand og beskrivelse.',
        'Tjek forslaget igennem og ret det, du har lyst til.',
        'Vælg om det skal være køb, byd eller byt, og sæt evt. en pris.',
        'Publicér. Opslaget er straks synligt for alle verificerede institutioner i hele landet.',
      ] },
      { type: 'note', tone: 'info', text: 'AI tjekker automatisk billederne og afviser opslag, hvis der er mennesker eller børn på. Sådan beskytter vi privatlivet og holder platformen sikker.' },
      { type: 'cta', href: '/opret-opslag', label: 'Opret et opslag nu' },
    ],
    related: ['de-fire-opslagstyper', 'gode-billeder', 'rediger-eller-slet-opslag'],
  },
  {
    slug: 'de-fire-opslagstyper',
    category: 'saelg-og-opret',
    title: 'De fire opslagstyper: køb, byd, byt & søges',
    icon: '🔀',
    excerpt: 'Vælg fastpris, åbn for bud, tilbyd bytte, eller efterlys noget.',
    blocks: [
      { type: 'p', text: 'Når du opretter et opslag, vælger du, hvordan du vil handle:' },
      { type: 'h', text: 'Køb (fastpris)' },
      { type: 'p', text: 'Du sætter en fast pris. Køber ser prisen og kan købe med det samme. Ingen forhandling.' },
      { type: 'h', text: 'Byd (forhandl)' },
      { type: 'p', text: 'Køber kan sende et bud under prisen og forhandle via chat med modbud. Et accepteret bud reserveres til køber i 24 timer.' },
      { type: 'h', text: 'Byt (bytehandel)' },
      { type: 'p', text: 'En anden institution kan tilbyde et af sine egne opslag som betaling, bundt for bundt, uden penge imellem jer (ud over et evt. aftalt mellemlag).' },
      { type: 'h', text: 'Søges' },
      { type: 'p', text: 'Mangler I noget bestemt, kan I oprette et "Søges"-opslag og efterlyse det. Også her kan AI hjælpe: skriv frit hvad I mangler, så laver den et færdigt søges-opslag.' },
    ],
    related: ['opret-opslag-med-ai', 'saadan-byder-du', 'saadan-bytter-du'],
  },
  {
    slug: 'gode-billeder',
    category: 'saelg-og-opret',
    title: 'Tag gode billeder af legetøjet',
    icon: '📸',
    excerpt: 'Gode, ærlige billeder giver flere henvendelser.',
    blocks: [
      { type: 'p', text: 'Billedet er det første en køber ser, og det er nok til, at AI kan udfylde resten af opslaget. Et par enkle råd:' },
      { type: 'ul', items: [
        'Tag billedet i godt, naturligt lys.',
        'Vis legetøjet tydeligt mod en rolig baggrund.',
        'Tag gerne flere billeder, så stand og detaljer er ærligt vist.',
        'Vis evt. slid eller mangler. Ærlige opslag giver tilfredse købere og færre tvister.',
      ] },
      { type: 'note', tone: 'warn', text: 'Undgå mennesker og børn på billederne. AI afviser automatisk opslag med personer på, af hensyn til privatliv og GDPR.' },
    ],
    related: ['opret-opslag-med-ai'],
  },
  {
    slug: 'rediger-eller-slet-opslag',
    category: 'saelg-og-opret',
    title: 'Rediger eller slet et opslag',
    icon: '✏️',
    excerpt: 'Du kan altid opdatere eller fjerne dine egne opslag.',
    blocks: [
      { type: 'p', text: 'Du finder alle dine opslag under "Mine opslag". Herfra kan du redigere eller fjerne dem.' },
      { type: 'ul', items: [
        'Rediger for at opdatere pris, beskrivelse, billeder eller handelstype.',
        'Slet, hvis legetøjet ikke længere er tilgængeligt.',
      ] },
      { type: 'cta', href: '/mine-opslag', label: 'Gå til Mine opslag' },
    ],
    related: ['opret-opslag-med-ai', 'naar-du-har-solgt'],
  },
  {
    slug: 'naar-du-har-solgt',
    category: 'saelg-og-opret',
    title: 'Når du har solgt: pak & send',
    icon: '📋',
    excerpt: 'Pak varen og send den til køber med fragtmærkat.',
    blocks: [
      { type: 'p', text: 'Når en handel er på plads, skal varen pakkes og sendes. Du finder dine opgaver under "Skal sendes".' },
      { type: 'ol', items: [
        'Pak legetøjet forsvarligt.',
        'Send pakken med den valgte fragtmulighed (PostNord, GLS eller DAO), eller aftal afhentning direkte med køber.',
        'Når køber har bekræftet, at varen er modtaget, frigives betalingen til jer.',
      ] },
      { type: 'note', tone: 'info', text: 'byt&leg holder betalingen sikkert (escrow), indtil køber har bekræftet modtagelse. Det giver tryghed for begge parter.' },
      { type: 'cta', href: '/mine-opgaver', label: 'Se hvad der skal sendes' },
    ],
    related: ['fragtfirmaer-og-pris', 'koeberbeskyttelse'],
  },

  {
    slug: 'forbudte-varer',
    category: 'saelg-og-opret',
    title: 'Hvad må lægges op?',
    icon: '🚫',
    excerpt: 'Reglerne for hvad I må sælge og bytte på byt&leg.',
    blocks: [
      { type: 'p', text: 'byt&leg er til brugt legetøj, der tilhører institutionen. Et par enkle regler holder platformen tryg:' },
      { type: 'ul', items: [
        'Legetøjet skal tilhøre institutionen og bruges i institutionsmæssig sammenhæng.',
        'Der må ikke være mennesker eller børn på billederne. AI afviser automatisk den slags af hensyn til privatliv og GDPR.',
        'Beskriv ærligt stand og eventuelle mangler.',
      ] },
      { type: 'p', text: 'Ser du et opslag, der ikke hører hjemme her, kan du anmelde det med årsagen "Forbudt genstand".' },
      { type: 'note', tone: 'info', text: 'Er du i tvivl om noget bestemt må lægges op, så spørg supportteamet, før du opretter opslaget.' },
    ],
    related: ['gode-billeder', 'anmeld-opslag-eller-samtale', 'hvem-kan-bruge-platformen'],
  },

  // ── Køb, byd & byt ────────────────────────────────────────────────────────
  {
    slug: 'saadan-koeber-du',
    category: 'koeb-byd-byt',
    title: 'Sådan køber du',
    icon: '🛍️',
    excerpt: 'Læg i kurv, betal trygt, og bekræft når varen er modtaget.',
    blocks: [
      { type: 'ol', items: [
        'Find et opslag du vil købe, og læg det i kurven.',
        'Gå til checkout, vælg evt. forsendelse, og betal.',
        'Sælger pakker og sender varen til dig.',
        'Bekræft modtagelsen, når pakken er kommet, så frigives betalingen til sælger.',
      ] },
      { type: 'note', tone: 'info', text: 'Alle køb er dækket af køberbeskyttelse. Ankommer varen ikke, eller passer den slet ikke med opslaget, får du pengene tilbage.' },
      { type: 'cta', href: '/opslag', label: 'Se alle opslag' },
    ],
    related: ['koeberbeskyttelse', 'saadan-betaler-du', 'favoritter-og-soegninger'],
  },
  {
    slug: 'saadan-byder-du',
    category: 'koeb-byd-byt',
    title: 'Sådan byder du',
    icon: '💰',
    excerpt: 'Send et bud under prisen og forhandl med modbud i chatten.',
    blocks: [
      { type: 'p', text: 'På opslag der er åbne for bud, kan du forhandle prisen:' },
      { type: 'ol', items: [
        'Send et bud under udbudsprisen.',
        'Sælger kan acceptere, afvise eller sende et modbud. I forhandler via chatten.',
        'Når begge siger ja, reserveres varen til dig i 24 timer, så du kan betale.',
      ] },
      { type: 'note', tone: 'tip', text: 'Et accepteret bud er en aftale. Husk at gennemføre købet inden for de 24 timer.' },
    ],
    related: ['de-fire-opslagstyper', 'saadan-koeber-du', 'koeberbeskyttelse'],
  },
  {
    slug: 'saadan-bytter-du',
    category: 'koeb-byd-byt',
    title: 'Sådan bytter du',
    icon: '🔄',
    excerpt: 'Byt bundt for bundt med en anden institution, uden penge imellem.',
    blocks: [
      { type: 'p', text: 'Ved bytte tilbyder I et af jeres egne opslag som betaling for et andet. To institutioner bytter bundt for bundt.' },
      { type: 'ol', items: [
        'Find et opslag du vil bytte dig til, og foreslå et af dine egne opslag som bytte.',
        'I bliver enige om byttet og godkender det i chatten.',
        'Begge parter sender hver sin pakke samtidig, så ingen venter på den anden.',
      ] },
      { type: 'note', tone: 'info', text: 'Begge parter betaler deres andel (forsendelse + byttebeskyttelse på 10 kr. pr. part) inden for 48 timer efter byttet er godkendt. Betaler en part ikke i tide, annulleres handlen automatisk, og betalte beløb refunderes.' },
    ],
    related: ['byttebeskyttelse', 'de-fire-opslagstyper'],
  },
  {
    slug: 'favoritter-og-soegninger',
    category: 'koeb-byd-byt',
    title: 'Favoritter & gemte søgninger',
    icon: '❤️',
    excerpt: 'Gem opslag du holder øje med, og få besked om nye fund.',
    blocks: [
      { type: 'p', text: 'Holder du øje med noget bestemt, kan du bruge favoritter og gemte søgninger:' },
      { type: 'ul', items: [
        'Tryk på hjertet på et opslag for at gemme det som favorit.',
        'Gem en søgning, så du får besked, når der dukker nye relevante opslag op.',
      ] },
      { type: 'cta', href: '/favoritter', label: 'Se dine favoritter' },
    ],
    related: ['saadan-koeber-du', 'notifikationer'],
  },

  // ── Betaling & gebyrer ────────────────────────────────────────────────────
  {
    slug: 'hvad-koster-det',
    category: 'betaling-og-gebyrer',
    title: 'Hvad koster det at bruge byt&leg?',
    icon: '🪙',
    excerpt: 'Gratis at oprette og lægge op. Køber- og byttebeskyttelse ved handel.',
    blocks: [
      { type: 'p', text: 'Det er gratis at oprette konto, tilmelde sig og lægge opslag op. Der er intet abonnement og ingen kommission til sælger.' },
      { type: 'h', text: 'Hvad betaler man så?' },
      { type: 'ul', items: [
        'Ved køb betaler køber en køberbeskyttelse: 5% af varebeløbet + 5 kr.',
        'Ved bytte betaler hver part en byttebeskyttelse på 10 kr. pr. part.',
        'Forsendelse betales separat og afhænger af pakkens vægt.',
      ] },
      { type: 'note', tone: 'info', text: 'Sælger betaler altså intet for at lægge op eller sælge. Beskyttelsesgebyret betales af køber/byttepart og sikrer en tryg handel.' },
    ],
    related: ['koeberbeskyttelse', 'byttebeskyttelse', 'fragtfirmaer-og-pris'],
  },
  {
    slug: 'koeberbeskyttelse',
    category: 'betaling-og-gebyrer',
    title: 'Køberbeskyttelse (5% + 5 kr.)',
    icon: '🛡️',
    excerpt: 'Dækker alle køb og bud. Pengene holdes sikkert til du har modtaget.',
    blocks: [
      { type: 'p', text: 'Køberbeskyttelse gælder på alle køb og bud og koster 5% af varebeløbet + 5 kr.' },
      { type: 'ul', items: [
        'Hvis varen ikke ankommer, eller slet ikke passer med opslaget, får du pengene tilbage.',
        'byt&leg holder betalingen sikkert (escrow), indtil du har bekræftet modtagelse.',
        'Når levering er bekræftet, frigives varebeløbet til sælger.',
      ] },
    ],
    related: ['hvad-koster-det', 'saadan-betaler-du', 'tvister-og-reklamation'],
  },
  {
    slug: 'byttebeskyttelse',
    category: 'betaling-og-gebyrer',
    title: 'Byttebeskyttelse (10 kr. pr. part)',
    icon: '🤝',
    excerpt: 'Begge parter er dækket ved bytte. Handlen holdes i balance.',
    blocks: [
      { type: 'p', text: 'Ved byttehandel er begge parter dækket af en byttebeskyttelse på 10 kr. pr. part.' },
      { type: 'ul', items: [
        'Begge parter betaler deres andel (forsendelse + beskyttelse) inden for 48 timer efter byttet er godkendt.',
        'Hvis en part ikke betaler i tide, annulleres handlen automatisk, og betalte beløb refunderes.',
        'byt&leg holder handlen i balance, indtil begge pakker er sendt.',
      ] },
    ],
    related: ['saadan-bytter-du', 'hvad-koster-det'],
  },
  {
    slug: 'saadan-betaler-du',
    category: 'betaling-og-gebyrer',
    title: 'Sådan betaler du',
    icon: '💳',
    excerpt: 'Betal med kort (Stripe) eller MobilePay. Pengene holdes sikkert.',
    blocks: [
      { type: 'p', text: 'Betaling sker via platformen med betalingskort (gennem Stripe) eller MobilePay.' },
      { type: 'note', tone: 'info', text: 'Betalingen holdes sikkert af byt&leg, indtil levering er bekræftet. Først derefter frigives beløbet til sælger.' },
    ],
    related: ['koeberbeskyttelse', 'hvad-koster-det'],
  },

  {
    slug: 'annullering-og-refundering',
    category: 'betaling-og-gebyrer',
    title: 'Annullering & refundering',
    icon: '↩️',
    excerpt: 'Hvornår en handel annulleres, og hvordan du får pengene tilbage.',
    blocks: [
      { type: 'h', text: 'Ved køb' },
      { type: 'p', text: 'Alle køb og bud er dækket af køberbeskyttelse. Du får pengene tilbage, hvis varen ikke ankommer, eller slet ikke passer med opslaget. Betalingen holdes sikkert af byt&leg, indtil du har bekræftet modtagelse. Først derefter frigives den til sælger.' },
      { type: 'h', text: 'Ved bytte' },
      { type: 'p', text: 'Ved bytte skal begge parter betale deres andel inden for 48 timer efter byttet er godkendt. Betaler en part ikke i tide, annulleres handlen automatisk, og den part der nåede at betale, får sit beløb refunderet.' },
      { type: 'h', text: 'Hvor lang tid tager en refundering?' },
      { type: 'p', text: 'En refundering sendes tilbage til den betalingsmetode, du oprindeligt betalte med. Der kan gå nogle bankdage, før beløbet er tilbage på kontoen.' },
      { type: 'note', tone: 'info', text: 'Er du i tvivl om en konkret ordre eller refundering, så kontakt support. Den slags kan vi slå op for jer.' },
    ],
    related: ['koeberbeskyttelse', 'byttebeskyttelse', 'tvister-og-reklamation'],
  },

  // ── Forsendelse & levering ────────────────────────────────────────────────
  {
    slug: 'fragtfirmaer-og-pris',
    category: 'forsendelse',
    title: 'Fragtfirmaer & pris',
    icon: '🚚',
    excerpt: 'PostNord, GLS og DAO. Prisen afhænger af vægt og findes automatisk.',
    blocks: [
      { type: 'p', text: 'Institutionerne sender selv pakkerne til hinanden. Platformen samarbejder med flere fragtfirmaer:' },
      { type: 'ul', items: [
        'PostNord',
        'GLS',
        'DAO (pakkeshop, og DAO også hjemmelevering)',
      ] },
      { type: 'p', text: 'Prisen afhænger af pakkens vægt, og den billigste pris findes automatisk. Den endelige forsendelsespris vises ved checkout.' },
      { type: 'note', tone: 'tip', text: 'Forsendelse er valgfrit. Bor I tæt på hinanden, kan I også aftale afhentning direkte med sælger.' },
    ],
    related: ['afhentning', 'spor-din-pakke', 'naar-du-har-solgt'],
  },
  {
    slug: 'afhentning',
    category: 'forsendelse',
    title: 'Afhentning i stedet for fragt',
    icon: '🤲',
    excerpt: 'Bor I tæt på hinanden, kan I aftale at hente direkte.',
    blocks: [
      { type: 'p', text: 'Forsendelse er valgfrit. Ligger institutionerne tæt på hinanden, kan I aftale at hente legetøjet direkte i stedet for at sende det. Det aftaler I indbyrdes via beskeder.' },
    ],
    related: ['fragtfirmaer-og-pris', 'beskeder-mellem-institutioner'],
  },
  {
    slug: 'spor-din-pakke',
    category: 'forsendelse',
    title: 'Spor din pakke',
    icon: '🔎',
    excerpt: 'Følg pakken fra sælger til dig.',
    blocks: [
      { type: 'p', text: 'Når sælger har sendt pakken med en af fragtmulighederne, kan du følge den frem til dig. Du finder dine handler under "Mine køb".' },
      { type: 'cta', href: '/mine-ordrer', label: 'Gå til Mine køb' },
    ],
    related: ['fragtfirmaer-og-pris', 'saadan-koeber-du'],
  },

  {
    slug: 'forsendelses-problemer',
    category: 'forsendelse',
    title: 'Forsinket, mistet eller beskadiget pakke',
    icon: '🚨',
    excerpt: 'Hvad du gør, hvis pakken ikke kommer frem som den skal.',
    blocks: [
      { type: 'p', text: 'Langt de fleste pakker når frem uden problemer. Skulle noget gå galt, er du dækket:' },
      { type: 'ul', items: [
        'Følg først pakken under "Mine køb". Nogle gange er den blot forsinket.',
        'Køberbeskyttelsen dækker, hvis varen ikke ankommer, eller slet ikke passer med opslaget. Så får du pengene tilbage.',
        'Betalingen frigives først til sælger, når du har bekræftet modtagelse. Så bekræft først, når du har set varen.',
      ] },
      { type: 'note', tone: 'tip', text: 'Tag gerne billeder, hvis en pakke ankommer beskadiget. Det hjælper sagen, hvis I kontakter support.' },
      { type: 'cta', href: '/kontakt', label: 'Kontakt support om en pakke' },
    ],
    related: ['spor-din-pakke', 'koeberbeskyttelse', 'tvister-og-reklamation'],
  },

  // ── Tryghed & konto ───────────────────────────────────────────────────────
  {
    slug: 'verificering',
    category: 'tryghed-og-konto',
    title: 'Hvorfor er alle institutioner verificeret?',
    icon: '✅',
    excerpt: 'Kun CVR-verificerede institutioner får adgang. Det giver tryghed.',
    blocks: [
      { type: 'p', text: 'Alle institutioner på byt&leg er verificeret via CVR-opslag i Erhvervsstyrelsens register, før de får adgang. Det betyder, at I altid handler med en rigtig, aktiv institution, ikke private eller anonyme profiler.' },
      { type: 'p', text: 'Sammen med køber- og byttebeskyttelse og sikker betaling er det med til at gøre hver handel tryg.' },
    ],
    related: ['opret-konto-og-godkendelse', 'tvister-og-reklamation'],
  },
  {
    slug: 'tvister-og-reklamation',
    category: 'tryghed-og-konto',
    title: 'Hvis et produkt ikke er som beskrevet',
    icon: '⚖️',
    excerpt: 'Kontakt support. Vi hjælper med mægling mellem institutionerne.',
    blocks: [
      { type: 'p', text: 'Vi opfordrer altid til at inspicere produktet, inden betalingen frigives. Opstår der en tvist, er du dækket:' },
      { type: 'ul', items: [
        'Køberbeskyttelsen dækker, hvis varen ikke ankommer eller slet ikke passer med opslaget, så får du pengene tilbage.',
        'Har I en uenighed, kan I kontakte support, så hjælper vi med mægling mellem institutionerne.',
      ] },
      { type: 'cta', href: '/kontakt', label: 'Kontakt support' },
    ],
    related: ['koeberbeskyttelse', 'kontakt-support'],
  },
  {
    slug: 'notifikationer',
    category: 'tryghed-og-konto',
    title: 'Notifikationer',
    icon: '🔔',
    excerpt: 'Få besked om bud, beskeder og handler.',
    blocks: [
      { type: 'p', text: 'Slå notifikationer til, så du ikke går glip af bud, beskeder eller opdateringer på dine handler. Du styrer notifikationer fra din profil.' },
      { type: 'note', tone: 'tip', text: 'Er notifikationer blokeret, skal du tillade dem for bytogleg.dk i din browsers indstillinger og prøve igen.' },
      { type: 'cta', href: '/profil', label: 'Gå til din profil' },
    ],
    related: ['installer-app', 'favoritter-og-soegninger'],
  },
  {
    slug: 'beskeder-mellem-institutioner',
    category: 'tryghed-og-konto',
    title: 'Beskeder mellem institutioner',
    icon: '💬',
    excerpt: 'Skriv direkte med en anden institution om en handel.',
    blocks: [
      { type: 'p', text: 'Institutioner kan skrive sammen direkte via besked-funktionen. Det bruges til at aftale handler, stille spørgsmål om et opslag og forhandle bud.' },
      { type: 'cta', href: '/beskeder', label: 'Gå til Beskeder' },
    ],
    related: ['saadan-byder-du', 'afhentning'],
  },
  {
    slug: 'gdpr-og-slet-konto',
    category: 'tryghed-og-konto',
    title: 'GDPR & sletning af konto',
    icon: '🗑️',
    excerpt: 'Kontakt support, så sletter vi jeres data efter GDPR.',
    blocks: [
      { type: 'p', text: 'Vil I slette jeres institutions konto, så kontakt support, så sletter vi alle jeres data i overensstemmelse med GDPR.' },
      { type: 'note', tone: 'info', text: 'Handler og beskeder anonymiseres og opbevares i op til 30 dage herefter.' },
      { type: 'cta', href: '/privatlivspolitik', label: 'Læs privatlivspolitikken' },
    ],
    related: ['kontakt-support'],
  },
  {
    slug: 'kontakt-support',
    category: 'tryghed-og-konto',
    title: 'Kontakt support',
    icon: '📧',
    excerpt: 'Skriv i chat-boblen eller mail support@bytogleg.dk.',
    blocks: [
      { type: 'p', text: 'Kan du ikke finde svaret her i hjælpecentret, er vi klar til at hjælpe:' },
      { type: 'ul', items: [
        'Skriv i chat-boblen nede i hjørnet. Vores AI-assistent svarer med det samme på de fleste spørgsmål og sender dig videre til supportteamet, hvis den er i tvivl.',
        'Supportteamet vender tilbage inden for 1-2 hverdage.',
        'Du kan også skrive til support@bytogleg.dk.',
      ] },
    ],
    related: ['tvister-og-reklamation', 'gdpr-og-slet-konto'],
  },

  {
    slug: 'anmeld-opslag-eller-samtale',
    category: 'tryghed-og-konto',
    title: 'Anmeld et opslag eller en samtale',
    icon: '🚩',
    excerpt: 'Se noget upassende? Rapportér det til os med få klik.',
    blocks: [
      { type: 'p', text: 'Støder du på et opslag eller en besked, der ikke hører hjemme på byt&leg, kan du anmelde det. Anmeldelsen går direkte til vores team.' },
      { type: 'h', text: 'Anmeld et opslag' },
      { type: 'ol', items: [
        'Åbn opslaget og vælg "Anmeld".',
        'Vælg en årsag: Misvisende beskrivelse, Upassende indhold, Forbudt genstand, Spam eller duplikat, eller Andet.',
        'Skriv evt. en uddybende note og send.',
      ] },
      { type: 'h', text: 'Anmeld en samtale' },
      { type: 'p', text: 'Inde i en samtale under Beskeder kan du anmelde modparten, hvis vedkommende opfører sig upassende, fx upassende eller stødende sprog, eller spam og reklame.' },
      { type: 'note', tone: 'info', text: 'Beskriv gerne så konkret som muligt, så vi hurtigt kan vurdere sagen.' },
    ],
    related: ['tvister-og-reklamation', 'forbudte-varer', 'kontakt-support'],
  },
  {
    slug: 'konto-kodeord-og-indstillinger',
    category: 'tryghed-og-konto',
    title: 'Kodeord, e-mail & indstillinger',
    icon: '🔐',
    excerpt: 'Skift kodeord, opdater e-mail og styr jeres kontoindstillinger.',
    blocks: [
      { type: 'h', text: 'Glemt kodeord' },
      { type: 'ol', items: [
        'Gå til login og vælg "Glemt kodeord?".',
        'Indtast jeres e-mail. Vi sender et nulstillingslink.',
        'Klik på linket i mailen (tjek evt. spam-mappen) og vælg et nyt kodeord.',
      ] },
      { type: 'note', tone: 'tip', text: 'Et sikkert kodeord er mindst 8 tegn med både store og små bogstaver, et tal og et specialtegn.' },
      { type: 'h', text: 'Skift e-mail og oplysninger' },
      { type: 'p', text: 'Under Indstillinger kan I opdatere profiloplysninger, e-mail, betaling, bundlerabatter, notifikationer, fortrolighed og sikkerhed.' },
      { type: 'cta', href: '/profil/rediger', label: 'Gå til Indstillinger' },
      { type: 'h', text: 'Luk konto' },
      { type: 'p', text: 'Vil I slette jeres konto, kontakter I support, så sletter vi jeres data i overensstemmelse med GDPR.' },
    ],
    related: ['notifikationer', 'gdpr-og-slet-konto', 'tilfoej-medarbejdere'],
  },

  // ── Bæredygtighed ─────────────────────────────────────────────────────────
  {
    slug: 'co2-besparelse',
    category: 'baeredygtighed',
    title: 'Sådan beregnes CO₂-besparelsen',
    icon: '🌱',
    excerpt: 'Hver handel sparer CO₂, beregnet ud fra produkttype og afstand.',
    blocks: [
      { type: 'p', text: 'Hver gang legetøj genbruges i stedet for at blive købt nyt, sparer I CO₂. Platformen beregner besparelsen automatisk ved hver handel.' },
      { type: 'p', text: 'Besparelsen afhænger af produkttype og afstand. Du kan altid se jeres samlede klimagevinst på jeres profil og under bæredygtighed.' },
      { type: 'cta', href: '/baeredygtighed/metode', label: 'Se metoden bag beregningen' },
    ],
    related: ['hvad-er-byt-og-leg'],
  },
];

// ── Opslags-rækkefølge til "Din guide til byt&leg" ────────────────────────────
// En kurateret sti for nye institutioner, fra konto til første handel.
export const GUIDE_STEPS = [
  { slug: 'hvad-er-byt-og-leg',     label: 'Forstå hvad byt&leg er' },
  { slug: 'opret-konto-og-godkendelse', label: 'Opret konto og bliv godkendt' },
  { slug: 'installer-app',          label: 'Installer app\'en på telefonen' },
  { slug: 'opret-opslag-med-ai',    label: 'Opret dit første opslag med AI' },
  { slug: 'de-fire-opslagstyper',   label: 'Vælg den rigtige handelstype' },
  { slug: 'saadan-koeber-du',       label: 'Lav dit første køb' },
  { slug: 'hvad-koster-det',        label: 'Forstå priser og beskyttelse' },
];

// Mest besøgte / vigtigste artikler, vises på forsiden af hjælpecentret.
export const POPULAR_SLUGS = [
  'opret-opslag-med-ai',
  'hvad-koster-det',
  'saadan-bytter-du',
  'koeberbeskyttelse',
  'annullering-og-refundering',
  'fragtfirmaer-og-pris',
];

// ── Opslagsfunktioner ─────────────────────────────────────────────────────────
export function getCategory(slug) {
  return CATEGORIES.find(c => c.slug === slug) || null;
}

export function getArticle(slug) {
  return ARTICLES.find(a => a.slug === slug) || null;
}

export function articlesInCategory(categorySlug) {
  return ARTICLES.filter(a => a.category === categorySlug);
}

export function countInCategory(categorySlug) {
  return articlesInCategory(categorySlug).length;
}

const blockText = (a) =>
  a.blocks.map(b => b.text || (b.items ? b.items.join(' ') : '')).join(' ');

// Kompakt indeks over hjælpeartikler til support-AI'en. Lader botten henvise
// brugeren til den rette artikel, uden at finde på stier. Samme kilde som
// hjælpecentret, så de aldrig kommer ud af sync.
export function helpArticleIndexForAI() {
  const byCat = CATEGORIES.map(c => {
    const arts = articlesInCategory(c.slug)
      .map(a => `  - ${a.title} (/hjaelp/artikel/${a.slug}): ${a.excerpt}`)
      .join('\n');
    return `${c.title}:\n${arts}`;
  }).join('\n\n');
  return `HJÆLPEARTIKLER I HJÆLPECENTRET. Du MÅ henvise til disse stier, de er alle gyldige:\n\n${byCat}`;
}

export function searchArticles(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  return ARTICLES
    .map(a => {
      const hay = `${a.title} ${a.excerpt} ${blockText(a)}`.toLowerCase();
      const titleHay = a.title.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (titleHay.includes(t)) score += 3;
        if (hay.includes(t)) score += 1;
      }
      return { article: a, score };
    })
    .filter(x => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .map(x => x.article);
}
