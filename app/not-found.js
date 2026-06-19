'use client';
import Link from 'next/link';
import { PRIMARY, GREEN_DEEP, PAPER, INK, INK3, FONT } from '@/lib/constants';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 120, color: `${PRIMARY}22`, lineHeight: 1, letterSpacing: '-0.06em', marginBottom: 8, userSelect: 'none' }}>404</div>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🧸</div>
      <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 28, color: INK, letterSpacing: '-0.04em', marginBottom: 12 }}>Siden blev ikke fundet</h1>
      <p style={{ fontSize: 15, color: INK3, maxWidth: 360, lineHeight: 1.6, marginBottom: 32 }}>
        Det opslag eller den side du leder efter eksisterer ikke. Det kan være slettet eller flyttet.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/opslag" style={{ background: PRIMARY, color: '#fff', borderRadius: 99, padding: '12px 28px', fontFamily: FONT, fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-block' }}>
          Se alle opslag
        </Link>
        <Link href="/" style={{ background: 'transparent', color: PRIMARY, border: `1.5px solid ${PRIMARY}`, borderRadius: 99, padding: '12px 28px', fontFamily: FONT, fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-block' }}>
          Gå til forsiden
        </Link>
      </div>
    </div>
  );
}
