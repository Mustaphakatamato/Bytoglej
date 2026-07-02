// Wallet-helpers til server-ruter (service role).
// Saldo krediteres/debiteres KUN via de atomiske Postgres-funktioner
// wallet_credit / wallet_debit (låser konto-rækken → ingen overtræk/race).

// Sælgers indtjening pr. gruppe = varebeløb efter bundle-rabat.
// Fragt er forudbetalt (Shipmondo) og gebyr er byt&legs — krediteres ikke.
export function sellerEarnings(group) {
  const v = group?.discountedItemTotal ?? group?.itemTotal ?? 0;
  return Math.round(Number(v) * 100) / 100;
}

// Krediterer hver sælgers konto når en ordre er leveret. Idempotent:
// hævder credited_at atomisk, så kun ét kald (confirm-received ELLER
// shipmondo-webhook) faktisk krediterer. Returnerer true hvis den krediterede.
export async function creditOrderOnDelivery(supa, orderId) {
  // Atomisk claim: kun den første der sætter credited_at fortsætter.
  const { data: claimed } = await supa
    .from('orders')
    .update({ credited_at: new Date().toISOString() })
    .eq('id', orderId)
    .is('credited_at', null)
    .select('id, order_groups')
    .maybeSingle();
  if (!claimed) return false;   // allerede krediteret (eller ordre findes ikke)

  for (const g of (claimed.order_groups || [])) {
    const instId = g.sellerInstitutionId;
    const amount = sellerEarnings(g);
    if (!instId || amount <= 0) continue;
    const { error } = await supa.rpc('wallet_credit', {
      _inst: instId, _amount: amount, _type: 'sale_credit',
      _ref_type: 'order', _ref_id: orderId,
      _note: `Salg: ${(g.items || []).map(i => i.title).join(', ')}`.slice(0, 200),
    });
    if (error) console.error('[wallet] sale_credit fejl:', error.message);
  }
  return true;
}
