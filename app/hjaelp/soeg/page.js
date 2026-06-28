'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PRIMARY, INK, INK3, PAPER, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { searchArticles } from '@/lib/help-content';
import { HelpSearch, HelpHero, HelpBreadcrumb, ArticleRow } from '@/components/HelpUI';

function openSupportBubble() {
  const btn = document.querySelector('[data-support-bubble]');
  if (btn) btn.click();
}

function SearchResults() {
  const router = useRouter();
  const sp = useSearchParams();
  const w = useWindowWidth();
  const isMobile = w > 0 && w < 768;

  const q = sp.get('q') || '';
  const results = searchArticles(q);

  return (
    <div style={{ background: PAPER, minHeight: '100vh', overflowX: 'hidden' }}>
      <HelpHero isMobile={isMobile} compact>
        <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 26 : 38, letterSpacing: '-0.03em', color: '#fff', marginBottom: 22 }}>
          Søg i hjælpecentret
        </h1>
        <HelpSearch defaultValue={q} autoFocus />
      </HelpHero>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? '32px 20px 80px' : '44px 40px 100px' }}>
        <HelpBreadcrumb trail={[{ label: 'Hjælpecenter', href: '/hjaelp' }, { label: 'Søg' }]} />

        <p style={{ fontFamily: FONT, fontSize: 14.5, color: INK3, margin: '0 0 22px' }}>
          {q
            ? `${results.length} ${results.length === 1 ? 'resultat' : 'resultater'} for “${q}”`
            : 'Skriv et søgeord ovenfor for at finde artikler.'}
        </p>

        {results.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {results.map(a => (
              <ArticleRow key={a.slug} article={a} onClick={() => router.push(`/hjaelp/artikel/${a.slug}`)} />
            ))}
          </div>
        ) : q ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}><span aria-hidden="true">🔍</span></div>
            <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 17, color: INK, margin: '0 0 6px' }}>Ingen artikler matchede</p>
            <p style={{ fontFamily: FONT, fontSize: 14.5, color: INK3, lineHeight: 1.6, margin: '0 0 22px', maxWidth: 420, marginInline: 'auto' }}>
              Prøv et andet søgeord, eller spørg vores AI-assistent direkte.
            </p>
            <button onClick={openSupportBubble} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 999, padding: '13px 26px', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              💬 Chat med os
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function HelpSearchPage() {
  return (
    <Suspense fallback={<div style={{ background: PAPER, minHeight: '100vh' }} />}>
      <SearchResults />
    </Suspense>
  );
}
