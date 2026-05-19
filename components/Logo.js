'use client';
import { PRIMARY, PAPER, INK } from '@/lib/constants';

export function Mark09({ size = 36, bg = PRIMARY }) {
  const r = Math.round(size * 0.18);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="byt&leg" style={{ flexShrink:0, display:'block' }}>
      <rect x="0" y="0" width="64" height="64" rx={r * 64 / size} fill={bg} />
      <text x="32" y="27" textAnchor="middle" fontFamily="'Sora',sans-serif" fontWeight="800" fontSize="21" letterSpacing="-0.06em" fill={PAPER}>byt</text>
      <text x="32" y="49" textAnchor="middle" fontFamily="'Sora',sans-serif" fontWeight="800" fontSize="21" letterSpacing="-0.06em" fill={PAPER}>&amp;leg.</text>
    </svg>
  );
}

export function LogoLockup({ markSize = 40, textSize = 20, color = INK, accentColor = PRIMARY, markBg = PRIMARY }) {
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:10 }}>
      <Mark09 size={markSize} bg={markBg} />
      <span style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:textSize, letterSpacing:'-0.04em', lineHeight:1.05, color }}>
        <span style={{ display:'block' }}>byt</span>
        <span style={{ display:'block' }}>
          <span style={{ color:accentColor }}>&amp;</span>leg<span style={{ color:accentColor }}>.</span>
        </span>
      </span>
    </div>
  );
}
