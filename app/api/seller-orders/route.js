import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const supa = createServerClient();

  const { data: ownInst } = await supa.from('institutions')
    .select('id').ilike('email', user.email).maybeSingle();
  let instId = ownInst?.id ?? null;

  if (!instId) {
    const { data: mem } = await supa.from('institution_members')
      .select('institutions(id)').eq('email', user.email).maybeSingle();
    if (mem?.institutions) instId = mem.institutions.id;
  }

  const { data: orders } = await supa
    .from('orders')
    .select('id, order_number, created_at, status, order_groups, buyer_name, buyer_email, paid_at')
    .in('status', ['paid', 'shipped', 'delivered'])
    .order('created_at', { ascending: false })
    .limit(200);

  const myOrders = (orders || [])
    .map(o => ({
      ...o,
      myGroups: (o.order_groups || []).filter(g =>
        (instId && g.sellerInstitutionId === instId) ||
        g.sellerId === user.id
      ),
    }))
    .filter(o => o.myGroups.length > 0);

  return NextResponse.json({ orders: myOrders });
}
