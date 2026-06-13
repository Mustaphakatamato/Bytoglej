import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { getPriceQuote } from '@/lib/shipmondo/client';

// Live Shipmondo-pris til kurven, så den viste pris matcher det create-intent opkræver.
// Slår sælger + køber op server-side og kalder /shipments/quote med fulde data.
export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Ugyldig forespørgsel' }, { status: 400 }); }

  const { sellerName, buyerInstitutionId, sizeCategory = 'medium', shippingMethod, servicePointId } = body;

  // Pickup/custom har ingen fragtpris
  if (!shippingMethod || shippingMethod === 'pickup' || shippingMethod === 'custom') {
    return NextResponse.json({ price_dkk: 0, live: false });
  }

  const supa = createServerClient();
  const [{ data: seller }, { data: buyer }] = await Promise.all([
    sellerName
      ? supa.from('institutions').select('name, address, zipcode, city, email').ilike('name', sellerName).maybeSingle()
      : Promise.resolve({ data: null }),
    buyerInstitutionId
      ? supa.from('institutions').select('name, address, zipcode, city, email').eq('id', buyerInstitutionId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const carrier = shippingMethod.replace('parcel_shop_', '').replace('home_', '');
  const serviceType = shippingMethod.startsWith('parcel_shop_') ? 'parcel_shop' : 'home_delivery';

  try {
    const quote = await getPriceQuote({
      carrier,
      service_type: serviceType,
      size_category: sizeCategory,
      sender:   { name: seller?.name, address: seller?.address, zip: seller?.zipcode, city: seller?.city, email: seller?.email },
      receiver: { name: buyer?.name,  address: buyer?.address,  zip: buyer?.zipcode,  city: buyer?.city,  email: buyer?.email },
      service_point_id: servicePointId,
    });
    if (quote?.price_dkk > 0) {
      return NextResponse.json({ price_dkk: Math.round(quote.price_dkk * 100) / 100, live: true });
    }
    return NextResponse.json({ price_dkk: null, live: false });
  } catch (e) {
    return NextResponse.json({ price_dkk: null, live: false, error: e.message });
  }
}
