import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { resolveCallerInstitution } from '@/lib/institution-server';
import { notify } from '@/lib/notify';

// Institutionen anmoder om udbetaling af (en del af) sin saldo.
// Trækker atomisk på saldoen (wallet_debit fejler ved utilstrækkelig dækning)
// og opretter en payouts-post, som admin manuelt frigiver efter bankoverførsel.
export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 }); }

  const supa = createServerClient();
  const inst = await resolveCallerInstitution(supa, user);
  if (!inst) return NextResponse.json({ error: 'Ingen institution fundet' }, { status: 404 });

  const { data: instRow } = await supa.from('institutions')
    .select('bank_reg_nr, bank_account_nr, name, email').eq('id', inst.id).maybeSingle();
  if (!instRow?.bank_reg_nr || !instRow?.bank_account_nr) {
    return NextResponse.json({ error: 'Tilføj bankoplysninger under Indstillinger, før du kan hæve.', code: 'no_bank' }, { status: 400 });
  }

  const { data: acct } = await supa.from('wallet_accounts').select('balance').eq('institution_id', inst.id).maybeSingle();
  const balance = Number(acct?.balance || 0);

  // Beløb: eksplicit angivet, ellers hele saldoen. Afrund til 2 decimaler.
  let amount = body.amount != null ? Number(body.amount) : balance;
  amount = Math.round(amount * 100) / 100;
  if (!(amount > 0)) return NextResponse.json({ error: 'Ugyldigt beløb' }, { status: 400 });
  if (amount > balance) return NextResponse.json({ error: 'Beløbet overstiger din saldo' }, { status: 400 });

  // Atomisk træk — fejler hvis saldoen i mellemtiden er brugt et andet sted.
  const { data: ledgerRow, error: debitErr } = await supa.rpc('wallet_debit', {
    _inst: inst.id, _amount: amount, _type: 'withdrawal_debit',
    _ref_type: 'payout', _ref_id: null, _note: 'Udbetalingsanmodning',
  });
  if (debitErr) {
    const insufficient = /insufficient/i.test(debitErr.message || '');
    return NextResponse.json({ error: insufficient ? 'Beløbet overstiger din saldo' : 'Kunne ikke reservere beløbet' }, { status: 400 });
  }

  const { data: payout, error: payoutErr } = await supa.from('payouts').insert({
    institution_id: inst.id,
    amount,
    status: 'pending',
    bank_reg_nr: instRow.bank_reg_nr,
    bank_account_nr: instRow.bank_account_nr,
    ledger_id: ledgerRow?.id || null,
    requested_by: user.id,
  }).select().single();

  if (payoutErr) {
    // Rul trækket tilbage, så saldoen ikke forsvinder uden en udbetaling.
    await supa.rpc('wallet_credit', {
      _inst: inst.id, _amount: amount, _type: 'withdrawal_reversal',
      _ref_type: 'payout', _ref_id: null, _note: 'Udbetaling kunne ikke oprettes — tilbageført',
    });
    return NextResponse.json({ error: 'Kunne ikke oprette udbetaling. Prøv igen.' }, { status: 500 });
  }

  // Knyt ledger-posten til payout'en (til senere afstemning).
  if (ledgerRow?.id) {
    await supa.from('wallet_ledger').update({ reference_id: payout.id }).eq('id', ledgerRow.id);
  }

  // Notificér admin om ny udbetalingsanmodning.
  try {
    await notify(supa, {
      institutionName: 'byt&leg admin',
      email: process.env.ADMIN_NOTIFY_EMAIL || 'kontakt@bytogleg.dk',
      sendBell: false, sendPush: false,
      type: 'payout_requested',
      title: 'Ny udbetalingsanmodning',
      body: `${instRow.name || 'En institution'} har anmodet om udbetaling af ${amount.toFixed(2).replace('.', ',')} kr.`,
      url: '/admin',
    });
  } catch (e) { console.error('[wallet/withdraw] admin-notify fejl:', e?.message); }

  return NextResponse.json({ ok: true, payoutId: payout.id, amount, newBalance: Math.round((balance - amount) * 100) / 100 });
}
