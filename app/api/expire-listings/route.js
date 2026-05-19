import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient(url, serviceKey);
  }
  // Fall back to anon client (limited by RLS)
  const { db } = require('@/lib/supabase');
  return db;
}

export async function GET(req) {
  // Security: require cron secret
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://bytogleg.dk';

  // Find listings active for more than 60 days
  const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data: listings, error: fetchErr } = await supabase
    .from('listings')
    .select('id, title, institution_name')
    .eq('is_active', true)
    .eq('is_sold', false)
    .lt('created_at', cutoff);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!listings || listings.length === 0) {
    return NextResponse.json({ expired: 0 });
  }

  const ids = listings.map((l) => l.id);

  // Deactivate all expired listings in one query
  const { error: updateErr } = await supabase
    .from('listings')
    .update({ is_active: false })
    .in('id', ids);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Send expiry emails — collect unique institution names to avoid duplicate lookups
  const institutionNames = [...new Set(listings.map((l) => l.institution_name).filter(Boolean))];

  // Fetch institution emails in one query
  const { data: institutions } = institutionNames.length
    ? await supabase
        .from('institutions')
        .select('name, email')
        .in('name', institutionNames)
    : { data: [] };

  const emailMap = {};
  (institutions || []).forEach((inst) => {
    emailMap[inst.name] = inst.email;
  });

  // Send emails concurrently
  await Promise.allSettled(
    listings.map(async (listing) => {
      const toEmail = emailMap[listing.institution_name];
      if (!toEmail) return;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'byt&leg <noreply@bytogleg.dk>',
          to: [toEmail],
          subject: `Dit opslag "${listing.title}" er udløbet`,
          html: emailHtml({ title: listing.title, base }),
        }),
      });
    }),
  );

  return NextResponse.json({ expired: listings.length });
}

function emailHtml({ title, base }) {
  const dashboardLink = `${base}/dashboard`;
  return `<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F2EA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:48px auto 32px;background:#FDFAF4;border-radius:20px;overflow:hidden;border:1px solid rgba(22,34,28,0.08);box-shadow:0 4px 24px rgba(22,34,28,0.07);">
    <div style="background:linear-gradient(160deg,#1B4332 0%,#2A7D4F 100%);padding:40px;text-align:center;">
      <span style="display:inline-block;background:rgba(255,255,255,0.13);border-radius:14px;padding:10px 22px;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.04em;">byt<span style="opacity:0.6">&amp;</span>leg.</span>
      <p style="color:rgba(255,255,255,0.65);margin:16px 0 0;font-size:14px;letter-spacing:0.02em;">Danmarks legetøjsbyttemarkeds for institutioner</p>
    </div>
    <div style="padding:40px;">
      <h1 style="font-size:24px;font-weight:800;color:#16221C;margin:0 0 16px;letter-spacing:-0.03em;">Dit opslag er udløbet</h1>
      <p style="font-size:15px;color:#3A473D;line-height:1.65;margin:0 0 12px;">
        Dit opslag <strong style="color:#16221C">"${title}"</strong> har været aktivt i 60 dage og er nu automatisk deaktiveret.
      </p>
      <p style="font-size:15px;color:#3A473D;line-height:1.65;margin:0 0 28px;">
        Du kan nemt genaktivere opslaget fra dit dashboard, hvis du stadig ønsker at dele det.
      </p>
      <div style="text-align:center;margin:36px 0;">
        <a href="${dashboardLink}" style="display:inline-block;background:#2A7D4F;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:17px 40px;border-radius:99px;letter-spacing:-0.01em;">Gå til dashboard →</a>
      </div>
      <div style="background:#F0FAF5;border-left:3px solid #52B788;border-radius:0 10px 10px 0;padding:14px 18px;margin-top:8px;">
        <p style="font-size:13px;color:#2A7D4F;margin:0;font-weight:600;">Hvorfor udløber opslag?</p>
        <p style="font-size:13px;color:#6B7570;margin:6px 0 0;">For at sikre at alle opslag er aktuelle, deaktiveres opslag automatisk efter 60 dage.</p>
      </div>
    </div>
    <div style="background:#F6F2EA;padding:20px 40px;border-top:1px solid rgba(22,34,28,0.06);text-align:center;">
      <p style="font-size:12px;color:#6B7570;margin:0;">byt&amp;leg &middot; <a href="https://bytogleg.dk" style="color:#2A7D4F;text-decoration:none;">bytogleg.dk</a> &middot; <a href="mailto:support@bytogleg.dk" style="color:#2A7D4F;text-decoration:none;">support@bytogleg.dk</a></p>
    </div>
  </div>
</body>
</html>`;
}
