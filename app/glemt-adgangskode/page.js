'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRIMARY } from '@/lib/constants';
import { Spinner } from '@/components/ui';
import { db } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  async function handleSubmit(e) {
    e.preventDefault(); setLoading(true); setError(null);
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '',
    });
    setLoading(false);
    if (error) { setError('Noget gik galt. Prøv igen.'); return; }
    setSent(true);
  }
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 24px', background:'linear-gradient(150deg,#fffcf8 0%,#f0f9f4 100%)' }} className="page-enter">
      <div style={{ width:'100%', maxWidth:440 }}>
        <div onClick={()=>router.push('/')} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', marginBottom:36, justifyContent:'center' }}>
          <div style={{ width:40, height:40, borderRadius:12, background:PRIMARY, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>♻️</div>
          <span style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:22 }}><span style={{ color:PRIMARY }}>Legetøjs</span>Byt</span>
        </div>
        <div style={{ background:'#fff', borderRadius:24, padding:40, boxShadow:'0 8px 40px rgba(0,0,0,0.08)' }}>
          {sent ? (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:48, marginBottom:16 }}>📬</div>
              <h1 style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:24, marginBottom:10 }}>Tjek din indbakke</h1>
              <p style={{ color:'#666', fontSize:14, lineHeight:1.7, marginBottom:24 }}>Vi har sendt et link til <strong>{email}</strong>. Klik på linket for at nulstille dit kodeord. Husk at tjekke spam-mappen.</p>
              <a onClick={()=>router.push('/login')} style={{ color:PRIMARY, fontWeight:700, cursor:'pointer', fontSize:14 }}>← Tilbage til login</a>
            </div>
          ) : (
            <>
              <h1 style={{ fontFamily:"'Nunito',sans-serif", fontWeight:900, fontSize:28, marginBottom:8, textAlign:'center' }}>Glemt kodeord?</h1>
              <p style={{ color:'#888', fontSize:14, textAlign:'center', marginBottom:28 }}>Indtast jeres e-mail, så sender vi et nulstillingslink</p>
              <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>E-mail</label>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="navn@institution.dk" required style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #e5e5e5', fontSize:14, fontFamily:"'Nunito Sans',sans-serif", outline:'none' }} />
                </div>
                {error && <div style={{ background:'#FEF2F2', border:'1.5px solid #fca5a5', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#b91c1c' }}>❌ {error}</div>}
                <button type="submit" disabled={loading} style={{ background:loading?'#aaa':PRIMARY, color:'#fff', border:'none', borderRadius:22, padding:'14px', fontSize:15, fontWeight:700, transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  {loading ? <><Spinner/>Sender…</> : 'Send nulstillingslink →'}
                </button>
              </form>
              <div style={{ textAlign:'center', marginTop:20, fontSize:13 }}>
                <a onClick={()=>router.push('/login')} style={{ color:'#888', cursor:'pointer' }}>← Tilbage til login</a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
