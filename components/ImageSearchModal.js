'use client';
import { useEffect, useRef, useState } from 'react';
import { PRIMARY, PAPER, PAPER2, PAPER3, INK, INK2, INK3, FONT } from '@/lib/constants';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Vinted-stil billedsøgning: upload → beskær → søg.
// Beskæringen sker lokalt (canvas), så kun det relevante udsnit sendes til AI'en.
export default function ImageSearchModal({ onClose, onSearch, searching }) {
  const [src, setSrc] = useState(null);
  const [crop, setCrop] = useState(null);       // {x,y,w,h} i viste pixels
  const [dragOver, setDragOver] = useState(false);
  const imgRef = useRef(null);
  const wrapRef = useRef(null);
  const fileRef = useRef(null);
  const dragRef = useRef(null);
  const dispRef = useRef({ w: 0, h: 0 });
  const cropRef = useRef(null);

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  function pickFile(file) {
    if (!file || !file.type?.startsWith('image/')) return;
    setSrc(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    setCrop(null); cropRef.current = null;
  }

  function onImgLoad() {
    const img = imgRef.current; if (!img) return;
    const w = img.clientWidth, h = img.clientHeight;
    dispRef.current = { w, h };
    const cw = w * 0.85, ch = h * 0.85;
    const c = { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
    cropRef.current = c; setCrop(c);
  }

  function startDrag(e, mode) {
    e.preventDefault();
    dragRef.current = { mode, sx: e.clientX, sy: e.clientY, crop: { ...cropRef.current } };
    const move = ev => {
      const d = dragRef.current; if (!d) return;
      const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy;
      const { w: DW, h: DH } = dispRef.current;
      let { x, y, w, h } = d.crop; const MIN = 40;
      if (d.mode === 'move') {
        x = clamp(x + dx, 0, DW - w); y = clamp(y + dy, 0, DH - h);
      } else {
        if (d.mode.includes('e')) w = clamp(w + dx, MIN, DW - x);
        if (d.mode.includes('s')) h = clamp(h + dy, MIN, DH - y);
        if (d.mode.includes('w')) { const nx = clamp(x + dx, 0, x + w - MIN); w += x - nx; x = nx; }
        if (d.mode.includes('n')) { const ny = clamp(y + dy, 0, y + h - MIN); h += y - ny; y = ny; }
      }
      const nc = { x, y, w, h }; cropRef.current = nc; setCrop(nc);
    };
    const up = () => { dragRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function doSearch() {
    const img = imgRef.current, c = cropRef.current; if (!img || !c || searching) return;
    const sx = img.naturalWidth / dispRef.current.w, sy = img.naturalHeight / dispRef.current.h;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(c.w * sx));
    canvas.height = Math.max(1, Math.round(c.h * sy));
    canvas.getContext('2d').drawImage(img, c.x * sx, c.y * sy, c.w * sx, c.h * sy, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(b => b && onSearch(b), 'image/jpeg', 0.9);
  }

  const handle = (pos) => {
    const s = { position: 'absolute', width: 16, height: 16, background: '#fff', borderRadius: 4, border: `2px solid ${PRIMARY}`, boxSizing: 'border-box' };
    const o = -9;
    if (pos === 'nw') return { ...s, left: o, top: o, cursor: 'nwse-resize' };
    if (pos === 'ne') return { ...s, right: o, top: o, cursor: 'nesw-resize' };
    if (pos === 'sw') return { ...s, left: o, bottom: o, cursor: 'nesw-resize' };
    return { ...s, right: o, bottom: o, cursor: 'nwse-resize' };
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <style>{`@keyframes imgspin{to{transform:rotate(360deg)}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: PAPER, borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${PAPER2}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {src && <button onClick={() => { setSrc(null); setCrop(null); cropRef.current = null; }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: INK2, lineHeight: 1 }}>←</button>}
            <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: INK }}>📷 Søg med billede</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: INK3, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 20 }}>
          {!src ? (
            /* Upload-trin */
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
              style={{ border: `2px dashed ${dragOver ? PRIMARY : PAPER3}`, borderRadius: 14, background: dragOver ? `${PRIMARY}0d` : PAPER2, padding: '48px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
            >
              <div style={{ fontSize: 40 }}>🖼️</div>
              <button onClick={() => fileRef.current?.click()} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, padding: '11px 22px', fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Upload et billede
              </button>
              <span style={{ fontFamily: FONT, fontSize: 13, color: INK3 }}>eller træk et billede hertil</span>
              <input ref={fileRef} type="file" accept="image/*" onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ''; }} style={{ display: 'none' }} />
            </div>
          ) : (
            /* Beskær-trin */
            <>
              <p style={{ fontFamily: FONT, fontSize: 13, color: INK2, margin: '0 0 12px', textAlign: 'center' }}>
                Træk i rammen for at fjerne det AI'en ikke skal søge på.
              </p>
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
                <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                  <img ref={imgRef} src={src} onLoad={onImgLoad} alt="" draggable={false} style={{ maxWidth: '100%', maxHeight: '52vh', display: 'block', userSelect: 'none', touchAction: 'none' }} />
                  {crop && (
                    <div onPointerDown={e => startDrag(e, 'move')} style={{ position: 'absolute', left: crop.x, top: crop.y, width: crop.w, height: crop.h, border: '2px solid #fff', boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)', cursor: 'move', boxSizing: 'border-box', touchAction: 'none' }}>
                      {['nw', 'ne', 'sw', 'se'].map(p => (
                        <div key={p} onPointerDown={e => { e.stopPropagation(); startDrag(e, p); }} style={{ ...handle(p), touchAction: 'none' }} />
                      ))}
                    </div>
                  )}
                  {searching && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                      <div style={{ width: 34, height: 34, border: `3px solid ${PAPER3}`, borderTopColor: PRIMARY, borderRadius: '50%', animation: 'imgspin 0.8s linear infinite' }} />
                      <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: INK2 }}>Søger…</span>
                    </div>
                  )}
                </div>
              </div>
              <button onClick={doSearch} disabled={searching} style={{ marginTop: 16, width: '100%', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, padding: '13px', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: searching ? 'default' : 'pointer', opacity: searching ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {searching ? 'Søger…' : '🔍 Søg med dette udsnit'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
