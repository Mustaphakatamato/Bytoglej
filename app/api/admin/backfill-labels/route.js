import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { checkIsAdmin } from '@/lib/admin';
import { createServerClient } from '@/lib/supabase-server';
import { getLabelUrlForShipment } from '@/lib/shipmondo/client';

// Engangs-backfill: henter labels for allerede-oprettede forsendelser hvor
// label_pdf_url mangler (ordrer oprettet før label_base64-fixet).
// Kun admins. Besøg /api/admin/backfill-labels mens du er logget ind som admin.
export async function GET(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();
  if (!(await checkIsAdmin(user.id))) {
    return NextResponse.json({ error: 'Kun admins' }, { status: 403 });
  }

  const supa = createServerClient();

  // Find shippede ordrer der har en Shipmondo-forsendelse men mangler label-URL
  const { data: orders, error } = await supa
    .from('orders')
    .select('id, order_groups, label_pdf_url')
    .eq('status', 'shipped')
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];

  for (const order of orders || []) {
    const groups = order.order_groups || [];
    let changed = false;

    for (const g of groups) {
      if (g.shipmondo_shipment_id && !g.label_pdf_url) {
        try {
          const url = await getLabelUrlForShipment(g.shipmondo_shipment_id);
          if (url) {
            g.label_pdf_url = url;
            changed = true;
            results.push({ order: order.id, shipment: g.shipmondo_shipment_id, status: 'ok' });
          } else {
            results.push({ order: order.id, shipment: g.shipmondo_shipment_id, status: 'ingen label_base64' });
          }
        } catch (e) {
          results.push({ order: order.id, shipment: g.shipmondo_shipment_id, status: `fejl: ${e.message}` });
        }
      }
    }

    if (changed) {
      const firstWithLabel = groups.find(g => g.label_pdf_url);
      await supa.from('orders').update({
        order_groups: groups,
        label_pdf_url: order.label_pdf_url || firstWithLabel?.label_pdf_url || null,
      }).eq('id', order.id);
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
