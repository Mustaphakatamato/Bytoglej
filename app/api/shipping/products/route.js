import { NextResponse } from 'next/server';

const BASE_URL = 'https://app.shipmondo.com/api/public/v3';
const API_USER = process.env.SHIPMONDO_API_USER;
const API_KEY  = process.env.SHIPMONDO_API_KEY;

export async function GET() {
  const encoded = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');
  const headers = { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' };

  // Test quote for PDK_MC (PostNord pakkeshop), medium pakke
  const quoteRes = await fetch(`${BASE_URL}/shipments/quote`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      own_agreement: false,
      carrier_code: 'pdk',
      product_code: 'PDK_MC',
      sender:   { zip_code: '8000', country_code: 'DK' },
      receiver: { zip_code: '2100', country_code: 'DK' },
      parcels:  [{ quantity: 1, weight: 5000, length: 50, width: 35, height: 25 }],
    }),
  });

  const quoteStatus = quoteRes.status;
  const quoteData = await quoteRes.json().catch(() => 'ikke JSON');

  return NextResponse.json({ quoteStatus, quoteData });
}
