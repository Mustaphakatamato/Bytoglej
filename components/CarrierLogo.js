'use client';
// Lille carrier-logo der viser køber hvilken transportør forsendelsen sendes med.
// Rigtige logoer (PostNord, GLS, DAO) i /public/carriers, vist i en ensartet hvid pille
// så de altid er læsbare uanset baggrund (hvid eller grøn-tonet ved valg).
// carrier: 'pdk' | 'postnord' | 'gls' | 'dao'

const LOGOS = {
  pdk:      { src: '/carriers/postnord.svg', name: 'PostNord' },
  postnord: { src: '/carriers/postnord.svg', name: 'PostNord' },
  gls:      { src: '/carriers/gls.svg',      name: 'GLS' },
  dao:      { src: '/carriers/dao.svg',      name: 'dao' },
};

export default function CarrierLogo({ carrier, height = 14 }) {
  const c = LOGOS[carrier];
  if (!c) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 5,
      padding: '3px 7px', flexShrink: 0,
    }}>
      <img src={c.src} alt={c.name} height={height} style={{ height, width: 'auto', display: 'block' }} />
    </span>
  );
}

export function carrierName(carrier) {
  return LOGOS[carrier]?.name ?? carrier;
}
