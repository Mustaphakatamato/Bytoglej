// byt&leg's egen udsteder-stamdata (Model B: byt&leg står som modpart og
// udsteder alle bilag). Sæt de rigtige værdier som miljøvariabler i Vercel —
// fallbacks her er PLACEHOLDERE og skal erstattes før bilag går live.
export const ISSUER = {
  name:    process.env.BYTLEG_NAME    || 'byt&leg ApS',
  cvr:     process.env.BYTLEG_CVR     || '00000000',        // TODO: sæt BYTLEG_CVR i Vercel
  vatNo:   process.env.BYTLEG_VAT_NO  || 'DK00000000',      // TODO: sæt BYTLEG_VAT_NO
  address: process.env.BYTLEG_ADDRESS || '',
  zip:     process.env.BYTLEG_ZIP     || '',
  city:    process.env.BYTLEG_CITY    || '',
  email:   process.env.BYTLEG_EMAIL   || 'support@bytogleg.dk',
};

// Sikkerhedsspærre: der må IKKE genereres bilag med placeholder-stamdata (forkert
// CVR på en rigtig faktura). Bilagsgenerering aktiveres først når det rigtige
// CVR er sat som miljøvariabel i Vercel. Indtil da springes al udstedelse over.
export const ISSUER_CONFIGURED = !!process.env.BYTLEG_CVR;
