'use client';
// Lille genkendeligt carrier-badge i brandfarver. Bruges til at vise køber
// hvilken transportør den (billigste) forsendelse sendes med.
// carrier: 'pdk' | 'postnord' | 'gls' | 'dao'

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

const CARRIERS = {
  pdk:      { name: 'PostNord', bg: '#005CB9', fg: '#fff' },
  postnord: { name: 'PostNord', bg: '#005CB9', fg: '#fff' },
  gls:      { name: 'GLS',      bg: '#06038D', fg: '#fff', accent: '#FFD100' },
  dao:      { name: 'dao',      bg: '#E2001A', fg: '#fff' },
};

export default function CarrierLogo({ carrier, size = 'sm' }) {
  const c = CARRIERS[carrier];
  if (!c) return null;
  const pad = size === 'sm' ? '3px 8px' : '4px 10px';
  const fontSize = size === 'sm' ? 11 : 12;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: c.bg, color: c.fg, borderRadius: 5,
      padding: pad, fontFamily: FONT, fontWeight: 800, fontSize,
      letterSpacing: '-0.01em', lineHeight: 1, whiteSpace: 'nowrap',
      textTransform: carrier === 'dao' ? 'lowercase' : 'none',
    }}>
      {c.accent && <span style={{ width: 6, height: 6, borderRadius: 1, background: c.accent, flexShrink: 0 }} />}
      {c.name}
    </span>
  );
}

export function carrierName(carrier) {
  return CARRIERS[carrier]?.name ?? carrier;
}
