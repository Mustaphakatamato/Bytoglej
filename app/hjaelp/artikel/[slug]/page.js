'use client';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PRIMARY, GREEN_SOFT, GREEN_TINT, INK, INK2, INK3, PAPER, PAPER3, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { getArticle, getCategory } from '@/lib/help-content';
import { HelpHero, HelpBreadcrumb, ArticleBlocks, ArticleRow } from '@/components/HelpUI';

function openSupportBubble() {
  const btn = document.querySelector('[data-support-bubble]');
  if (btn) btn.click();
}

export default function HelpArticlePage() {
  const router = useRouter();
  const params = useParams();
  const w = useWindowWidth();
  const isMobile = w > 0 && w < 768;
  const [feedback, setFeedback] = useState(null); // 'yes' | 'no' | null

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
        <div style={{ background: GREEN_TINT, border: `1px solid ${GREEN_SOFT}`, borderRadius: 16, padding: '20px 22px', margin: '24px 0 40px', textAlign: 'center' }}>
          {feedback === null ? (
            <>
              <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: INK, margin: '0 0 14px' }}>Var denne artikel en hjælp?</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => setFeedback('yes')} style={{ background: '#fff', border: `1px solid ${GREEN_SOFT}`, borderRadius: 999, padding: '9px 22px', fontFamily: FONT, fontWeight: 700, fontSize: 14, color: PRIMARY, cursor: 'pointer' }}>👍 Ja</button>
                <button onClick={() => setFeedback('no')} style={{ background: '#fff', border: `1px solid ${PAPER3}`, borderRadius: 999, padding: '9px 22px', fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK2, cursor: 'pointer' }}>👎 Nej</button>
              </div>
            </>
          ) : feedback === 'yes' ? (
            <p style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15, color: INK, margin: 0 }}>Tak for din feedback! 🌱</p>
          ) : (
            <div>
              <p style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15, color: INK, margin: '0 0 12px' }}>Beklager det. Vil du spørge vores supportteam?</p>
              <button onClick={openSupportBubble} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 999, padding: '11px 24px', fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                💬 Chat med os
              </button>
            </div>
          )}
        </div>

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
