'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PRIMARY, GREEN_DEEP, GREEN_SOFT,
  PAPER, PAPER2, PAPER3,
  INK, INK2, INK3,
} from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { Spinner } from '@/components/ui';
import { db } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { LogoLockup } from '@/components/Logo';

const FONT = "'Sora', sans-serif";

function EyeIcon({ open }) {
  if (open) {
    return (
      <svg width={18} height={18} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
        <circle cx="10" cy="10" r="2.5" />
        <line x1="3" y1="3" x2="17" y2="17" />
      </svg>
    );
  }
  return (
    <svg width={18} height={18} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  );
}

const TRUST_POINTS = [
  'CVR-verificerede institutioner',
  'Sikker handel via platformen',
  'Køb, byd eller byt frit',
];

export default function LoginPage() {
  const router = useRouter();
  const { setLoggedIn } = useApp();
  const w = useWindowWidth();
  const isDesktop = w >= 768;

  const [email, setEmail]     = useState('');
  const [pass, setPass]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault(); setLoading(true); setError(null);
    const { error } = await db.auth.signInWithPassword({ email, password: pass });
    setLoading(false);
    if (error) { setError('Forkert e-mail eller kodeord'); return; }
    setLoggedIn(true); router.push('/dashboard');
  }

  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 12,
    border: `1.5px solid ${PAPER3}`,
    background: PAPER2,
    fontSize: 14,
    fontFamily: FONT,
    color: INK,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    fontFamily: FONT,
    fontWeight: 700,
    fontSize: 13,
    color: INK2,
    marginBottom: 6,
  };

  const formContent = (
    <div style={{ width: '100%', maxWidth: 380, ...(isDesktop ? { padding: '48px 40px' } : {}) }}>
      {/* Heading */}
      <h1 style={{
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: 28,
        color: INK,
        letterSpacing: '-0.03em',
        marginBottom: 6,
        marginTop: 0,
      }}>
        Velkommen tilbage
      </h1>
      <p style={{
        fontFamily: FONT,
        fontSize: 14,
        color: INK3,
        marginBottom: 32,
        marginTop: 0,
      }}>
        Log ind med jeres institutions-konto
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Email field */}
        <div>
          <label style={labelStyle}>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="navn@institution.dk"
            style={inputStyle}
          />
        </div>

        {/* Password field with show/hide toggle */}
        <div>
          <label style={labelStyle}>Adgangskode</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="••••••••"
              style={{ ...inputStyle, paddingRight: 42 }}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: INK3,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label={showPass ? 'Skjul adgangskode' : 'Vis adgangskode'}
            >
              <EyeIcon open={showPass} />
            </button>
          </div>

          {/* Forgot password */}
          <div style={{ textAlign: 'right', marginTop: 6 }}>
            <span
              onClick={() => router.push('/glemt-adgangskode')}
              style={{
                fontFamily: FONT,
                fontWeight: 600,
                fontSize: 12,
                color: PRIMARY,
                cursor: 'pointer',
              }}
            >
              Glemt adgangskode?
            </span>
          </div>
        </div>

        {/* Error box */}
        {error && (
          <div style={{
            background: '#FEF2F2',
            borderLeft: '3px solid #EF4444',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 13,
            color: '#B91C1C',
            fontFamily: FONT,
          }}>
            {error}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: 999,
            background: PRIMARY,
            color: '#fff',
            border: 'none',
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 15,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'opacity 0.2s',
          }}
        >
          {loading ? <><Spinner />Logger ind…</> : 'Log ind →'}
        </button>
      </form>

      {/* Sign up link */}
      <div style={{ marginTop: 20, fontFamily: FONT, fontSize: 13, color: INK3 }}>
        <span>Har I ikke en konto? </span>
        <span
          onClick={() => router.push('/signup')}
          style={{ color: PRIMARY, fontWeight: 700, cursor: 'pointer' }}
        >
          Tilmeld institution
        </span>
      </div>
    </div>
  );

  /* ── DESKTOP: split screen ── */
  if (isDesktop) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
      }}>
        {/* LEFT — brand panel */}
        <div style={{
          background: GREEN_DEEP,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          padding: '60px 52px',
        }}>
          {/* Watermark */}
          <span style={{
            position: 'absolute',
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 'clamp(120px, 18vw, 220px)',
            color: 'rgba(255,255,255,0.04)',
            letterSpacing: '-0.05em',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            byt
          </span>

          {/* Logo */}
          <LogoLockup
            markBg="rgba(255,255,255,0.15)"
            color="#fff"
            accentColor={GREEN_SOFT}
            markSize={44}
            textSize={22}
          />

          {/* Tagline */}
          <p style={{
            fontFamily: FONT,
            fontSize: 14,
            color: 'rgba(255,255,255,0.55)',
            marginTop: 12,
            marginBottom: 0,
            textAlign: 'center',
            maxWidth: 280,
          }}>
            Danmarks markedsplads for institutionslegetøj
          </p>

          {/* Trust points */}
          <div style={{ marginTop: 48 }}>
            {TRUST_POINTS.map(pt => (
              <div key={pt} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
                fontSize: 13,
                fontFamily: FONT,
                color: 'rgba(255,255,255,0.65)',
              }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: GREEN_SOFT,
                  flexShrink: 0,
                }} />
                {pt}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — form panel */}
        <div style={{
          background: PAPER,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {formContent}
        </div>
      </div>
    );
  }

  /* ── MOBILE: single column ── */
  return (
    <div style={{
      minHeight: '100vh',
      background: PAPER,
      padding: '80px 24px 48px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Logo centered at top */}
      <div
        onClick={() => router.push('/')}
        style={{ cursor: 'pointer', marginBottom: 36 }}
      >
        <LogoLockup
          markBg={GREEN_DEEP}
          color={INK}
          accentColor={PRIMARY}
          markSize={40}
          textSize={20}
        />
      </div>

      <div style={{ width: '100%', maxWidth: 380 }}>
        {formContent}
      </div>
    </div>
  );
}
