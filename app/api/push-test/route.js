import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { sendPushToUser } from '@/lib/push';

export async function POST(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();
  try {
    await sendPushToUser(user.id, {
      title: '✅ Push-notifikationer virker!',
      body: 'Du modtager nu beskeder fra byt&leg direkte i browseren.',
      url: '/beskeder',
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
