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

  const { sellerName, buyerInstitutionId, sizeCategory = 'medium', servicePointId } = body;
  // methods: liste af leveringsmetoder (fx ['parcel_shop_gls','home_dao']) → pris pr. metode.
  // Bagudkompatibel: hvis kun shippingMethod sendes, behandles den som en enkelt metode.
  const methods = Array.isArray(body.methods) ? body.methods : (body.shippingMethod ? [body.shippingMethod] : []);
  if (!methods.length) return NextResponse.json({ prices: {} });

  const supa = createServerClient();
  const [{ data: seller }, { data: buyer }] = await Promise.all([
    sellerName
      ? supa.from('institutions').select('name, address, zipcode, city, email').ilike('name', sellerName).maybeSingle()
      : Promise.resolve({ data: null }),
    buyerInstitutionId
      ? supa.from('institutions').select('name, address, zipcode, city, email').eq('id', buyerInstitutionId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const sender   = { name: seller?.name, address: seller?.address, zip: seller?.zipcode, city: seller?.city, email: seller?.email };
  const receiver = { name: buyer?.name,  address: buyer?.address,  zip: buyer?.zipcode,  city: buyer?.city,  email: buyer?.email };

  const prices = {};
  await Promise.all(methods.map(async (method) => {
    if (!method || method === 'pickup' || method === 'custom') { prices[method] = 0; return; }
    const carrier = method.replace('parcel_shop_', '').replace('home_', '');
    const serviceType = method.startsWith('parcel_shop_') ? 'parcel_shop' : 'home_delivery';
    try {
      const quote = await getPriceQuote({
        carrier, service_type: serviceType, size_category: sizeCategory,
        sender, receiver,
        service_point_id: method.startsWith('parcel_shop_') ? servicePointId : undefined,
      });
      prices[method] = quote?.price_dkk > 0 ? Math.round(quote.price_dkk * 100) / 100 : null;
    } catch {
      prices[method] = null;
    }
  }));

  return NextResponse.json({ prices });
}
