'use client';
import { useState, useEffect } from 'react';
import { PRIMARY, TYPE_CFG, CONDITION_COLORS } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';

export function Badge({ type }) {
  const c = TYPE_CFG[type] || {};
  return (
    <span style={{ background:c.bg, color:c.color, fontFamily:"'Nunito',sans-serif", fontWeight:700, fontSize:11, padding:'3px 10px', borderRadius:99, display:'inline-flex', alignItems:'center', gap:4, whiteSpace:'nowrap' }}>
      {c.icon} {c.label}
    </span>
  );
}

export function Btn({ children, variant='primary', onClick, style={}, color=PRIMARY, radius=14, disabled=false, type='button' }) {
  const [hov, setHov] = useState(false);
  const base = { border:'none', borderRadius:radius, padding:'11px 24px', fontSize:14, fontWeight:700, fontFamily:"'Nunito',sans-serif", transition:'all 0.15s', display:'inline-flex', alignItems:'center', gap:8, opacity:disabled?0.55:1, cursor:disabled?'not-allowed':'pointer', ...style };
  if (variant==='primary') return <button type={type} onClick={disabled?undefined:onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{...base, background:color, color:'#fff', boxShadow:hov&&!disabled?`0 6px 22px ${color}55`:'none', transform:hov&&!disabled?'translateY(-1px)':'none'}}>{children}</button>;
  if (variant==='outline') return <button type={type} onClick={disabled?undefined:onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{...base, background:hov?'#f5f5f5':'#fff', color:'#333', border:'1.5px solid #ddd'}}>{children}</button>;
  if (variant==='ghost')   return <button type={type} onClick={disabled?undefined:onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{...base, background:'transparent', color:hov?color:'#666', padding:'8px 14px'}}>{children}</button>;
}

export function Spinner() {
  return <div style={{ width:20, height:20, border:'2.5px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 }} />;
}

export function Modal({ open, onClose, children, title }) {
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [open]);
  const w = useWindowWidth();
  const isMobile = w < 600;
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:isMobile?'flex-end':'center', justifyContent:'center', padding:isMobile?0:20, backdropFilter:'blur(6px)', animation:'fadeIn 0.2s ease' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:isMobile?'20px 20px 0 0':'24px', padding:isMobile?'24px 20px 32px':'36px', width:'100%', maxWidth:isMobile?'100%':500, boxShadow:'0 28px 70px rgba(0,0,0,0.2)', maxHeight:'92vh', overflowY:'auto', animation:'popIn 0.25s ease' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <h2 style={{ fontFamily:"'Nunito',sans-serif", fontWeight:800, fontSize:22 }}>{title}</h2>
          <button onClick={onClose} style={{ background:'#f2f2f0', border:'none', borderRadius:99, width:34, height:34, fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toast({ msg, type='success', onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, []);
  const icon = type==='success' ? '✅' : type==='error' ? '❌' : 'ℹ️';
  return (
    <div style={{ position:'fixed', bottom:'max(32px, env(safe-area-inset-bottom, 32px))', left:'50%', transform:'translateX(-50%)', background:'#1c1a17', color:'#fff', borderRadius:99, padding:'13px 26px', fontWeight:700, fontSize:14, fontFamily:"'Nunito',sans-serif", zIndex:2000, boxShadow:'0 10px 40px rgba(0,0,0,0.35)', display:'flex', alignItems:'center', gap:10, whiteSpace:'nowrap', animation:'slideUp 0.3s ease', maxWidth:'calc(100vw - 32px)' }}>
      <span style={{ fontSize:18 }}>{icon}</span> {msg}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
      <div className="skeleton" style={{ height:160 }} />
      <div style={{ padding:'14px 16px 18px' }}>
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <div className="skeleton" style={{ width:64, height:22 }} />
          <div className="skeleton" style={{ width:48, height:22, marginLeft:'auto' }} />
        </div>
        <div className="skeleton" style={{ height:18, marginBottom:8 }} />
        <div className="skeleton" style={{ height:13, width:'55%', marginBottom:14 }} />
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <div className="skeleton" style={{ width:52, height:18 }} />
          <div className="skeleton" style={{ width:68, height:18 }} />
        </div>
      </div>
    </div>
  );
}

export function InfoRow({ icon, label, value, link }) {
  return (
    <div style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:7 }}>
      <span style={{ fontSize:14, lineHeight:'20px', flexShrink:0 }}>{icon}</span>
      <div style={{ minWidth:0 }}>
        <span style={{ fontSize:11, color:'#aaa', display:'block' }}>{label}</span>
        {link
          ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize:13, fontWeight:600, color:'#2563eb', wordBreak:'break-all', textDecoration:'none' }}>{value}</a>
          : <span style={{ fontSize:13, fontWeight:600, color:'#333', wordBreak:'break-all' }}>{value}</span>}
      </div>
    </div>
  );
}
