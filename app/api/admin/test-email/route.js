import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { sellerOrderEmailHtml, buyerOrderEmailHtml } from '@/app/api/webhooks/stripe/route';

// Engangs-test: sender afhentnings-versionen af sælger- + køber-mailen til en adresse.
// Admin-only. Brug: /api/admin/test-email?to=din@mail.dk
export async function GET(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const supa = createServerClient();
  const { data: adminRow } = await supa.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!adminRow) return NextResponse.json({ error: 'Kun admins' }, { status: 403 });

  const to = new URL(req.url).searchParams.get('to');
  if (!to) return NextResponse.json({ error: 'Angiv ?to=email' }, { status: 400 });

  const items = [{ emoji: '🧸', title: 'Testbamse (afhentning)', price: 100 }];
  const sellerHtml = sellerOrderEmailHtml({
    sellerName: 'Test Institution', items, itemTotal: 100,
    shippingMethod: 'pickup', pickupPoint: null, labelUrl: null, trackingNumber: null, orderId: 'TEST-AFHENTNING',
  });
  const buyerHtml = buyerOrderEmailHtml({
    buyerName: 'Test Køber',
    groups: [{ sellerName: 'Test Institution', items, itemTotal: 100, shippingTotal: 0, serviceFee: 5, shippingMethod: 'pickup', pickupPoint: null }],
    orderId: 'TEST-AFHENTNING', grandTotal: 105,
  });

  const send = (subject, html) => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'byt&leg <noreply@bytogleg.dk>', to: [to], subject, html }),
  }).then(async r => ({ ok: r.ok, status: r.status, body: await r.text() }));

  const [seller, buyer] = await Promise.all([
    send('[TEST] Sælger-mail — afhentning', sellerHtml),
    send('[TEST] Køber-mail — afhentning', buyerHtml),
  ]);

  return NextResponse.json({ to, seller, buyer });
}
