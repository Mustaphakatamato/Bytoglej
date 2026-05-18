'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRIMARY } from '@/lib/constants';
import { Spinner } from '@/components/ui';
import { db } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { setLoggedIn } = useApp();
  const [pass, setPass]       = useState('');
  const [pass2, setPass2]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [done, setDone]       = useState(false);
  async function handleSubmit(e) {
    e.preventDefault(); setError(null);
    if (pass.length < 6) { setError('Kodeordet skal være mindst 6 tegn.'); return; }
    if (pass !== pass2)  { setError('Kodeordene er ikke ens.'); return; }
    setLoading(true);
    const { error } = await db.auth.updateUser({ password: pass });
    setLoading(false);
    if (error) { setError('Noget gik galt. Prøv at anmode om et nyt link.'); return; }
    setDone(true);
  }
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 24px', background:'linear-gradient(150deg,#fffcf8 0%,#f0f9f4 100%)' }} className="page-enter">
      <div style={{ width:'100%', maxWidth:440 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:36, justifyContent:'center' }}>
          <div style={{ width:40, height:40, borderRadius:12, background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>♻️</div>
          <span style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:22 }}><span style={{ color:PRIMARY }}>Legetøjs</span>Byt</span>
        </div>
        <div style={{ background:'#fff', borderRadius:24, padding:40, boxShadow:'0 8px 40px rgba(0,0,0,0.08)' }}>
          {done ? (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
              <h1 style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:24, marginBottom:10 }}>Kodeord opdateret!</h1>
              <p style={{ color:'#666', fontSize:14, marginBottom:24 }}>Du er nu logget ind med dit nye kodeord.</p>
              <button onClick={()=>{ setLoggedIn(true); router.push('/dashboard'); }} style={{ background:PRIMARY, color:'#fff', border:'none', borderRadius:22, padding:'12px 28px', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                Gå til dashboard →
              </button>
            </div>
          ) : (
            <>
              <h1 style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:28, marginBottom:8, textAlign:'center' }}>Nyt kodeord</h1>
              <p style={{ color:'#888', fontSize:14, textAlign:'center', marginBottom:28 }}>Vælg et nyt kodeord til jeres konto</p>
              <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {[{label:'Nyt kodeord',val:pass,set:setPass,ph:'Mindst 6 tegn'},{label:'Gentag kodeord',val:pass2,set:setPass2,ph:'Gentag kodeordet'}].map(f=>(
                  <div key={f.label}>
                    <label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>{f.label}</label>
                    <input type="password" value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} required style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #e5e5e5', fontSize:14, fontFamily:"'Nunito Sans',sans-serif", outline:'none' }} />
                  </div>
                ))}
                {error && <div style={{ background:'#FEF2F2', border:'1.5px solid #fca5a5', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#b91c1c' }}>❌ {error}</div>}
                <button type="submit" disabled={loading} style={{ background:loading?'#aaa':PRIMARY, color:'#fff', border:'none', borderRadius:22, padding:'14px', fontSize:15, fontWeight:700, transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  {loading ? <><Spinner/>Gemmer…</> : 'Gem nyt kodeord →'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
