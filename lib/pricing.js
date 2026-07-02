// Fælles prislogik — én sandhedskilde på tværs af klient og server.
// Beløb regnes i KRONER (numeric), jf. resten af skemaet; konvertering
// til øre sker udelukkende ved Stripe-grænsen i API-laget.

// Køberbeskyttelse (Vinted-model): 5% af varebeløbet + 5 kr. fast.
// Bruges i kurv, opslag-detalje, ListingCard og create-intent.
export function calcServiceFee(itemTotal) {
  return Math.round(((itemTotal || 0) * 0.05 + 5) * 100) / 100;
}

// Fast byttebeskyttelse pr. part ved bytte (beslutning 2.7).
export const SWAP_PROTECTION_FEE = 10;

// Et bytteforslag uden tilbudte varer, men med et kontantbeløb, er reelt et KØB:
// anmoderen (initiator) er køber, modparten (owner) er sælger. Sådanne forslag
// konverteres til et købsflow — kun køberen betaler porto + købsbeskyttelse
// (calcServiceFee), sælger betaler intet. Afledt entydigt, da cash_payer tvinges
// til 'initiator' ved oprettelse.
export function isCashPurchaseProposal(p) {
  return !(p?.offered_items?.length) && Number(p?.cash_adjustment) > 0;
}
