'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';

const STEPS = [
  {
    icon: '📦',
    title: 'Opret dine opslag',
    desc: 'Læg dit legetøj ind allerede nu. Opslag gemmes som kladder og bliver synlige automatisk, så snart I er godkendt.',
    cta: 'Opret opslag',
    href: '/opret-opslag',
    primary: true,
  },
  {
    icon: '✏️',
    title: 'Færdiggør jeres profil',
    desc: 'Tilføj logo, beskrivelse og kontaktoplysninger, så andre institutioner kan lære jer at kende.',
    cta: 'Rediger profil',
    href: '/profil/rediger',
  },
  {
    icon: '🔍',
    title: 'Udforsk markedet',
    desc: 'Se hvad andre daginstitutioner sælger og bytter — find inspiration mens I venter.',
    cta: 'Se opslag',
    href: '/opslag',
  },
  {
    icon: '👥',
    title: 'Inviter jeres kolleger',
    desc: 'Få resten af teamet med ombord, så I er flere om at byde, sælge og bytte.',
    cta: 'Tilføj medarbejdere',
    href: '/medarbejdere',
  },
];

export default function AfventerGodkendelse() {
  const router = useRouter();
  const ww = useWindowWidth();
  const isMobile = ww > 0 && ww < 768;
  const [instName, setInstName] = useState(null);
  const [drafts, setDrafts] = useState([]);

  useEffect(() => {
    let active = true;
    db.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return; }
      const { data } = await db.from('institutions')
        .select('name,is_approved').ilike('email', user.email).maybeSingle();
      if (!active) return;
      // Allerede godkendt? Så hører man hjemme på profilen, ikke her.
      if (data?.is_approved === true) { router.replace('/profil'); return; }
      if (data?.name) setInstName(data.name);
      // Hent brugerens kladde-opslag, så de kan se hvad de har forberedt.
      const { data: d } = await db.from('listings')
        .select('id,title,emoji,color,created_at')
        .eq('user_id', user.id).eq('is_active', false).eq('is_sold', false)
        .order('created_at', { ascending: false });
      if (active) setDrafts(d || []);
    });
    return () => { active = false; };
  }, []);

  async function handleLogout() {
    await db.auth.signOut();
    router.push('/');
  }

  return (
    <div style={{ minHeight: '100vh', background: PAPER, padding: isMobile ? '32px 16px 64px' : '56px 24px 80px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Hero */}
        <div style={{
          background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`,
          borderRadius: 24, padding: isMobile ? '32px 24px' : '44px 48px', color: '#fff',
          boxShadow: '0 8px 32px rgba(19,63,43,0.22)', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.14)',
            borderRadius: 99, padding: '7px 14px', fontSize: 13, fontWeight: 700, fontFamily: FONT, marginBottom: 20,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FCD34D', boxShadow: '0 0 0 4px rgba(252,211,77,0.25)' }} />
            Afventer godkendelse · typisk inden for 2 timer
          </div>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 26 : 34, letterSpacing: '-0.03em', lineHeight: 1.12, margin: '0 0 12px' }}>
            Velkommen{instName ? `, ${instName}` : ''}! 🎉
          </h1>
          <p style={{ fontSize: isMobile ? 14.5 : 16, lineHeight: 1.6, margin: 0, color: 'rgba(255,255,255,0.9)', maxWidth: 540 }}>
            Vi godkender jer hurtigst muligt — som regel inden for et par timer. Men I behøver <strong style={{ color: '#fff' }}>ikke vente</strong> med at komme i gang: gør alt det nedenfor nu, så er I klar i samme øjeblik vi godkender.
          </p>
        </div>

        {/* Dine kladder */}
        {drafts.length > 0 && (
          <div style={{ margin: isMobile ? '28px 0 0' : '36px 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK3 }}>
                Dine kladder ({drafts.length})
              </div>
              <button onClick={() => router.push('/opret-opslag')} style={{ background: 'none', border: 'none', color: PRIMARY, fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                + Tilføj
              </button>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${PAPER2}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 4px rgba(22,34,28,0.06)' }}>
              {drafts.map((d, i) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderTop: i > 0 ? `1px solid ${PAPER2}` : 'none' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: d.color || GREEN_TINT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{d.emoji || '📦'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14.5, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title || 'Uden titel'}</div>
                    <div style={{ fontFamily: FONT, fontSize: 12.5, color: INK3 }}>Bliver synlig ved godkendelse</div>
                  </div>
                  <span style={{ flexShrink: 0, fontFamily: FONT, fontSize: 11, fontWeight: 800, color: '#92400E', background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 99, padding: '4px 10px' }}>Kladde</span>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: FONT, fontSize: 12.5, color: INK3, marginTop: 10, paddingLeft: 2 }}>
              Disse opslag bliver synlige på markedspladsen automatisk, så snart vi har godkendt jer.
            </div>
          </div>
        )}

        {/* Getting-started guide */}
        <div style={{ margin: isMobile ? '28px 0 0' : '36px 0 0' }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK3, marginBottom: 16 }}>
            Kom godt i gang
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            {STEPS.map((s) => (
              <button
                key={s.href}
                onClick={() => router.push(s.href)}
                style={{
                  textAlign: 'left', cursor: 'pointer', background: '#fff',
                  border: `1px solid ${s.primary ? GREEN_SOFT : PAPER2}`,
                  borderRadius: 18, padding: isMobile ? '20px' : '24px', display: 'flex', flexDirection: 'column', gap: 10,
                  boxShadow: '0 1px 4px rgba(22,34,28,0.06)', transition: 'box-shadow 0.15s, transform 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(22,34,28,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(22,34,28,0.06)'; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: 13, background: s.primary ? GREEN_TINT : PAPER,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}>{s.icon}</div>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: INK }}>{s.title}</div>
                <div style={{ fontFamily: FONT, fontSize: 13.5, color: INK3, lineHeight: 1.55, flex: 1 }}>{s.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT, fontWeight: 700, fontSize: 14, color: PRIMARY, marginTop: 2 }}>
                  {s.cta}
                  <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1l5 5-5 5" stroke={PRIMARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* What happens next */}
        <div style={{ background: GREEN_TINT, borderRadius: 18, padding: isMobile ? '20px' : '22px 26px', marginTop: 24 }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PRIMARY, marginBottom: 10 }}>Hvad sker der nu?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Vi bekræfter jeres oplysninger — typisk inden for 2 timer.',
              'I får en e-mail så snart institutionen er godkendt.',
              'Jeres kladde-opslag bliver synlige automatisk, og I kan handle med det samme.',
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: PRIMARY, color: '#fff',
                  fontFamily: FONT, fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{i + 1}</span>
                <span style={{ fontFamily: FONT, fontSize: 14, color: INK2, lineHeight: 1.5 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <p style={{ fontSize: 13, color: INK3, fontFamily: FONT, margin: '0 0 14px' }}>
            Spørgsmål? Skriv til{' '}
            <a href="mailto:support@bytogleg.dk" style={{ color: PRIMARY, textDecoration: 'none', fontWeight: 700 }}>support@bytogleg.dk</a>
          </p>
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: INK3, fontFamily: FONT, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
            Log ud
          </button>
        </div>
      </div>
    </div>
  );
}
