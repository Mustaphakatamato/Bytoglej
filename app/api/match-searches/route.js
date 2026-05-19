import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export async function POST(req) {
  try {
    const { listingId, title, type, tags, city, age_group } = await req.json();

    if (!listingId || !title) {
      return NextResponse.json({ error: 'listingId og title er påkrævet' }, { status: 400 });
    }

    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://bytogleg.dk';
    const listingLink = `${base}/opslag`;

    // Fetch all saved searches
    const { data: savedSearches, error: fetchErr } = await db
      .from('saved_searches')
      .select('id, email, institution_name, name, filters, notify')
      .eq('notify', true);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!savedSearches || savedSearches.length === 0) {
      return NextResponse.json({ notified: 0 });
    }

    // Find matching saved searches
    const matches = savedSearches.filter((search) => {
      const f = search.filters || {};

      if (f.type && f.type !== type) return false;
      if (f.city && f.city !== city) return false;
      if (f.age_group && f.age_group !== age_group) return false;
      if (f.tags && Array.isArray(f.tags) && f.tags.length > 0) {
        const listingTags = Array.isArray(tags) ? tags : [];
        const hasMatch = f.tags.some((tag) => listingTags.includes(tag));
        if (!hasMatch) return false;
      }

      return true;
    });

    if (matches.length === 0) {
      return NextResponse.json({ notified: 0 });
    }

    // Send notification emails concurrently
    const results = await Promise.allSettled(
      matches.map(async (search) => {
        if (!search.email) return;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'byt&leg <noreply@bytogleg.dk>',
            to: [search.email],
            subject: `Nyt opslag matcher din gemte søgning: "${title}"`,
            html: emailHtml({
              title,
              searchName: search.name,
              institutionName: search.institution_name,
              link: listingLink,
            }),
          }),
        });
      }),
    );

    const notified = results.filter((r) => r.status === 'fulfilled').length;

    return NextResponse.json({ notified });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function emailHtml({ title, searchName, institutionName, link }) {
  const greeting = institutionName ? `Hej ${institutionName},` : 'Hej,';
  const searchRef = searchName
    ? `din gemte søgning <strong style="color:#16221C">"${searchName}"</strong>`
    : 'en af dine gemte søgninger';
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
      <h1 style="font-size:24px;font-weight:800;color:#16221C;margin:0 0 16px;letter-spacing:-0.03em;">Nyt opslag matcher din søgning!</h1>
      <p style="font-size:15px;color:#3A473D;line-height:1.65;margin:0 0 12px;">${greeting}</p>
      <p style="font-size:15px;color:#3A473D;line-height:1.65;margin:0 0 28px;">
        Et nyt opslag matcher ${searchRef}:
      </p>
      <div style="background:#F0FAF5;border:1px solid rgba(42,125,79,0.2);border-radius:12px;padding:20px 24px;margin:0 0 28px;">
        <p style="font-size:17px;font-weight:700;color:#16221C;margin:0;">${title}</p>
      </div>
      <p style="font-size:15px;color:#3A473D;line-height:1.65;margin:0 0 28px;">
        Se opslaget og tag kontakt til institutionen, hvis det er noget for jer.
      </p>
      <div style="text-align:center;margin:36px 0;">
        <a href="${link}" style="display:inline-block;background:#2A7D4F;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:17px 40px;border-radius:99px;letter-spacing:-0.01em;">Se opslaget →</a>
      </div>
    </div>
    <div style="background:#F6F2EA;padding:20px 40px;border-top:1px solid rgba(22,34,28,0.06);text-align:center;">
      <p style="font-size:12px;color:#6B7570;margin:0;">byt&amp;leg &middot; <a href="https://bytogleg.dk" style="color:#2A7D4F;text-decoration:none;">bytogleg.dk</a> &middot; <a href="mailto:support@bytogleg.dk" style="color:#2A7D4F;text-decoration:none;">support@bytogleg.dk</a></p>
    </div>
  </div>
</body>
</html>`;
}
