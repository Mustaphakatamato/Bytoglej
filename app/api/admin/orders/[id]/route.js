import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';

const VALID_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'refunded'];

// PATCH — update order status (admin only). Logs to admin_audit_log.
export async function PATCH(req, { params }) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const adminDb = createServerClient();
  const { data: adminCheck } = await adminDb.from('admins').select('id').eq('user_id', user.id).maybeSingle();
  if (!adminCheck) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const orderId = params.id;
    const { status } = await req.json();
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Ugyldig status' }, { status: 400 });
    }

    const { data: existing } = await adminDb
      .from('orders')
      .select('id,status,buyer_name')
      .eq('id', orderId)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Ordre ikke fundet' }, { status: 404 });

    const update = { status };
    if (status === 'paid') update.paid_at = new Date().toISOString();
    if (status === 'shipped') update.shipped_at = new Date().toISOString();

    const { data, error } = await adminDb
      .from('orders')
      .update(update)
      .eq('id', orderId)
      .select('*')
      .maybeSingle();
    if (error) throw error;

    await adminDb.from('admin_audit_log').insert({
      admin_id: user.id,
      admin_email: user.email,
      action: 'update_order_status',
      target_type: 'order',
      target_id: orderId,
      target_name: existing.buyer_name || orderId,
      details: { from: existing.status, to: status },
    });

    return NextResponse.json({ order: data });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
