import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(req) {
  // Verify the caller is authenticated
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Find the institution for this user
  const supa = createServerClient();
  let instId = null;
  let uid = user.id;

  const { data: ownInst } = await supa.from('institutions')
    .select('id').ilike('email', user.email).maybeSingle();
  if (ownInst) {
    instId = ownInst.id;
  } else {
    const { data: mem } = await supa.from('institution_members')
      .select('institutions(id)').eq('email', user.email).maybeSingle();
    if (mem?.institutions) instId = mem.institutions.id;
  }

  if (!instId && !uid) return NextResponse.json({ orders: [] });

  // Fetch all paid/shipped/delivered orders and filter by seller
  const { data: orders } = await supa
    .from('orders')
    .select('id, created_at, status, order_groups, buyer_name, buyer_email, paid_at')
    .in('status', ['paid', 'shipped', 'delivered'])
    .order('created_at', { ascending: false })
    .limit(200);

  const myOrders = (orders || [])
    .map(o => ({
      ...o,
      myGroups: (o.order_groups || []).filter(g =>
        (instId && g.sellerInstitutionId === instId) ||
        (uid && g.sellerId === uid)
      ),
    }))
    .filter(o => o.myGroups.length > 0);

  return NextResponse.json({ orders: myOrders });
}
