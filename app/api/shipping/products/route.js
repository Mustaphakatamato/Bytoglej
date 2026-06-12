import { NextResponse } from 'next/server';

const BASE_URL = 'https://app.shipmondo.com/api/public/v3';
const API_USER = process.env.SHIPMONDO_API_USER;
const API_KEY  = process.env.SHIPMONDO_API_KEY;

export async function GET() {
  const encoded = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');
  const res = await fetch(`${BASE_URL}/products?country_code=DK`, {
    headers: { Authorization: `Basic ${encoded}` },
  });
  const data = await res.json();
  return NextResponse.json(data);
}
