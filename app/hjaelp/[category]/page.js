'use client';
import { useRouter, useParams } from 'next/navigation';
import { PRIMARY, GREEN_DEEP, INK, INK3, PAPER, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { getCategory, articlesInCategory, CATEGORIES } from '@/lib/help-content';
import { HelpSearch, HelpHero, HelpBreadcrumb, ArticleRow } from '@/components/HelpUI';

export default function HelpCategoryPage() {
  const router = useRouter();
  const params = useParams();
  const w = useWindowWidth();
  const isMobile = w > 0 && w < 768;

  const slug = params?.category;
  const cat = getCategory(slug);

  if (!cat) {
    return (
      <div style={{ background: PAPER, minHeight: '100vh' }}>
        <HelpHero isMobile={isMobile} compact>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 28 : 38, color: '#fff', margin: 0 }}>Emnet findes ikke</h1>
        </HelpHero>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', textAlign: 'center' }}>
          <button onClick={() => router.push('/hjaelp')} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 999, padding: '13px 26px', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            ← Tilbage til hjælpecentret
          </button>
        </div>
      </div>
    );
  }

  const articles = articlesInCategory(slug);
  const others = CATEGORIES.filter(c => c.slug !== slug);

  return (
    <div style={{ background: PAPER, minHeight: '100vh', overflowX: 'hidden' }}>
      <HelpHero isMobile={isMobile} compact>
        <div style={{ fontSize: isMobile ? 44 : 56, marginBottom: 12 }}><span aria-hidden="true">{cat.icon}</span></div>
        <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 30 : 44, letterSpacing: '-0.04em', lineHeight: 1.05, color: '#fff', marginBottom: 14 }}>
          {cat.title}
        </h1>
        <p style={{ fontSize: isMobile ? 15 : 17, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, maxWidth: 460, margin: '0 auto 26px', fontFamily: FONT }}>
          {cat.desc}
        </p>
        <HelpSearch />
      </HelpHero>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? '32px 20px 80px' : '44px 40px 100px' }}>
        <HelpBreadcrumb trail={[{ label: 'Hjælpecenter', href: '/hjaelp' }, { label: cat.title }]} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 56 }}>
          {articles.map(a => (
            <ArticleRow key={a.slug} article={a} onClick={() => router.push(`/hjaelp/artikel/${a.slug}`)} />
          ))}
        </div>

        {/* Andre emner */}
        <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: INK, margin: '0 0 16px' }}>Andre emner</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {others.map(c => (
            <button key={c.slug} onClick={() => router.push(`/hjaelp/${c.slug}`)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${c.color}33`,
              borderRadius: 999, padding: '9px 16px', fontFamily: FONT, fontWeight: 600, fontSize: 13.5, color: INK, cursor: 'pointer',
            }}>
              <span aria-hidden="true">{c.icon}</span> {c.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
