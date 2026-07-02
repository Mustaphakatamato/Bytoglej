import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { resolveCallerInstitution } from '@/lib/institution-server';

// Kalderens institutions-konto: saldo, posteringshistorik, afventende udbetalinger
// og om bankoplysninger er udfyldt (kræves for at kunne hæve).
export async function GET(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const supa = createServerClient();
  const inst = await resolveCallerInstitution(supa, user);
  if (!inst) return NextResponse.json({ error: 'Ingen institution fundet' }, { status: 404 });

  const [{ data: acct }, { data: ledger }, { data: payouts }, { data: instRow }] = await Promise.all([
    supa.from('wallet_accounts').select('balance').eq('institution_id', inst.id).maybeSingle(),
    supa.from('wallet_ledger').select('id, amount, type, reference_type, reference_id, balance_after, note, created_at')
      .eq('institution_id', inst.id).order('created_at', { ascending: false }).limit(50),
    supa.from('payouts').select('id, amount, status, requested_at, processed_at')
      .eq('institution_id', inst.id).order('requested_at', { ascending: false }).limit(20),
    supa.from('institutions').select('bank_reg_nr, bank_account_nr').eq('id', inst.id).maybeSingle(),
  ]);

  return NextResponse.json({
    institutionId: inst.id,
    balance: Number(acct?.balance || 0),
    ledger: ledger || [],
    payouts: payouts || [],
    hasBankDetails: !!(instRow?.bank_reg_nr && instRow?.bank_account_nr),
  });
}
