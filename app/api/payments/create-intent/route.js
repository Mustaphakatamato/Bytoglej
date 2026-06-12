import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY er ikke sat');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Service fee: 5% of item total, min 5 kr, max 50 kr
function calcServiceFee(itemTotal) {
  return Math.round(Math.max(5, Math.min(50, itemTotal * 0.05)) * 100) / 100;
}

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const body = await req.json();
  const { groups } = body;
  // groups: [{ sellerName, sellerId, sellerInstitutionId, items, shippingMethod, shippingPrice, pickupPoint, note }]

  if (!groups?.length) {
    return NextResponse.json({ error: 'Ingen varer valgt' }, { status: 400 });
  }

  const supa = createServerClient();

  // Fetch buyer institution
  const { data: buyer } = await supa
    .from('institutions')
    .select('id, name, address, zipcode, city, email, bank_reg_nr, bank_account_nr')
    .eq('id', body.buyerInstitutionId)
    .maybeSingle();

  // Build order rows + compute grand total
  const orderGroups = [];
  let grandTotal = 0;

  for (const g of groups) {
    const itemTotal = g.items.reduce((s, i) => s + (i.price || 0), 0);
    const shippingTotal = g.shippingPrice || 0;
    const serviceFee = calcServiceFee(itemTotal);
    const groupTotal = itemTotal + shippingTotal + serviceFee;
    grandTotal += groupTotal;

    // Fetch seller bank details
    const { data: seller } = await supa
      .from('institutions')
      .select('id, name, email, bank_reg_nr, bank_account_nr')
      .ilike('name', g.sellerName)
      .maybeSingle();

    orderGroups.push({
      sellerName: g.sellerName,
      sellerInstitutionId: seller?.id || g.sellerInstitutionId,
      sellerEmail: seller?.email,
      sellerBankRegNr: seller?.bank_reg_nr,
      sellerBankAccountNr: seller?.bank_account_nr,
      items: g.items,
      itemTotal,
      shippingTotal,
      serviceFee,
      groupTotal,
      shippingMethod: g.shippingMethod,
      pickupPoint: g.pickupPoint,
      note: g.note,
    });
  }

  // Create Stripe PaymentIntent (amount in øre)
  const amountOre = Math.round(grandTotal * 100);
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountOre,
    currency: 'dkk',
    automatic_payment_methods: { enabled: true },
    metadata: {
      buyer_id: user.id,
      buyer_institution_id: buyer?.id || '',
      buyer_name: buyer?.name || '',
      group_count: String(groups.length),
    },
    description: `Bytogleg ordre — ${groups.map(g => g.sellerName).join(', ')}`,
  });

  // Insert order record
  const { data: order, error } = await supa
    .from('orders')
    .insert({
      payment_intent_id: paymentIntent.id,
      buyer_id: user.id,
      buyer_institution_id: buyer?.id || null,
      grand_total: grandTotal,
      status: 'pending',
      order_groups: orderGroups,
      buyer_address: buyer ? [buyer.address, buyer.zipcode, buyer.city].filter(Boolean).join(', ') : null,
    })
    .select()
    .single();

  if (error) {
    console.error('[create-intent] DB fejl:', error);
    return NextResponse.json({ error: 'Kunne ikke oprette ordre' }, { status: 500 });
  }

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    orderId: order.id,
    grandTotal,
    breakdown: orderGroups,
  });
}
