// Bilags-service (Model B). Opretter byt&leg-bilag idempotent: tildeler et
// fortløbende nummer (next_doc_number RPC), renderer en PDF, lægger den i
// Storage-bucket'en 'documents' og indsætter en documents-række. Alle
// udsteder-kald er BEST-EFFORT — de må aldrig vælte penge-/leverings-flowet,
// så kald dem i try/catch (eller brug wrappers her der sluger fejl).
//
// VIGTIGT: den formelle momsklassificering er endnu ikke revisor-underskrevet.
// Vi bygger efter den anbefalede model: varelinje uden synlig moms (0 %),
// gebyr + fragt som 25 %-linjer (beløb er inkl. moms = det køber faktisk betaler).

import { renderDocumentPdf } from '@/lib/documents-pdf';
import { ISSUER } from '@/lib/issuer';
import { sellerEarnings } from '@/lib/wallet';

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const kr = n => `${round2(n).toFixed(2).replace('.', ',')} kr.`;

// Split et beløb INKL. moms i grundlag + moms for en given sats (fx 0.25).
function splitVat(amountInclVat, rate) {
  const total = round2(amountInclVat);
  const base = round2(total / (1 + rate));
  return { base, vat: round2(total - base) };
}

function instLines(inst) {
  if (!inst) return [];
  return [
    [inst.address, [inst.zipcode, inst.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    inst.cvr ? `CVR ${inst.cvr}` : null,
    inst.ean ? `EAN ${inst.ean}` : null,
  ];
}

// ── Kerne: opret ét bilag idempotent ────────────────────────────────
export async function createDocumentRecord(supa, {
  docType, institutionId, counterpartyId = null,
  referenceType = null, referenceId = null,
  amountDkk = 0, vatDkk = 0, payload,
}) {
  if (!institutionId) return null;
  const refId = referenceId != null ? String(referenceId) : null;

  // Idempotens: samme bilagstype for samme reference til samme modtager kun én gang.
  if (refId) {
    const { data: existing } = await supa.from('documents').select('*')
      .eq('doc_type', docType).eq('institution_id', institutionId)
      .eq('reference_type', referenceType).eq('reference_id', refId)
      .maybeSingle();
    if (existing) return existing;
  }

  const { data: docNumber, error: numErr } = await supa.rpc('next_doc_number', { _type: docType });
  if (numErr || !docNumber) { console.error('[documents] nummer-fejl:', numErr?.message); return null; }

  const fullPayload = { ...payload, docType, docNumber, issuedAt: new Date().toISOString(), issuer: ISSUER };

  let pdfPath = null;
  try {
    const buffer = await renderDocumentPdf(fullPayload);
    pdfPath = `${institutionId}/${docNumber}.pdf`;
    const { error: upErr } = await supa.storage.from('documents')
      .upload(pdfPath, buffer, { contentType: 'application/pdf', upsert: true });
    if (upErr) { console.error('[documents] upload-fejl:', upErr.message); pdfPath = null; }
  } catch (e) {
    console.error('[documents] PDF-render fejl:', e?.message);
  }

  const { data: row, error: insErr } = await supa.from('documents').insert({
    doc_type: docType, doc_number: docNumber, institution_id: institutionId,
    counterparty_id: counterpartyId, reference_type: referenceType, reference_id: refId,
    amount_dkk: round2(amountDkk), vat_dkk: round2(vatDkk), payload: fullPayload, pdf_path: pdfPath,
  }).select().single();
  if (insErr) { console.error('[documents] insert-fejl:', insErr.message); return null; }
  return row;
}

async function getInst(supa, id, cols = 'id, name, address, zipcode, city, cvr, ean, bank_reg_nr, bank_account_nr') {
  if (!id) return null;
  const { data } = await supa.from('institutions').select(cols).eq('id', id).maybeSingle();
  return data;
}

// ── Købsfaktura til køber (pr. ordre) ────────────────────────────────
// Håndterer både normale ordrer (order_groups med items/priser) og kontant-køb
// (order_groups med cashAdjustment som varebetaling og items uden pris).
export async function issueKoebsfakturaForOrder(supa, orderId) {
  const { data: order } = await supa.from('orders')
    .select('id, order_number, grand_total, buyer_institution_id, buyer_name, buyer_address, buyer_zip, buyer_city, order_groups')
    .eq('id', orderId).maybeSingle();
  if (!order || !order.buyer_institution_id) return null;

  const buyerInst = await getInst(supa, order.buyer_institution_id);
  const lines = [];
  let base0 = 0, incl25 = 0;

  for (const g of (order.order_groups || [])) {
    for (const it of (g.items || [])) {
      if (Number(it.price) > 0) { lines.push({ description: it.title || 'Vare', vatLabel: '0 %', amount: round2(it.price) }); base0 += Number(it.price); }
    }
    if (Number(g.bundleDiscount) > 0) { lines.push({ description: 'Bundtrabat', vatLabel: '0 %', amount: -round2(g.bundleDiscount) }); base0 -= Number(g.bundleDiscount); }
    // Kontant-køb: varebetalingen ligger i cashAdjustment (items har pris 0).
    if (Number(g.cashAdjustment) > 0) { lines.push({ description: 'Betaling for varen', vatLabel: '0 %', amount: round2(g.cashAdjustment) }); base0 += Number(g.cashAdjustment); }
    if (Number(g.shippingTotal) > 0) { lines.push({ description: 'Fragt', vatLabel: '25 %', amount: round2(g.shippingTotal) }); incl25 += Number(g.shippingTotal); }
    if (Number(g.serviceFee) > 0) { lines.push({ description: 'Købsbeskyttelse (gebyr)', vatLabel: '25 %', amount: round2(g.serviceFee) }); incl25 += Number(g.serviceFee); }
  }

  const { base: base25, vat: vat25 } = splitVat(incl25, 0.25);
  const total = round2(order.grand_total);

  const payload = {
    title: 'Salgsfaktura',
    parties: [{
      label: 'Til',
      name: buyerInst?.name || order.buyer_name || 'Køber',
      lines: instLines(buyerInst).length ? instLines(buyerInst)
        : [[order.buyer_address, [order.buyer_zip, order.buyer_city].filter(Boolean).join(' ')].filter(Boolean).join(', ')],
    }],
    lines,
    summary: [
      { label: 'Grundlag 0 % (varer)', value: kr(round2(base0)) },
      { label: 'Grundlag 25 % (ydelser)', value: kr(base25) },
      { label: 'Moms 25 %', value: kr(vat25) },
    ],
    total: { label: 'Total inkl. moms', amount: total },
    notes: [
      'Varen sælges efter fortjenstmargenordningen for brugte varer. Køber har ikke fradrag for moms af varen.',
      order.order_number ? `Ordrenummer: ${order.order_number}` : null,
    ],
  };

  return createDocumentRecord(supa, {
    docType: 'koebsfaktura', institutionId: order.buyer_institution_id,
    referenceType: 'order', referenceId: order.id,
    amountDkk: total, vatDkk: vat25, payload,
  });
}

// ── Afregningsbilag til sælger (selvfakturering, pr. salg) ───────────
// Kaldes pr. sælger-gruppe når ordren krediteres ved levering.
export async function issueAfregningForDelivery(supa, orderId) {
  const { data: order } = await supa.from('orders')
    .select('id, order_number, buyer_institution_id, buyer_name, order_groups')
    .eq('id', orderId).maybeSingle();
  if (!order) return;
  const buyerName = order.buyer_name || null;

  for (const g of (order.order_groups || [])) {
    const sellerId = g.sellerInstitutionId;
    const amount = sellerEarnings(g);
    if (!sellerId || amount <= 0) continue;
    const sellerInst = await getInst(supa, sellerId);
    const titles = (g.items || []).map(i => i.title).filter(Boolean).join(', ') || 'vare';
    const payload = {
      title: 'Afregningsbilag — selvfakturering',
      parties: [
        { label: 'Leverandør', name: sellerInst?.name || g.sellerName || 'Sælger', lines: instLines(sellerInst) },
        { label: 'Afregnet af', name: ISSUER.name, lines: [buyerName ? `Salg til ${buyerName}` : null] },
      ],
      lines: [{ description: `Solgt: ${titles}`, vatLabel: 'Ingen moms', amount: round2(amount) }],
      summary: [],
      total: { label: 'Krediteret jeres byt&leg-konto', amount: round2(amount) },
      notes: [
        'Udstedt af byt&leg ApS på leverandørens vegne (selvfakturering, jf. momsloven § 52 a). Leverandøren udsteder ikke selv faktura.',
        'Leverandøren er en ikke-momsregistreret institution; leverancen sker uden moms.',
      ],
    };
    // reference_id = order+seller, så flere sælgere på samme ordre får hvert sit bilag.
    await createDocumentRecord(supa, {
      docType: 'afregningsbilag', institutionId: sellerId,
      counterpartyId: order.buyer_institution_id || null,
      referenceType: 'order', referenceId: `${order.id}:${sellerId}`,
      amountDkk: amount, vatDkk: 0, payload,
    }).catch(e => console.error('[documents] afregning-fejl:', e?.message));
  }
}

// ── Simpelt afregningsbilag (kontant mellemlag / kontant-køb) ────────
export async function issueAfregningSimple(supa, { sellerInstId, counterpartyId, referenceId, amount, description, buyerName }) {
  if (!sellerInstId || !(Number(amount) > 0)) return null;
  const sellerInst = await getInst(supa, sellerInstId);
  const payload = {
    title: 'Afregningsbilag — selvfakturering',
    parties: [
      { label: 'Leverandør', name: sellerInst?.name || 'Sælger', lines: instLines(sellerInst) },
      { label: 'Afregnet af', name: ISSUER.name, lines: [buyerName ? `Salg til ${buyerName}` : null] },
    ],
    lines: [{ description: description || 'Salg via byt&leg', vatLabel: 'Ingen moms', amount: round2(amount) }],
    summary: [],
    total: { label: 'Krediteret jeres byt&leg-konto', amount: round2(amount) },
    notes: [
      'Udstedt af byt&leg ApS på leverandørens vegne (selvfakturering, jf. momsloven § 52 a).',
      'Leverandøren er en ikke-momsregistreret institution; leverancen sker uden moms.',
    ],
  };
  return createDocumentRecord(supa, {
    docType: 'afregningsbilag', institutionId: sellerInstId, counterpartyId: counterpartyId || null,
    referenceType: 'swap', referenceId, amountDkk: amount, vatDkk: 0, payload,
  });
}

// ── Udbetalingsbilag til sælger (pr. udbetaling) ─────────────────────
export async function issueUdbetalingsbilag(supa, payout) {
  if (!payout?.institution_id || !(Number(payout.amount) > 0)) return null;
  const sellerInst = await getInst(supa, payout.institution_id);
  const maskedBank = payout.bank_account_nr ? `konto •••• ${String(payout.bank_account_nr).slice(-4)}` : 'registreret bankkonto';
  const payload = {
    title: 'Udbetalingsbilag',
    parties: [{ label: 'Modtager', name: sellerInst?.name || 'Institution', lines: [...instLines(sellerInst), maskedBank] }],
    lines: [{ description: 'Udbetaling af byt&leg-saldo', vatLabel: '—', amount: round2(payout.amount) }],
    summary: [],
    total: { label: 'Overført til bankkonto', amount: round2(payout.amount) },
    notes: [
      'Udbetaling af tidligere afregnet saldo. Ingen moms (ren betaling).',
      'Dækker de afregningsbilag, der er optjent siden seneste udbetaling.',
    ],
  };
  return createDocumentRecord(supa, {
    docType: 'udbetalingsbilag', institutionId: payout.institution_id,
    referenceType: 'payout', referenceId: payout.id,
    amountDkk: payout.amount, vatDkk: 0, payload,
  });
}
