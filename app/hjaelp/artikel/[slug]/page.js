'use client';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PRIMARY, GREEN_SOFT, GREEN_TINT, INK, INK2, INK3, PAPER, PAPER2, PAPER3, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { db } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { getArticle, getCategory } from '@/lib/help-content';
import { HelpHero, HelpBreadcrumb, ArticleBlocks, ArticleRow } from '@/components/HelpUI';

function openSupportBubble() {
  const btn = document.querySelector('[data-support-bubble]');
  if (btn) btn.click();
}

const FB_BOX = { background: GREEN_TINT, border: `1px solid ${GREEN_SOFT}`, borderRadius: 16, padding: '20px 22px', margin: '24px 0 40px' };

/* "Var denne artikel en hjælp?" gemmer både Ja og Nej (samt valgfri uddybning
   ved Nej) i den fælles feedback-tabel via /api/feedback, så svarene dukker op i
   admin-feedback-tab'en på linje med feedback-boblen. */
function ArticleFeedback({ article }) {
  const { effectiveInstitution } = useApp();
  const [view, setView] = useState('ask');     // 'ask' | 'comment' | 'done'
  const [helpful, setHelpful] = useState(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  async function record(isHelpful, note) {
    try {
      const { data: { session } } = await db.auth.getSession();
      if (!session?.access_token) return; // gem kun for indloggede (samme anti-spam som feedback-boblen)
      const label = isHelpful ? '👍 Nyttig' : '👎 Ikke nyttig';
      const message = `${label}: "${article.title}"${note ? `\n\n${note}` : ''}`;
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          category: 'help_article',
          message,
          page: `/hjaelp/artikel/${article.slug}`,
          institutionName: effectiveInstitution?.name || '',
        }),
      });
    } catch { /* fejl her må ikke forstyrre læseren */ }
  }

  function handleYes() { setHelpful(true); record(true, ''); setView('done'); }
  function handleNo()  { setHelpful(false); setView('comment'); }

  async function finishNo(withComment) {
    setSending(true);
    await record(false, withComment ? comment.trim() : '');
    setSending(false);
    setView('done');
  }

  if (view === 'done') {
    return (
      <div style={{ ...FB_BOX, textAlign: 'center' }}>
        <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: INK, margin: helpful === false ? '0 0 12px' : 0 }}>Tak for din feedback! 🌱</p>
        {helpful === false && (
          <button onClick={openSupportBubble} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 999, padding: '11px 24px', fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            💬 Chat med supporten
          </button>
        )}
      </div>
    );
  }

  if (view === 'comment') {
    return (
      <div style={FB_BOX}>
        <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: INK, margin: '0 0 4px' }}>Beklager det. Hvad manglede du?</p>
        <p style={{ fontFamily: FONT, fontSize: 13, color: INK3, margin: '0 0 12px' }}>Din feedback hjælper os med at forbedre artiklen (valgfrit).</p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Fx hvad der var svært at finde eller forstå…"
          autoFocus
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: `1.5px solid ${PAPER3}`, borderRadius: 12, background: '#fff', fontFamily: FONT, fontSize: 14, color: INK, resize: 'vertical', outline: 'none', lineHeight: 1.55 }}
          onFocus={e => { e.target.style.borderColor = PRIMARY; }}
          onBlur={e => { e.target.style.borderColor = PAPER3; }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button onClick={() => finishNo(true)} disabled={sending || !comment.trim()} style={{ background: comment.trim() && !sending ? PRIMARY : PAPER3, color: comment.trim() && !sending ? '#fff' : INK3, border: 'none', borderRadius: 999, padding: '11px 24px', fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: comment.trim() && !sending ? 'pointer' : 'default' }}>
            {sending ? 'Sender…' : 'Send feedback'}
          </button>
          <button onClick={() => finishNo(false)} disabled={sending} style={{ background: '#fff', color: INK2, border: `1px solid ${PAPER3}`, borderRadius: 999, padding: '11px 20px', fontFamily: FONT, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            Spring over
          </button>
          <button onClick={openSupportBubble} style={{ background: 'none', color: PRIMARY, border: 'none', padding: '11px 4px', fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            💬 Chat med supporten
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...FB_BOX, textAlign: 'center' }}>
      <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: INK, margin: '0 0 14px' }}>Var denne artikel en hjælp?</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={handleYes} style={{ background: '#fff', border: `1px solid ${GREEN_SOFT}`, borderRadius: 999, padding: '9px 22px', fontFamily: FONT, fontWeight: 700, fontSize: 14, color: PRIMARY, cursor: 'pointer' }}>👍 Ja</button>
        <button onClick={handleNo} style={{ background: '#fff', border: `1px solid ${PAPER3}`, borderRadius: 999, padding: '9px 22px', fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK2, cursor: 'pointer' }}>👎 Nej</button>
      </div>
    </div>
  );
}

export default function HelpArticlePage() {
  const router = useRouter();
  const params = useParams();
  const w = useWindowWidth();
  const isMobile = w > 0 && w < 768;

  const article = getArticle(params?.slug);

  if (!article) {
    return (
      <div style={{ background: PAPER, minHeight: '100vh' }}>
        <HelpHero isMobile={isMobile} compact>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 28 : 38, color: '#fff', margin: 0 }}>Artiklen findes ikke</h1>
        </HelpHero>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', textAlign: 'center' }}>
          <button onClick={() => router.push('/hjaelp')} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 999, padding: '13px 26px', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            ← Tilbage til hjælpecentret
          </button>
        </div>
      </div>
    );
  }

  const cat = getCategory(article.category);
  const related = (article.related || []).map(getArticle).filter(Boolean);

  return (
    <div style={{ background: PAPER, minHeight: '100vh', overflowX: 'hidden', paddingTop: 92, paddingBottom: 90 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: isMobile ? '20px 20px' : '32px 40px' }}>

        <HelpBreadcrumb trail={[
          { label: 'Hjælpecenter', href: '/hjaelp' },
          ...(cat ? [{ label: cat.title, href: `/hjaelp/${cat.slug}` }] : []),
          { label: article.title },
        ]} />

        {/* Titel */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28 }}>
          <span aria-hidden="true" style={{ fontSize: 40, flexShrink: 0, lineHeight: 1 }}>{article.icon}</span>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 26 : 34, letterSpacing: '-0.03em', lineHeight: 1.15, color: INK, margin: 0 }}>
            {article.title}
          </h1>
        </div>

        {/* Indhold */}
        <article style={{ background: '#fff', border: `1px solid ${PAPER3}`, borderRadius: 20, padding: isMobile ? '24px 22px' : '36px 40px' }}>
          <ArticleBlocks blocks={article.blocks} />
        </article>

        {/* Var dette en hjælp? */}
        <ArticleFeedback article={article} />

        {/* Relaterede artikler */}
        {related.length > 0 && (
          <section>
            <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: INK, margin: '0 0 16px' }}>Relaterede artikler</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {related.map(a => (
                <ArticleRow key={a.slug} article={a} onClick={() => router.push(`/hjaelp/artikel/${a.slug}`)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
