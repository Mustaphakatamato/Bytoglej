// byt&leg's egen udsteder-stamdata (Model B: byt&leg står som modpart og
// udsteder alle bilag). Værdier kan overstyres med miljøvariabler i Vercel;
// defaults her er de registrerede stamdata fra CVR-registeret (CVR 35058486).
export const ISSUER = {
  name:    process.env.BYTLEG_NAME    || 'byt&leg ApS',
  cvr:     process.env.BYTLEG_CVR     || '35058486',
  vatNo:   process.env.BYTLEG_VAT_NO  || 'DK35058486',
  address: process.env.BYTLEG_ADDRESS || 'Nældebjerg Alle 62',
  zip:     process.env.BYTLEG_ZIP     || '2670',
  city:    process.env.BYTLEG_CITY    || 'Greve',
  email:   process.env.BYTLEG_EMAIL   || 'support@bytogleg.dk',
};

// Sikkerhedsspærre: bilag genereres kun når et rigtigt CVR er sat (ikke
// placeholderen '00000000'). Nu udfyldt med byt&legs registrerede CVR → aktiv.
export const ISSUER_CONFIGURED = !!(ISSUER.cvr && ISSUER.cvr !== '00000000');
