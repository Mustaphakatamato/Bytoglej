'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, PAPER, INK, INK3, FONT } from '@/lib/constants';

export default function AfventerGodkendelse() {
  const router = useRouter();

  async function handleLogout() {
    await db.auth.signOut();
    router.push('/');
  }

  return (
    <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 72, marginBottom: 24 }}>⏳</div>
        <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 28, color: INK, letterSpacing: '-0.03em', marginBottom: 12 }}>
          Din ansøgning behandles
        </h1>
        <p style={{ fontSize: 15, color: INK3, lineHeight: 1.7, marginBottom: 32 }}>
          Tak for din tilmelding! Vi gennemgår din ansøgning og aktiverer din konto hurtigst muligt, typisk inden for 1 arbejdsdag.<br /><br />
          Du modtager en e-mail når din institution er godkendt.
        </p>
        <div style={{ background: GREEN_TINT, borderRadius: 16, padding: '20px 24px', marginBottom: 32, textAlign: 'left' }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: PRIMARY, marginBottom: 8 }}>Hvad sker der nu?</div>
          <div style={{ fontSize: 13, color: '#2D6A4F', lineHeight: 1.7 }}>
            1. Vi bekræfter dine oplysninger<br />
            2. Du modtager en godkendelses-e-mail<br />
            3. Log ind og kom i gang med at bytte legetøj
          </div>
        </div>
        <p style={{ fontSize: 13, color: INK3, marginBottom: 20 }}>
          Spørgsmål? Skriv til{' '}
          <a href="mailto:support@bytogleg.dk" style={{ color: PRIMARY, textDecoration: 'none', fontWeight: 600 }}>support@bytogleg.dk</a>
        </p>
        <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: INK3, fontFamily: FONT, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
          Log ud
        </button>
      </div>
    </div>
  );
}
