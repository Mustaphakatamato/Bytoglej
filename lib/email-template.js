// Delt byt&leg email-template. ALLE udgående mails bør gå gennem brandedEmail()
// for konsistent afsender-stil (grøn gradient-header med logo-badge + footer).
//
// brandedEmail({ heading, bodyHtml, ctaText, ctaUrl, preheader })
//  - heading:   h1-overskrift (valgfri)
//  - bodyHtml:  selve indholdet som HTML (afsenderen escaper selv brugerinput)
//  - ctaText/ctaUrl: valgfri grøn knap nederst
//  - preheader: skjult forhåndstekst i indbakke-oversigten (valgfri)

export function brandedEmail({ heading = '', bodyHtml = '', ctaText = null, ctaUrl = null, preheader = '' } = {}) {
  const cta = ctaText && ctaUrl ? `
      <div style="text-align:center;margin:36px 0 8px;">
        <a href="${ctaUrl}" style="display:inline-block;background:#2A7D4F;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:16px 38px;border-radius:99px;letter-spacing:-0.01em;">${ctaText} &rarr;</a>
      </div>` : '';
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;">${preheader}</div>`
    : '';
  const headingHtml = heading
    ? `<h1 style="font-size:24px;font-weight:800;color:#16221C;margin:0 0 16px;letter-spacing:-0.03em;">${heading}</h1>`
    : '';

  return `<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F2EA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  ${pre}
  <div style="max-width:560px;margin:48px auto 32px;background:#FDFAF4;border-radius:20px;overflow:hidden;border:1px solid rgba(22,34,28,0.08);box-shadow:0 4px 24px rgba(22,34,28,0.07);">
    <div style="background:linear-gradient(160deg,#133F2B 0%,#2A7D4F 100%);padding:38px 40px;text-align:center;">
      <span style="display:inline-block;background:rgba(255,255,255,0.13);border-radius:14px;padding:10px 22px;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.04em;">byt<span style="opacity:0.6">&amp;</span>leg.</span>
    </div>
    <div style="padding:40px;">
      ${headingHtml}
      <div style="font-size:15px;color:#3A473D;line-height:1.65;">${bodyHtml}</div>
      ${cta}
    </div>
    <div style="background:#F6F2EA;padding:20px 40px;border-top:1px solid rgba(22,34,28,0.06);text-align:center;">
      <p style="font-size:12px;color:#6B7570;margin:0;">byt&amp;leg &middot; <a href="https://bytogleg.dk" style="color:#2A7D4F;text-decoration:none;">bytogleg.dk</a> &middot; <a href="mailto:support@bytogleg.dk" style="color:#2A7D4F;text-decoration:none;">support@bytogleg.dk</a></p>
    </div>
  </div>
</body>
</html>`;
}
