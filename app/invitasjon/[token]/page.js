'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL, FONT } from '@/lib/constants';

function pwStrength(p) {
  return {
    length:  p.length >= 8,
    upper:   /[A-Z]/.test(p),
    number:  /[0-9]/.test(p),
    special: /[^a-zA-Z0-9]/.test(p),
  };
}

function EyeIcon({ open }) {
  return open
    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
}

export default function InvitasjonPage() {
  const { token } = useParams();
  const router = useRouter();

  const [invitation, setInvitation] = useState(null);
  const [status, setStatus] = useState('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    async function load() {
      const { data, error } = await db
        .from('institution_invitations')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (error || !data)     { setStatus('invalid');  return; }
      if (data.accepted_at)   { setStatus('used');     return; }
      if (new Date(data.expires_at) < new Date()) { setStatus('expired'); return; }

      setInvitation(data);
      setStatus('valid');
    }
    if (token) load();
  }, [token]);

  const str = pwStrength(password);
  const metCount = Object.values(str).filter(Boolean).length;
  const allMet = metCount === 4;
  const barColor = metCount <= 1 ? CORAL : metCount === 2 ? '#F59E0B' : metCount === 3 ? '#84CC16' : PRIMARY;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!allMet) { setErr('Adgangskoden opfylder ikke alle krav'); return; }
    if (password !== confirm) { setErr('Adgangskoderne stemmer ikke overens'); return; }
    setSubmitting(true);
    setErr('');

    const { data: signUpData, error: signUpErr } = await db.auth.signUp({
      email: invitation.email,
      password,
    });

    const alreadyExists = signUpErr?.message?.toLowerCase().includes('already registered');
    if (signUpErr && !alreadyExists) {
      setErr(signUpErr.message);
      setSubmitting(false);
      return;
    }

    // Link to institution regardless of whether account was new or existing
    await db.from('institution_members').upsert({
      institution_id: invitation.institution_id,
      email: invitation.email,
      role: 'member',
    }, { onConflict: 'institution_id,email', ignoreDuplicates: true });

    // Mark accepted
    await db.from('institution_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', token);

    setSubmitting(false);
    setDone(true);

    // If auto-confirmed (Supabase email confirm disabled), redirect after short delay
    if (signUpData?.session) {
      setTimeout(() => router.push('/profil'), 2000);
    }
  }

  // ── States ─────────────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:PAPER }}>
        <div style={{ fontFamily:FONT, fontSize:16, color:INK3 }}>Indlæser…</div>
      </div>
    );
  }

  if (status === 'invalid') {
    return <InfoScreen icon="?" title="Ugyldigt link" body="Dette invitationslink findes ikke eller er ugyldigt." />;
  }
  if (status === 'expired') {
    return <InfoScreen icon="⏱" title="Linket er udløbet" body="Invitationen var gyldig i 7 dage. Bed institutionen om at sende en ny invitation." />;
  }
  if (status === 'used') {
    return <InfoScreen icon="✓" title="Invitation allerede brugt" body="Denne invitation er allerede accepteret. Log ind med din e-mail og adgangskode." action={{ label:'Gå til login', href:'/login' }} />;
  }

  if (done) {
    const needsConfirm = !done.session;
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:PAPER, padding:24 }}>
        <div style={{ background:PAPER2, borderRadius:24, padding:isMobileCheck()?'32px 24px':'48px', maxWidth:480, width:'100%', border:'1px solid rgba(22,34,28,0.08)', textAlign:'center' }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 style={{ fontFamily:FONT, fontWeight:800, fontSize:24, color:INK, marginBottom:12, letterSpacing:'-0.03em' }}>
            Velkommen til {invitation.institution_name}!
          </h1>
          <p style={{ fontFamily:FONT, fontSize:15, color:INK3, lineHeight:1.65, marginBottom:28 }}>
            {needsConfirm
              ? `Vi har sendt en bekræftelsesmail til ${invitation.email}. Bekræft din e-mail, og log derefter ind.`
              : 'Din konto er oprettet og du er nu tilknyttet institutionen. Du videresendes til dashboardet…'}
          </p>
          <Link href="/login" style={{ display:'inline-block', background:PRIMARY, color:'#fff', fontFamily:FONT, fontWeight:700, fontSize:15, padding:'14px 32px', borderRadius:99, textDecoration:'none' }}>
            Gå til login
          </Link>
        </div>
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight:'100vh', background:PAPER, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:PAPER2, borderRadius:24, overflow:'hidden', maxWidth:480, width:'100%', border:'1px solid rgba(22,34,28,0.08)', boxShadow:'0 4px 24px rgba(22,34,28,0.07)' }}>

        {/* Header */}
        <div style={{ background:`linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`, padding:'32px 36px' }}>
          <Link href="/" style={{ display:'inline-block', background:'rgba(255,255,255,0.13)', borderRadius:10, padding:'7px 16px', textDecoration:'none', marginBottom:20 }}>
            <span style={{ fontFamily:FONT, fontWeight:800, fontSize:18, letterSpacing:'-0.04em', color:'#fff' }}>byt<span style={{ opacity:0.6 }}>&</span>leg.</span>
          </Link>
          <h1 style={{ fontFamily:FONT, fontWeight:800, fontSize:22, color:'#fff', margin:0, letterSpacing:'-0.03em' }}>
            Du er inviteret!
          </h1>
          <p style={{ fontFamily:FONT, fontSize:14, color:'rgba(255,255,255,0.7)', marginTop:8, marginBottom:0 }}>
            Opret din adgangskode for at få adgang til <strong style={{ color:'#fff' }}>{invitation.institution_name}</strong>
          </p>
        </div>

        {/* Form */}
        <div style={{ padding:'32px 36px' }}>
          <div style={{ background:GREEN_TINT, borderLeft:`3px solid ${GREEN_SOFT}`, borderRadius:'0 10px 10px 0', padding:'12px 16px', marginBottom:24 }}>
            <div style={{ fontFamily:FONT, fontSize:13, color:INK3 }}>Invitation til</div>
            <div style={{ fontFamily:FONT, fontWeight:700, fontSize:15, color:INK }}>{invitation.email}</div>
          </div>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:18 }}>

            {/* Password */}
            <div>
              <label style={{ display:'block', fontFamily:FONT, fontSize:13, fontWeight:700, color:INK2, marginBottom:6 }}>
                Vælg adgangskode
              </label>
              <div style={{ position:'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mindst 8 tegn"
                  autoComplete="new-password"
                  required
                  style={{ width:'100%', padding:'12px 44px 12px 14px', borderRadius:10, border:`1.5px solid ${password ? (allMet ? PRIMARY : PAPER3) : PAPER3}`, fontSize:14, fontFamily:FONT, outline:'none', background:PAPER2, boxSizing:'border-box' }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:INK3, display:'flex', alignItems:'center' }}>
                  <EyeIcon open={showPw} />
                </button>
              </div>

              {/* Strength bar */}
              {password.length > 0 && (
                <div style={{ marginTop:8 }}>
                  <div style={{ height:3, background:PAPER3, borderRadius:99, overflow:'hidden', marginBottom:8 }}>
                    <div style={{ height:'100%', width:`${(metCount/4)*100}%`, background:barColor, borderRadius:99, transition:'all 0.3s' }} />
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {[
                      [str.length,  'Mindst 8 tegn'],
                      [str.upper,   'Mindst ét stort bogstav'],
                      [str.number,  'Mindst ét tal'],
                      [str.special, 'Mindst ét specialtegn (!@#…)'],
                    ].map(([met, label]) => (
                      <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background:met ? PRIMARY : PAPER3, flexShrink:0 }} />
                        <span style={{ fontFamily:FONT, fontSize:12, color:met ? PRIMARY : INK3, fontWeight:met ? 700 : 400 }}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label style={{ display:'block', fontFamily:FONT, fontSize:13, fontWeight:700, color:INK2, marginBottom:6 }}>
                Gentag adgangskode
              </label>
              <div style={{ position:'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Gentag adgangskoden"
                  autoComplete="new-password"
                  required
                  style={{ width:'100%', padding:'12px 44px 12px 14px', borderRadius:10, border:`1.5px solid ${confirm && confirm !== password ? CORAL : confirm && confirm === password ? PRIMARY : PAPER3}`, fontSize:14, fontFamily:FONT, outline:'none', background:PAPER2, boxSizing:'border-box' }}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:INK3, display:'flex', alignItems:'center' }}>
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </div>

            {err && (
              <div style={{ background:'#FEF2F2', borderLeft:`3px solid #EF4444`, borderRadius:'0 10px 10px 0', padding:'11px 14px', fontFamily:FONT, fontSize:13, color:'#B91C1C' }}>
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !allMet || password !== confirm}
              style={{ width:'100%', padding:'14px', borderRadius:99, background:submitting||!allMet||password!==confirm ? PAPER3 : PRIMARY, border:'none', color:submitting||!allMet||password!==confirm ? INK3 : '#fff', fontFamily:FONT, fontWeight:700, fontSize:15, cursor:submitting||!allMet||password!==confirm ? 'default' : 'pointer', transition:'all 0.2s' }}>
              {submitting ? 'Opretter konto…' : 'Opret konto og accepter invitation'}
            </button>
          </form>

          <p style={{ textAlign:'center', fontFamily:FONT, fontSize:13, color:INK3, marginTop:20 }}>
            Har du allerede en konto?{' '}
            <Link href="/login" style={{ color:PRIMARY, fontWeight:700, textDecoration:'none' }}>Log ind</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function isMobileCheck() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 600;
}

function InfoScreen({ icon, title, body, action }) {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:PAPER, padding:24 }}>
      <div style={{ background:PAPER2, borderRadius:24, padding:'48px 40px', maxWidth:440, width:'100%', border:'1px solid rgba(22,34,28,0.08)', textAlign:'center' }}>
        <div style={{ fontFamily:FONT, fontWeight:800, fontSize:48, color:GREEN_SOFT, marginBottom:16, lineHeight:1 }}>{icon}</div>
        <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:22, color:INK, marginBottom:10, letterSpacing:'-0.03em' }}>{title}</h2>
        <p style={{ fontFamily:FONT, fontSize:15, color:INK3, lineHeight:1.65, marginBottom:action ? 28 : 0 }}>{body}</p>
        {action && (
          <Link href={action.href} style={{ display:'inline-block', background:PRIMARY, color:'#fff', fontFamily:FONT, fontWeight:700, fontSize:15, padding:'13px 30px', borderRadius:99, textDecoration:'none' }}>
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}
