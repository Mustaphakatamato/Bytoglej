'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { BRAND_OPTIONS, TOY_BRANDS } from '@/lib/toy-brands';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, PAPER2, PAPER3, INK, INK3, FONT } from '@/lib/constants';

const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Godkendte brugerforeslåede mærker caches på tværs af instanser i samme session.
let approvedCache = null;

export default function BrandPicker({ value, onChange, style, error }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');        // hvad der står i input-feltet
  const [approved, setApproved] = useState(approvedCache || []);
  const ref = useRef(null);
  const inputRef = useRef(null);

  // Hent godkendte mærker (statisk liste + godkendte forslag = den fælles liste).
  useEffect(() => {
    if (approvedCache) return;
    let alive = true;
    db.from('brand_suggestions').select('brand_name').eq('status', 'approved')
      .then(({ data }) => {
        if (!alive || !data) return;
        const names = data.map((r) => r.brand_name).filter(Boolean);
        approvedCache = names;
        setApproved(names);
      });
    return () => { alive = false; };
  }, []);

  // Sammensæt liste: "Intet varemærke" + statiske + godkendte forslag (dedup, sorteret).
  const options = useMemo(() => {
    const seen = new Set(TOY_BRANDS.map(norm));
    const extra = [];
    for (const name of approved) {
      if (!seen.has(norm(name))) { seen.add(norm(name)); extra.push(name); }
    }
    const all = [...TOY_BRANDS, ...extra].sort((a, b) => a.localeCompare(b, 'da'));
    return [{ value: '', label: 'Intet varemærke' }, ...all.map((b) => ({ value: b, label: b }))];
  }, [approved]);

  const isUnselected = value === null || value === undefined;
  const selectedLabel = isUnselected
    ? ''
    : (value === '' ? 'Intet varemærke' : value);

  // Hold input-tekst synkront med valgt værdi når feltet ikke er i fokus.
  useEffect(() => {
    if (!open) setText(selectedLabel);
  }, [selectedLabel, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setText(selectedLabel); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, selectedLabel]);

  const q = norm(text);
  const filtered = options.filter((b) => !q || norm(b.label).includes(q));
  const exactMatch = options.some((b) => b.value !== '' && norm(b.label) === q);
  const showAddCustom = !!text.trim() && !exactMatch;

  function pick(val) {
    onChange(val, { custom: false });
    setText(val === '' ? 'Intet varemærke' : val);
    setOpen(false);
  }

  function addCustom() {
    const name = text.trim();
    if (!name) return;
    onChange(name, { custom: true });
    setText(name);
    setOpen(false);
  }

  // Er den nuværende værdi et selvskrevet mærke (ikke på listen)? → vis lille hint.
  const isCustomValue = !isUnselected && value !== '' &&
    !options.some((b) => b.value !== '' && norm(b.label) === norm(value));

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={text}
          placeholder="Søg eller skriv varemærke…"
          onFocus={() => { setOpen(true); setTimeout(() => inputRef.current?.select(), 0); }}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (showAddCustom) addCustom();
              else if (filtered.length === 1) pick(filtered[0].value);
            } else if (e.key === 'Escape') { setOpen(false); setText(selectedLabel); }
          }}
          style={{ width: '100%', padding: '12px 38px 12px 14px', borderRadius: 12, border: `1.5px solid ${error ? '#FCA5A5' : PAPER3}`, fontSize: 14, outline: 'none', fontFamily: FONT, background: '#fff', color: INK, boxSizing: 'border-box' }}
        />
        <span onClick={() => { setOpen((o) => !o); inputRef.current?.focus(); }} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: INK3, cursor: 'pointer' }}>▾</span>
      </div>

      {isCustomValue && !open && (
        <div style={{ marginTop: 6, fontFamily: FONT, fontSize: 11.5, color: PRIMARY, fontWeight: 600 }}>
          ✦ Nyt mærke — sendes til godkendelse
        </div>
      )}

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 999, background: '#fff', borderRadius: 14, border: `1.5px solid ${PAPER3}`, boxShadow: '0 8px 32px rgba(22,34,28,0.14)', overflow: 'hidden' }}>
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.map((b) => (
              <div
                key={b.value}
                onClick={() => pick(b.value)}
                style={{ padding: '9px 14px', fontSize: 14, fontFamily: FONT, cursor: 'pointer', color: b.value === value ? PRIMARY : (b.value === '' ? INK3 : INK), fontWeight: b.value === value ? 700 : 400, background: b.value === value ? GREEN_TINT : 'transparent', transition: 'background 0.1s' }}
                onMouseEnter={(e) => { if (b.value !== value) e.currentTarget.style.background = PAPER2; }}
                onMouseLeave={(e) => { if (b.value !== value) e.currentTarget.style.background = 'transparent'; }}
              >
                {b.label}
              </div>
            ))}

            {showAddCustom && (
              <div
                onClick={addCustom}
                style={{ padding: '11px 14px', fontSize: 14, fontFamily: FONT, cursor: 'pointer', color: PRIMARY, fontWeight: 700, borderTop: filtered.length ? `1px solid ${PAPER3}` : 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = GREEN_TINT; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span>
                <span>Tilføj “{text.trim()}” som nyt mærke</span>
              </div>
            )}

            {!filtered.length && !showAddCustom && (
              <div style={{ padding: '12px 14px', fontSize: 13, color: INK3, fontFamily: FONT }}>Ingen resultater</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
