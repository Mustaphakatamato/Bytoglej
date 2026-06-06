'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, INK, INK2, INK3, PAPER2, PAPER3 } from '@/lib/constants';
import { useWindowWidth, geocodeAddress } from '@/lib/hooks';
import { useApp } from '@/providers/AppProvider';
import { Btn, Spinner } from '@/components/ui';

const FONT = "'Sora', sans-serif";

function SChoiceGroup({ value, onChange, options, primary }) {
  return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
      {options.map(o => (
        <button key={o} type="button" onClick={()=>onChange(o)}
          style={{ padding:'9px 16px', borderRadius:20, border:`2px solid ${value===o?primary:'#e5e5e5'}`, background:value===o?primary:'#fff', color:value===o?'#fff':'#444', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}>
          {o}
        </button>
      ))}
    </div>
  );
}

export default function ProfilPage() {
  const router = useRouter();
  const { effectiveInstitution, setInstitution, adminInst, setAdminInst, showToast } = useApp();
  const institution = effectiveInstitution;
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  const [form, setForm] = useState({
    institution_type: institution?.institution_type || '',
    ownership_type:   institution?.ownership_type   || '',
    address:          institution?.address          || '',
    zipcode:          institution?.zipcode          || '',
    city:             institution?.city             || '',
    children_count:   institution?.children_count   || '',
    phone:            institution?.phone            || '',
    website:          institution?.website          || '',
    leader_name:      institution?.leader_name      || '',
    leader_phone:     institution?.leader_phone     || '',
    leader_email:     institution?.leader_email     || '',
    contact_name:     institution?.contact_name     || '',
  });
  const [saving, setSaving] = useState(false);

  // Email change
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);

  // Password change
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  async function handleEmailChange() {
    if (!newEmail || !newEmail.includes('@')) { setEmailMsg({ ok: false, text: 'Indtast en gyldig e-mailadresse.' }); return; }
    setEmailSaving(true);
    setEmailMsg(null);
    const { error } = await db.auth.updateUser({ email: newEmail });
    setEmailSaving(false);
    if (error) { setEmailMsg({ ok: false, text: error.message }); return; }
    setEmailMsg({ ok: true, text: `En bekræftelsesmail er sendt til ${newEmail}. Følg linket i mailen for at gennemføre skiftet.` });
    setNewEmail('');
  }

  async function handlePasswordChange() {
    if (!pwForm.current) { setPwMsg({ ok: false, text: 'Indtast dit nuværende kodeord.' }); return; }
    if (pwForm.next.length < 8) { setPwMsg({ ok: false, text: 'Nyt kodeord skal være mindst 8 tegn.' }); return; }
    if (pwForm.next !== pwForm.confirm) { setPwMsg({ ok: false, text: 'De to kodeord stemmer ikke overens.' }); return; }
    setPwSaving(true);
    setPwMsg(null);
    // Verify current password by re-signing in
    const { data: { user } } = await db.auth.getUser();
    const { error: signInErr } = await db.auth.signInWithPassword({ email: user.email, password: pwForm.current });
    if (signInErr) { setPwSaving(false); setPwMsg({ ok: false, text: 'Nuværende kodeord er forkert.' }); return; }
    const { error } = await db.auth.updateUser({ password: pwForm.next });
    setPwSaving(false);
    if (error) { setPwMsg({ ok: false, text: error.message }); return; }
    setPwMsg({ ok: true, text: 'Kodeord opdateret.' });
    setPwForm({ current: '', next: '', confirm: '' });
  }

  function onInstChange(updated) {
    if (adminInst) setAdminInst(updated);
    else setInstitution(updated);
  }

  async function handleSave() {
    if (!institution) { showToast('Ingen institution fundet', 'error'); return; }
    setSaving(true);
    const { error } = await db.from('institutions').update({
      institution_type: form.institution_type,
      ownership_type:   form.ownership_type,
      address:          form.address,
      zipcode:          form.zipcode,
      city:             form.city,
      children_count:   Number(form.children_count) || null,
      phone:            form.phone || null,
      website:          form.website || null,
      leader_name:      form.leader_name,
      leader_phone:     form.leader_phone,
      leader_email:     form.leader_email,
      contact_name:     form.contact_name,
    }).eq('email', institution.email);
    setSaving(false);
    if (error) { showToast('Noget gik galt', 'error'); return; }
    const addrChanged = form.address !== institution.address || form.zipcode !== institution.zipcode || form.city !== institution.city;
    if (addrChanged) {
      geocodeAddress(form.address, form.zipcode, form.city).then(coords => {
        if (coords) db.from('institutions').update({ latitude: coords.lat, longitude: coords.lon }).eq('email', institution.email);
      });
    }
    onInstChange({ ...institution, ...form, children_count: Number(form.children_count) || null });
    showToast('Profil opdateret ✓');
    router.push('/dashboard');
  }

  const inp = (val, key, ph, type='text') => (
    <input type={type} value={val} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}
      style={{ width:'100%', padding:'11px 14px', borderRadius:12, border:'1.5px solid #e5e5e5', fontSize:14, fontFamily:"'Nunito Sans',sans-serif", outline:'none', boxSizing:'border-box' }} />
  );

  return (
    <div style={{ minHeight:'100vh', paddingTop:80, background:'#f8f5f0' }} className="page-enter">
      <div style={{ maxWidth:760, margin:'0 auto', padding:isMobile?'24px 16px':'36px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:28 }}>
          <button onClick={()=>router.push('/dashboard')} style={{ background:'#fff', border:'1.5px solid #e5e5e5', borderRadius:12, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>← Tilbage</button>
          <h1 style={{ fontFamily:"'Sora',sans-serif", fontWeight:900, fontSize:isMobile?22:26, margin:0 }}>Rediger institutionsprofil</h1>
        </div>

        <div style={{ background:'#fff', borderRadius:22, padding:isMobile?20:32, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', display:'flex', flexDirection:'column', gap:24 }}>
          <div style={{ background:'#f0f9f4', border:'1.5px solid #c6e8d4', borderRadius:14, padding:'14px 18px' }}>
            <div style={{ fontSize:12, color:'#5a9a74', fontWeight:700, marginBottom:4 }}>Fra CVR-registret (kan ikke ændres)</div>
            <div style={{ fontWeight:800, fontSize:16 }}>{institution?.name}</div>
            <div style={{ fontSize:13, color:'#888' }}>{institution?.pnr ? `P-nummer: ${institution.pnr}` : `CVR: ${institution?.cvr}`}</div>
            {institution?.kommune && <div style={{ fontSize:13, color:'#888', marginTop:2 }}>🏛️ Under: {institution.kommune}</div>}
          </div>

          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:0.8, marginBottom:14 }}>Om institutionen</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Institutionstype</label>
                <SChoiceGroup value={form.institution_type} onChange={v=>setForm(f=>({...f,institution_type:v}))} primary={PRIMARY} options={['Vuggestue','Børnehave','Integreret institution','SFO / KSFO','Andet']} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Driftsform</label>
                <SChoiceGroup value={form.ownership_type} onChange={v=>setForm(f=>({...f,ownership_type:v}))} primary={PRIMARY} options={['Offentlig','Privat','Selvejende']} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Antal indskrevne børn</label>
                {inp(form.children_count, 'children_count', 'Fx 60', 'number')}
              </div>
            </div>
          </div>

          <div style={{ borderTop:'1px solid #f0eeeb', paddingTop:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:0.8, marginBottom:14 }}>Kontaktoplysninger</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 120px', gap:12 }}>
                <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Adresse</label>{inp(form.address,'address','')}</div>
                <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Postnr.</label>{inp(form.zipcode,'zipcode','')}</div>
              </div>
              <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>By</label>{inp(form.city,'city','')}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Telefon</label>{inp(form.phone,'phone','+45 12 34 56 78')}</div>
                <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Hjemmeside</label>{inp(form.website,'website','https://...')}</div>
              </div>
            </div>
          </div>

          <div style={{ borderTop:'1px solid #f0eeeb', paddingTop:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:0.8, marginBottom:14 }}>Institutionsleder</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Fulde navn</label>{inp(form.leader_name,'leader_name','Fornavn Efternavn')}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Telefon</label>{inp(form.leader_phone,'leader_phone','+45 12 34 56 78')}</div>
                <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>E-mail</label>{inp(form.leader_email,'leader_email','leder@institution.dk')}</div>
              </div>
            </div>
          </div>

          <div style={{ borderTop:'1px solid #f0eeeb', paddingTop:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:0.8, marginBottom:14 }}>Kontaktperson (byt&amp;leg)</div>
            <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Dit fulde navn</label>{inp(form.contact_name,'contact_name','Fornavn Efternavn')}</div>
          </div>

          {/* Email change */}
          <div style={{ borderTop:'1px solid #f0eeeb', paddingTop:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:0.8, marginBottom:14 }}>Skift login-e-mail</div>
            <p style={{ fontSize:13, color:'#888', marginBottom:12, lineHeight:1.55 }}>
              Din nuværende login-e-mail er <strong style={{ color:INK }}>{institution?.email}</strong>. Efter skift sendes en bekræftelsesmail til den nye adresse.
            </p>
            <div style={{ display:'flex', gap:10, alignItems:'flex-start', flexWrap:'wrap' }}>
              <input
                type="email"
                value={newEmail}
                onChange={e=>setNewEmail(e.target.value)}
                placeholder="ny@institution.dk"
                style={{ flex:'1 1 220px', padding:'11px 14px', borderRadius:12, border:'1.5px solid #e5e5e5', fontSize:14, fontFamily:"'Nunito Sans',sans-serif", outline:'none', boxSizing:'border-box' }}
              />
              <button
                onClick={handleEmailChange}
                disabled={emailSaving || !newEmail}
                style={{ padding:'11px 20px', borderRadius:12, background:PRIMARY, color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:13, cursor:emailSaving||!newEmail?'not-allowed':'pointer', opacity:emailSaving||!newEmail?0.6:1, whiteSpace:'nowrap' }}
              >
                {emailSaving ? 'Sender…' : 'Send bekræftelse'}
              </button>
            </div>
            {emailMsg && (
              <div style={{ marginTop:10, padding:'10px 14px', borderRadius:10, background:emailMsg.ok?'#e8f5ee':'#fff0f0', color:emailMsg.ok?'#2A7D4F':'#c0392b', fontSize:13 }}>
                {emailMsg.text}
              </div>
            )}
          </div>

          {/* Password change */}
          <div style={{ borderTop:'1px solid #f0eeeb', paddingTop:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:0.8, marginBottom:14 }}>Skift adgangskode</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { key:'current', label:'Nuværende kodeord', ph:'••••••••' },
                { key:'next',    label:'Nyt kodeord (min. 8 tegn)', ph:'••••••••' },
                { key:'confirm', label:'Gentag nyt kodeord', ph:'••••••••' },
              ].map(({ key, label, ph }) => (
                <div key={key}>
                  <label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>{label}</label>
                  <input
                    type="password"
                    value={pwForm[key]}
                    onChange={e=>setPwForm(f=>({...f,[key]:e.target.value}))}
                    placeholder={ph}
                    style={{ width:'100%', padding:'11px 14px', borderRadius:12, border:'1.5px solid #e5e5e5', fontSize:14, fontFamily:"'Nunito Sans',sans-serif", outline:'none', boxSizing:'border-box' }}
                  />
                </div>
              ))}
              <button
                onClick={handlePasswordChange}
                disabled={pwSaving}
                style={{ alignSelf:'flex-start', padding:'11px 24px', borderRadius:12, background:PRIMARY, color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:13, cursor:pwSaving?'not-allowed':'pointer', opacity:pwSaving?0.6:1 }}
              >
                {pwSaving ? 'Gemmer…' : 'Opdatér kodeord'}
              </button>
            </div>
            {pwMsg && (
              <div style={{ marginTop:10, padding:'10px 14px', borderRadius:10, background:pwMsg.ok?'#e8f5ee':'#fff0f0', color:pwMsg.ok?'#2A7D4F':'#c0392b', fontSize:13 }}>
                {pwMsg.text}
              </div>
            )}
          </div>

          <div style={{ borderTop:'1px solid #f0eeeb', paddingTop:20, display:'flex', gap:12 }}>
            <button onClick={()=>router.push('/dashboard')} style={{ flex:1, padding:'13px', borderRadius:14, background:'#f5f4f2', border:'none', fontWeight:700, cursor:'pointer', fontSize:14 }}>Annuller</button>
            <Btn variant="primary" color={PRIMARY} radius={22} onClick={handleSave} disabled={saving} style={{ flex:2, justifyContent:'center', padding:'13px', fontSize:15 }}>
              {saving ? <><Spinner/>Gemmer…</> : '✓ Gem oplysninger'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
