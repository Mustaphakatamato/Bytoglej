'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRIMARY } from '@/lib/constants';
import { Spinner } from '@/components/ui';
import { db } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { LogoLockup } from '@/components/Logo';

export default function LoginPage() {
  const router = useRouter();
  const { setLoggedIn } = useApp();
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  async function handleSubmit(e) {
    e.preventDefault(); setLoading(true); setError(null);
    const { error } = await db.auth.signInWithPassword({ email, password: pass });
    setLoading(false);
    if (error) { setError('Forkert e-mail eller kodeord'); return; }
    setLoggedIn(true); router.push('/dashboard');
  }
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 24px', background:'var(--paper)' }} className="page-enter">
      <div style={{ width:'100%', maxWidth:440 }}>
        <div onClick={()=>router.push('/')} style={{ cursor:'pointer', marginBottom:36, display:'flex', justifyContent:'center' }}><LogoLockup markSize={40} textSize={20} /></div>
        <div style={{ background:'var(--paper)', borderRadius:24, padding:40, boxShadow:'0 8px 40px rgba(0,0,0,0.08)' }}>
          <h1 style={{ fontFamily:"'Sora',sans-serif", fontWeight:900, fontSize:28, marginBottom:8, textAlign:'center' }}>Velkommen tilbage</h1>
          <p style={{ color:'#888', fontSize:14, textAlign:'center', marginBottom:28 }}>Log ind med jeres institutions-konto</p>
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[{label:'E-mail',val:email,set:setEmail,type:'email',ph:'navn@institution.dk'},{label:'Kodeord',val:pass,set:setPass,type:'password',ph:'••••••••'}].map(f=>(
              <div key={f.label}>
                <label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>{f.label}</label>
                <input type={f.type} value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #e5e5e5', fontSize:14, fontFamily:"'Nunito Sans',sans-serif", outline:'none' }} />
              </div>
            ))}
            {error && <div style={{ background:'#FEF2F2', border:'1.5px solid #fca5a5', borderRadius:10, padding:'12px 16px', fontSize:13, color:'#b91c1c' }}>❌ {error}</div>}
            <button type="submit" disabled={loading} style={{ background:loading?'#aaa':PRIMARY, color:'#fff', border:'none', borderRadius:22, padding:'14px', fontSize:15, fontWeight:700, transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {loading ? <><Spinner/>Logger ind…</> : 'Log ind →'}
            </button>
          </form>
          <div style={{ textAlign:'center', marginTop:16, fontSize:13 }}>
            <a onClick={()=>router.push('/glemt-adgangskode')} style={{ color:PRIMARY, fontWeight:600, cursor:'pointer' }}>Glemt kodeord?</a>
          </div>
          <div style={{ textAlign:'center', marginTop:10, fontSize:13, color:'#888' }}>Ikke tilmeldt? <a onClick={()=>router.push('/signup')} style={{ color:PRIMARY, fontWeight:700, cursor:'pointer' }}>Opret institution</a></div>
        </div>
      </div>
    </div>
  );
}
