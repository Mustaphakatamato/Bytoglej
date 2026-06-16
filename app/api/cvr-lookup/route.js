import { NextResponse } from 'next/server';

const UA = 'bytogleg.dk support@bytogleg.dk';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const produ  = searchParams.get('produ')  || '';

  if (!search && !produ) {
    return NextResponse.json({ error: 'Mangler søgeparameter' }, { status: 400 });
  }

  const upstream = produ
    ? `https://cvrapi.dk/api?produ=${encodeURIComponent(produ)}&country=dk`
    : `https://cvrapi.dk/api?search=${encodeURIComponent(search)}&country=dk`;

  try {
    const res = await fetch(upstream, {
      headers: { 'User-Agent': UA },
      next: { revalidate: 60 },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
