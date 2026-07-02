import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { notify } from '@/lib/notify';

async function requireAdmin(req) {
  const user = await requireAuth(req);
  if (!user) return { error: UNAUTHORIZED() };
  const supa = createServerClient();
  const { data: adminCheck } = await supa.from('admins').select('id').eq('user_id', user.id).maybeSingle();
  if (!adminCheck) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user, supa };
}

// GET — udbetalingskø (afventende først), med institutionsnavn.
export async function GET(req) {
  const { error, supa } = await requireAdmin(req);
  if (error) return error;

  const { data: payouts } = await supa.from('payouts')
    .select('*')
    .order('status', { ascending: true })         // pending før paid/rejected
    .order('requested_at', { ascending: false })
    .limit(200);

  const instIds = [...new Set((payouts || []).map(p => p.institution_id))];
  const { data: insts } = instIds.length
    ? await supa.from('institutions').select('id, name, email').in('id', instIds)
    : { data: [] };
  const nameById = Object.fromEntries((insts || []).map(i => [i.id, i]));

  return NextResponse.json({
    payouts: (payouts || []).map(p => ({ ...p, institution: nameById[p.institution_id] || null })),
  });
}

// POST — markér en udbetaling paid eller rejected.
// rejected tilbagefører beløbet til institutionens saldo (withdrawal_reversal).
export async function POST(req) {
  const { error, supa, user } = await requireAdmin(req);
  if (error) return error;

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 }); }
  const { payoutId, action, note } = body;
  if (!payoutId || !['paid', 'rejected'].includes(action)) {
    return NextResponse.json({ error: 'payoutId og gyldig action kræves' }, { status: 400 });
  }

  const { data: payout } = await supa.from('payouts').select('*').eq('id', payoutId).maybeSingle();
  if (!payout) return NextResponse.json({ error: 'Udbetaling ikke fundet' }, { status: 404 });
  if (payout.status !== 'pending') {
    return NextResponse.json({ error: 'Udbetalingen er allerede behandlet' }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (action === 'rejected') {
    // Tilbagefør beløbet til saldoen.
    const { error: reverr } = await supa.rpc('wallet_credit', {
      _inst: payout.institution_id, _amount: Number(payout.amount), _type: 'withdrawal_reversal',
      _ref_type: 'payout', _ref_id: payout.id, _note: 'Udbetaling afvist — tilbageført til saldo',
    });
    if (reverr) return NextResponse.json({ error: 'Kunne ikke tilbageføre beløbet' }, { status: 500 });
  }

  await supa.from('payouts').update({
    status: action, processed_by: user.id, processed_at: now,
    note: typeof note === 'string' ? note.slice(0, 500) : payout.note,
  }).eq('id', payoutId);

  // Notificér institutionen.
  try {
    await notify(supa, {
      institutionId: payout.institution_id,
      type: action === 'paid' ? 'payout_paid' : 'payout_rejected',
      title: action === 'paid' ? '💸 Din udbetaling er sendt' : 'Din udbetaling blev ikke gennemført',
      body: action === 'paid'
        ? `${Number(payout.amount).toFixed(2).replace('.', ',')} kr. er overført til jeres bankkonto.`
        : `${Number(payout.amount).toFixed(2).replace('.', ',')} kr. er ført tilbage til jeres byt&leg-konto.`,
      data: { payout_id: payout.id },
      url: '/min-konto',
    });
  } catch (e) { console.error('[admin/payouts] notify fejl:', e?.message); }

  return NextResponse.json({ ok: true });
}
