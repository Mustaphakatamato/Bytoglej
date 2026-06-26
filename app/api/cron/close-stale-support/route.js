import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

// Vercel Cron (dagligt, jf. vercel.json). Backstop der lukker support-samtaler
// som har ligget inaktive i over 15 min, så intet hænger åbent for evigt.
// Den responsive 15-min auto-luk sker klient-side mens boblen er åben; dette er
// sikkerhedsnettet for sessioner hvor brugeren bare lukkede fanen.
// Lukker kun 'bot' (botten skal ikke vente) og 'open' (admin var i gang) —
// 'waiting_human' røres IKKE, så ubesvarede henvendelser ikke forsvinder.
const IDLE_MS = 15 * 60 * 1000;

export async function GET(req) {
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supa = createServerClient();
  const cutoff = new Date(Date.now() - IDLE_MS).toISOString();

  const { data: stale } = await supa
    .from('support_conversations')
    .select('id, status')
    .in('status', ['bot', 'open'])
    .lt('last_message_at', cutoff);

  if (!stale?.length) return NextResponse.json({ closed: 0 });

  const closeText = 'Chatten blev automatisk afsluttet pga. inaktivitet. Skriv her i chatten igen hvis du får brug for mere hjælp, så genåbner vi den.';
  let closed = 0;
  for (const c of stale) {
    // Kun 'open' (en menneske-samtale) får en synlig afslutningsbesked.
    if (c.status === 'open') {
      await supa.from('support_messages').insert({
        conversation_id: c.id, role: 'system', content: closeText, message_type: 'system',
      });
      await supa.from('support_conversations').update({
        status: 'closed', last_message: closeText, last_message_at: new Date().toISOString(),
      }).eq('id', c.id);
    } else {
      await supa.from('support_conversations').update({ status: 'closed' }).eq('id', c.id);
    }
    closed++;
  }

  return NextResponse.json({ closed });
}
