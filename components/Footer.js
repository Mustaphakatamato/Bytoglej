import Link from 'next/link';
import { PRIMARY, INK, INK3, PAPER2, PAPER3 } from '@/lib/constants';

const FONT = "'Sora', sans-serif";

const LINK_STYLE = { display: 'block', fontSize: 14, color: INK3, textDecoration: 'none', marginBottom: 9 };
const HEAD_STYLE = { fontSize: 11, fontWeight: 700, color: INK3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 };

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer style={{ background: PAPER2, borderTop: `1px solid ${PAPER3}`, marginTop: 80, fontFamily: FONT }}>
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '48px 24px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 40 }}>

        {/* Brand */}
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.04em', color: INK, marginBottom: 8 }}>
            byt<span style={{ color: PRIMARY }}>&amp;</span>leg<span style={{ color: PRIMARY }}>.</span>
          </div>
          <p style={{ fontSize: 13, color: INK3, lineHeight: 1.65, margin: 0, maxWidth: 220 }}>
            Den første markedsplads hvor institutioner kan bytte, købe og sælge legetøj bæredygtigt.
          </p>
        </div>

        {/* Markedsplads */}
        <div>
          <div style={HEAD_STYLE}>Markedsplads</div>
          <Link href="/opslag" style={LINK_STYLE}>Alle opslag</Link>
          <Link href="/opret-opslag" style={LINK_STYLE}>Opret opslag</Link>
          <Link href="/opslag?category=legetoj" style={LINK_STYLE}>🧸 Legetøj</Link>
          <Link href="/opslag?category=udendoers" style={LINK_STYLE}>🌳 Udendørs</Link>
          <Link href="/opslag?category=kreativitet" style={LINK_STYLE}>🎨 Kreativitet</Link>
        </div>

        {/* Om platformen */}
        <div>
          <div style={HEAD_STYLE}>Om platformen</div>
          <Link href="/hvordan" style={LINK_STYLE}>Sådan virker det</Link>
          <Link href="/om-os" style={LINK_STYLE}>Om os</Link>
          <Link href="/kontakt" style={LINK_STYLE}>Kontakt</Link>
        </div>

        {/* Institution */}
        <div>
          <div style={HEAD_STYLE}>Din institution</div>
          <Link href="/signup" style={LINK_STYLE}>Tilmeld institution</Link>
          <Link href="/login" style={LINK_STYLE}>Log ind</Link>
          <Link href="/dashboard" style={LINK_STYLE}>Mit dashboard</Link>
          <Link href="/beskeder" style={LINK_STYLE}>Beskeder</Link>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${PAPER3}`, maxWidth: 1140, margin: '0 auto', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 12, color: INK3 }}>© {year} byt&amp;leg · Alle rettigheder forbeholdes</span>
        <span style={{ fontSize: 12, color: INK3 }}>Bygget med ♻️ til danske institutioner</span>
      </div>
    </footer>
  );
}
