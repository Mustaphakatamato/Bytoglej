import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { email, contactName, institutionName } = await req.json();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

    const firstName = contactName?.split(' ')[0] || 'der';
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://bytogleg.dk';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'byt&leg <noreply@bytogleg.dk>',
        to: [email],
        subject: `Velkommen til byt&leg, ${firstName}! 🎉`,
        html: welcomeHtml({ firstName, institutionName, base }),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: 'E-mail kunne ikke sendes', detail: body }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function welcomeHtml({ firstName, institutionName, base }) {
  const steps = [
    { icon: '📦', title: 'Opret dit første opslag', desc: 'Del det legetøj I ikke længere bruger — AI hjælper dig med beskrivelse og kategori.', href: `${base}/opret-opslag`, cta: 'Opret opslag' },
    { icon: '🔍', title: 'Find noget at bytte', desc: 'Søg i markedspladsen og find legetøj fra institutioner i dit område.', href: `${base}/opslag`, cta: 'Søg legetøj' },
    { icon: '💬', title: 'Tag kontakt', desc: 'Send en besked direkte til institutionen og aftale en handel.', href: `${base}/beskeder`, cta: 'Åbn indbakke' },
  ];

  return `<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F2EA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:580px;margin:48px auto 32px;">

    <!-- Header -->
    <div style="background:linear-gradient(160deg,#133F2B 0%,#2A7D4F 100%);border-radius:20px 20px 0 0;padding:44px 44px 36px;text-align:center;">
      <div style="display:inline-block;background:rgba(255,255,255,0.12);border-radius:14px;padding:10px 22px;color:#fff;font-size:26px;font-weight:900;letter-spacing:-0.04em;margin-bottom:20px;">byt<span style="opacity:0.55">&amp;</span>leg.</div>
      <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0 0 10px;letter-spacing:-0.03em;">Velkommen, ${firstName}! 🎉</h1>
      <p style="color:rgba(255,255,255,0.7);font-size:15px;margin:0;line-height:1.55;">${institutionName ? `${institutionName} er nu` : 'Du er nu'} en del af Danmarks bæredygtige legetøjsmarkedsplads for institutioner.</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:40px 44px;border-left:1px solid rgba(22,34,28,0.08);border-right:1px solid rgba(22,34,28,0.08);">
      <p style="font-size:15px;color:#3A473D;line-height:1.65;margin:0 0 32px;">
        Hej ${firstName},<br><br>
        Din konto er klar — nu skal vi bare i gang. Her er 3 hurtige trin til at komme godt fra start:
      </p>

      ${steps.map((s, i) => `
      <div style="display:flex;gap:16px;margin-bottom:28px;align-items:flex-start;">
        <div style="flex-shrink:0;width:44px;height:44px;background:#e8f5ee;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;text-align:center;line-height:44px;">${s.icon}</div>
        <div style="flex:1;">
          <div style="font-weight:800;font-size:15px;color:#16221C;margin-bottom:4px;">${i + 1}. ${s.title}</div>
          <div style="font-size:14px;color:#6B7570;line-height:1.55;margin-bottom:10px;">${s.desc}</div>
          <a href="${s.href}" style="display:inline-block;background:#2A7D4F;color:#fff;text-decoration:none;font-weight:700;font-size:13px;padding:9px 20px;border-radius:99px;">${s.cta} →</a>
        </div>
      </div>`).join('')}
    </div>

    <!-- Footer -->
    <div style="background:#F6F2EA;border-radius:0 0 20px 20px;border:1px solid rgba(22,34,28,0.08);border-top:none;padding:24px 44px;text-align:center;">
      <p style="font-size:13px;color:#6B7570;margin:0 0 8px;">Spørgsmål? Skriv til os på <a href="mailto:kontakt@bytogleg.dk" style="color:#2A7D4F;text-decoration:none;">kontakt@bytogleg.dk</a></p>
      <p style="font-size:12px;color:#DAD3C4;margin:0;">© 2025 byt&amp;leg · <a href="${base}/privatlivspolitik" style="color:#DAD3C4;text-decoration:none;">Privatlivspolitik</a></p>
    </div>

  </div>
</body>
</html>`;
}
