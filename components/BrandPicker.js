'use client';
import { useState, useRef, useEffect } from 'react';
import { BRAND_OPTIONS } from '@/lib/toy-brands';
import { PRIMARY, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, FONT } from '@/lib/constants';

export default function BrandPicker({ value, onChange, style }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) { setSearch(''); setTimeout(() => searchRef.current?.focus(), 50); }
  }, [open]);

  const filtered = BRAND_OPTIONS.filter(b =>
    !search || b.label.toLowerCase().includes(search.toLowerCase())
  );

  const isUnselected = value === null || value === undefined;
  const selectedLabel = isUnselected
    ? 'Vælg varemærke…'
    : (BRAND_OPTIONS.find(b => b.value === value)?.label || 'Intet varemærke');

  return (
    <div ref={ref} style={{ position:'relative', ...style }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:`1.5px solid ${PAPER3}`, fontSize:14, outline:'none', fontFamily:FONT, background:'#fff', color: isUnselected ? INK3 : INK, boxSizing:'border-box', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between' }}
      >
        <span>{selectedLabel}</span>
        <span style={{ fontSize:10, color:INK3 }}>▾</span>
      </button>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:999, background:'#fff', borderRadius:14, border:`1.5px solid ${PAPER3}`, boxShadow:'0 8px 32px rgba(22,34,28,0.14)', overflow:'hidden' }}>
          <div style={{ padding:'10px 10px 6px' }}>
            <input
              ref={searchRef}
              type="text"
              placeholder="Søg varemærke…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:`1.5px solid ${PAPER3}`, fontSize:13, fontFamily:FONT, outline:'none', boxSizing:'border-box', color:INK, background:PAPER2 }}
            />
          </div>
          <div style={{ maxHeight:220, overflowY:'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding:'12px 14px', fontSize:13, color:INK3, fontFamily:FONT }}>Ingen resultater</div>
            )}
            {filtered.map(b => (
              <div
                key={b.value}
                onClick={() => { onChange(b.value); setOpen(false); }}
                style={{ padding:'9px 14px', fontSize:14, fontFamily:FONT, cursor:'pointer', color: b.value === value ? PRIMARY : (b.value === '' ? INK3 : INK), fontWeight: b.value === value ? 700 : 400, background: b.value === value ? GREEN_TINT : 'transparent', transition:'background 0.1s' }}
                onMouseEnter={e => { if (b.value !== value) e.currentTarget.style.background = PAPER2; }}
                onMouseLeave={e => { if (b.value !== value) e.currentTarget.style.background = 'transparent'; }}
              >
                {b.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
