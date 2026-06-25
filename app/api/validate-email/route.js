import { NextResponse } from 'next/server';
import dns from 'dns/promises';

// DNS-opslag kræver Node-runtime (ikke edge).
export const runtime = 'nodejs';

// Returnerer true hvis domænet har en mailserver (MX) eller mindst en A/AAAA-record
// (RFC: uden MX bruges A-recorden som implicit mailserver). Ved tvetydige DNS-fejl
// (timeout o.l.) returnerer vi true, så vi ikke afviser gyldige mails ved nedetid.
async function domainHasMail(domain) {
  const notFound = (e) => ['ENOTFOUND', 'ENODATA'].includes(e?.code);
  try {
    const mx = await dns.resolveMx(domain);
    if (mx && mx.length > 0) return true;
  } catch (e) { if (!notFound(e)) return true; }
  try {
    const a = await dns.resolve4(domain);
    if (a && a.length > 0) return true;
  } catch (e) { if (!notFound(e)) return true; }
  try {
    const aaaa = await dns.resolve6(domain);
    if (aaaa && aaaa.length > 0) return true;
  } catch (e) { if (!notFound(e)) return true; }
  return false;
}

export async function POST(req) {
  try {
    const { email } = await req.json();
    const raw = String(email || '').trim().toLowerCase();
    const at = raw.lastIndexOf('@');
    if (at < 1) return NextResponse.json({ deliverable: false });
    const domain = raw.slice(at + 1);
    if (!domain || domain.indexOf('.') < 1) return NextResponse.json({ deliverable: false });

    const ok = await domainHasMail(domain);
    return NextResponse.json({ deliverable: ok });
  } catch {
    // Uventet fejl: vær konservativ og bloker ikke.
    return NextResponse.json({ deliverable: true });
  }
}
