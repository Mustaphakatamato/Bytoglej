import { NextResponse } from 'next/server';

const BASE_URL = 'https://app.shipmondo.com/api/public/v3';
const API_USER = process.env.SHIPMONDO_API_USER;
const API_KEY  = process.env.SHIPMONDO_API_KEY;

async function testQuote(carrier_code, product_code) {
  const encoded = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');
  const res = await fetch(`${BASE_URL}/shipments/quote`, {
    method: 'POST',
    headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      own_agreement: false,
      carrier_code,
      product_code,
      sender:   { zip_code: '8000', country_code: 'DK' },
      receiver: { zip_code: '2100', country_code: 'DK' },
      parcels:  [{ quantity: 1, weight: 5000, length: 50, width: 35, height: 25 }],
    }),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

export async function GET() {
  const [pdk, gls, dao] = await Promise.all([
    testQuote('pdk', 'PDK_MC'),
    testQuote('gls', 'GLSDK_SD'),
    testQuote('dao', 'DAO_STH'),
  ]);
  return NextResponse.json({ pdk, gls, dao });
}
