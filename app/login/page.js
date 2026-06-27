'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { Spinner } from '@/components/ui';
import { db } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { LogoLockup } from '@/components/Logo';
import { isValidEmail, suggestEmailFix, hasValidTld, checkEmailDeliverable } from '@/lib/email-validation';

const TRUST_POINTS = [
  'CVR-verificerede institutioner',
  'Sikker handel via platformen',
  'Køb, byt eller byd frit',
];

export default function LoginPage() {
  const router = useRouter();
  const { setLoggedIn } = useApp();
  const w = useWindowWidth();
  const isDesktop = w >= 768;

  const [step,      setStep]      = useState('email'); // 'email' | 'password'
  const [email,     setEmail]     = useState('');
  const [pass,      setPass]      = useState('');
  const [checking,  setChecking]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [emailFix,  setEmailFix]  = useState(null);
  const [showPass,  setShowPass]  = useState(false);
  const passRef = useRef(null);

  // Læs ?redirect=… og tillad KUN interne stier (undgå open redirect).
  function safeRedirect() {
    if (typeof window === 'undefined') return null;
    const r = new URLSearchParams(window.location.search).get('redirect');
    if (r && r.startsWith('/') && !r.startsWith('//')) return r;
    return null;
  }

  useEffect(() => {
    db.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(safeRedirect() || '/profil');
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get('email');
    if (e) setEmail(e);
  }, []);

  // Auto-focus password field when step changes
  useEffect(() => {
    if (step === 'password') setTimeout(() => passRef.current?.focus(), 80);
  }, [step]);

  async function handleEmailSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    if (!isValidEmail(email)) { setError('Skriv en gyldig e-mail (fx navn@institution.dk)'); return; }
    const fix = suggestEmailFix(email);
    if (fix && fix !== email.trim().toLowerCase()) { setEmailFix(fix); return; }
    if (!hasValidTld(email)) { setError('E-mailen ser ikke ud til at være gyldig. Tjek at den er skrevet rigtigt.'); return; }
    setChecking(true);
    setError(null);
    if (!(await checkEmailDeliverable(email))) {
      setChecking(false);
      setError('Vi kan ikke finde en mailserver for det domæne. Tjek at e-mailen er skrevet rigtigt.');
      return;
    }
    const emailLower = email.trim().toLowerCase();
    // Via SECURITY DEFINER RPC — institutions/institution_members er ikke anon-læsbare,
    // så en direkte tabel-læsning her (før login) ville altid give null og fejlagtigt
    // sende eksisterende brugere til signup.
    const { data: exists } = await db.rpc('institution_email_exists', { p_email: emailLower });
    setChecking(false);
    if (exists) {
      setStep('password');
    } else {
      router.push('/signup?email=' + encodeURIComponent(email.trim()));
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { data: authData, error } = await db.auth.signInWithPassword({ email, password: pass });
    setLoading(false);
    if (error) { setError('Forkert adgangskode. Prøv igen'); return; }
    setLoggedIn(true);
    router.push(safeRedirect() || '/dashboard');
  }

  const inputStyle = {
    width: '100%', padding: '13px 14px', borderRadius: 12,
    border: `1.5px solid ${PAPER3}`, background: PAPER2,
    fontSize: 15, fontFamily: FONT, color: INK, outline: 'none', boxSizing: 'border-box',
  };

  const formContent = (
    <div style={{ width: '100%', maxWidth: 380, ...(isDesktop ? { padding: '48px 40px' } : {}) }}>

      {step === 'email' && (
        <>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, color: INK, letterSpacing: '-0.03em', marginBottom: 6, marginTop: 0 }}>
            Log ind eller tilmeld dig
          </h1>
          <p style={{ fontFamily: FONT, fontSize: 14, color: INK3, marginBottom: 32, marginTop: 0 }}>
            Skriv din e-mail for at komme i gang
          </p>
          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontFamily: FONT, fontWeight: 700, fontSize: 13, color: INK2, marginBottom: 6 }}>E-mail</label>
              <input
                type="email" value={email} onChange={e => { setEmail(e.target.value); setError(null); setEmailFix(null); }}
                placeholder="navn@institution.dk" autoFocus required
                style={inputStyle}
              />
            </div>
            {emailFix && (
              <div style={{ background: '#FFFBEB', borderLeft: '3px solid #F59E0B', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#92400E', fontFamily: FONT }}>
                Mente du <button type="button" onClick={() => { setEmail(emailFix); setEmailFix(null); }} style={{ background: 'none', border: 'none', padding: 0, color: '#92400E', fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', fontFamily: FONT, fontSize: 13 }}>{emailFix}</button>?
              </div>
            )}
            {error && (
              <div style={{ background: '#FEF2F2', borderLeft: '3px solid #EF4444', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#B91C1C', fontFamily: FONT }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={checking || !email.trim()} style={{ width: '100%', padding: '14px', borderRadius: 999, background: PRIMARY, color: '#fff', border: 'none', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: (checking || !email.trim()) ? 'not-allowed' : 'pointer', opacity: (checking || !email.trim()) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {checking ? <><Spinner />Tjekker…</> : 'Fortsæt →'}
            </button>
          </form>
          <p style={{ marginTop: 20, fontFamily: FONT, fontSize: 13, color: INK3, textAlign: 'center' }}>
            Ingen konto? Vi opretter den automatisk hvis din e-mail ikke kendes.
          </p>
        </>
      )}

      {step === 'password' && (
        <>
          <button onClick={() => { setStep('email'); setPass(''); setError(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: INK3, fontFamily: FONT, fontSize: 13, fontWeight: 600, padding: '0 0 20px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Skift e-mail
          </button>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, color: INK, letterSpacing: '-0.03em', marginBottom: 6, marginTop: 0 }}>
            Velkommen tilbage
          </h1>
          <p style={{ fontFamily: FONT, fontSize: 14, color: INK3, marginBottom: 28, marginTop: 0 }}>
            Skriv adgangskoden til <strong style={{ color: INK }}>{email}</strong>
          </p>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontFamily: FONT, fontWeight: 700, fontSize: 13, color: INK2, marginBottom: 6 }}>Adgangskode</label>
              <div style={{ position: 'relative' }}>
                <input
                  ref={passRef}
                  type={showPass ? 'text' : 'password'}
                  value={pass} onChange={e => { setPass(e.target.value); setError(null); }}
                  placeholder="••••••••" required
                  style={{ ...inputStyle, paddingRight: 46 }}
                />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: INK3, padding: 0, display: 'flex', alignItems: 'center' }}>
                  <svg width={18} height={18} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    {showPass
                      ? <><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="2.5"/><line x1="3" y1="3" x2="17" y2="17"/></>
                      : <><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="2.5"/></>}
                  </svg>
                </button>
              </div>
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <span onClick={() => router.push('/glemt-adgangskode')} style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12, color: PRIMARY, cursor: 'pointer' }}>
                  Glemt adgangskode?
                </span>
              </div>
            </div>
            {error && (
              <div style={{ background: '#FEF2F2', borderLeft: '3px solid #EF4444', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#B91C1C', fontFamily: FONT }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading || !pass} style={{ width: '100%', padding: '14px', borderRadius: 999, background: PRIMARY, color: '#fff', border: 'none', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: (loading || !pass) ? 'not-allowed' : 'pointer', opacity: (loading || !pass) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? <><Spinner />Logger ind…</> : 'Log ind →'}
            </button>
          </form>
        </>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ background: GREEN_DEEP, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '60px 52px' }}>
          <span style={{ position: 'absolute', fontFamily: FONT, fontWeight: 800, fontSize: 'clamp(120px, 18vw, 220px)', color: 'rgba(255,255,255,0.04)', letterSpacing: '-0.05em', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', userSelect: 'none', whiteSpace: 'nowrap', pointerEvents: 'none' }}>byt</span>
          <LogoLockup markBg="rgba(255,255,255,0.15)" color="#fff" accentColor={GREEN_SOFT} markSize={44} textSize={22} />
          <p style={{ fontFamily: FONT, fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 12, marginBottom: 0, textAlign: 'center', maxWidth: 280 }}>
            Danmarks markedsplads for institutionslegetøj
          </p>
          <div style={{ marginTop: 48 }}>
            {TRUST_POINTS.map(pt => (
              <div key={pt} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 13, fontFamily: FONT, color: 'rgba(255,255,255,0.65)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN_SOFT, flexShrink: 0 }} />
                {pt}
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: PAPER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {formContent}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: PAPER, padding: '80px 24px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div onClick={() => router.push('/')} style={{ cursor: 'pointer', marginBottom: 36 }}>
        <LogoLockup markBg={GREEN_DEEP} color={INK} accentColor={PRIMARY} markSize={40} textSize={20} />
      </div>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {formContent}
      </div>
    </div>
  );
}
