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
