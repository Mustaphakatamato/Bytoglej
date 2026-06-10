'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { PRIMARY, PAPER, INK, INK3, FONT } from '@/lib/constants';

export default function GlobalError({ error, reset }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 60, marginBottom: 16 }}>⚙️</div>
      <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 28, color: INK, letterSpacing: '-0.04em', marginBottom: 12 }}>Noget gik galt</h1>
      <p style={{ fontSize: 15, color: INK3, maxWidth: 360, lineHeight: 1.6, marginBottom: 32 }}>
        Vi beklager — der opstod en uventet fejl. Prøv igen, eller gå tilbage til forsiden.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={reset} style={{ background: PRIMARY, color: '#fff', borderRadius: 99, padding: '12px 28px', fontFamily: FONT, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
          Prøv igen
        </button>
        <Link href="/" style={{ background: 'transparent', color: PRIMARY, border: `1.5px solid ${PRIMARY}`, borderRadius: 99, padding: '12px 28px', fontFamily: FONT, fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'inline-block' }}>
          Gå til forsiden
        </Link>
      </div>
    </div>
  );
}
