// Fælles e-mail-validering med detektion af almindelige tastefejl.
// Bruges i login og opret-profil, så vi fanger fx ".cim" i stedet for ".com"
// eller ".di" i stedet for ".dk", før brugeren bruger en forkert adresse.

export function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
}

// Almindelige fejlstavninger af topdomæner → korrekt værdi
const TLD_TYPOS = {
  // .com
  cim: 'com', con: 'com', vom: 'com', col: 'com', co: 'com', om: 'com',
  comm: 'com', cmo: 'com', ocm: 'com', cpm: 'com', xom: 'com', dom: 'com',
  // .dk
  di: 'dk', dl: 'dk', dj: 'dk', sk: 'dk', dik: 'dk', dkk: 'dk', dak: 'dk',
  ck: 'dk', d: 'dk', kd: 'dk',
  // .net / .org
  ner: 'net', nett: 'net', org: 'org', orh: 'org', ogr: 'org',
};

// Almindelige fejlstavninger af hele domæner (typisk webmail)
const DOMAIN_TYPOS = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmal.com': 'gmail.com',
  'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com', 'gmail.cim': 'gmail.com', 'gmail.dk': 'gmail.com',
  'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmil.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com', 'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'outlook.con': 'outlook.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com',
  'iclod.com': 'icloud.com', 'icloud.con': 'icloud.com',
};

// Returnerer en foreslået rettelse (hele e-mailen) hvis vi spotter en sandsynlig
// tastefejl — ellers null. Selve adressen ændres ikke automatisk; brugeren bekræfter.
export function suggestEmailFix(value) {
  const email = String(value || '').trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at < 1) return null;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!local || !domain) return null;

  // 1) Helt domæne der matcher en kendt fejlstavning
  if (DOMAIN_TYPOS[domain]) {
    return `${local}@${DOMAIN_TYPOS[domain]}`;
  }

  // 2) Fejlstavet topdomæne (sidste led efter sidste punktum)
  const lastDot = domain.lastIndexOf('.');
  if (lastDot > 0) {
    const tld = domain.slice(lastDot + 1);
    if (TLD_TYPOS[tld]) {
      const fixedDomain = domain.slice(0, lastDot) + '.' + TLD_TYPOS[tld];
      return `${local}@${fixedDomain}`;
    }
  }

  return null;
}
