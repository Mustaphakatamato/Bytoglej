'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_DEEP, INK, INK2, INK3, PAPER2, PAPER3, FONT } from '@/lib/constants';
import { useWindowWidth, geocodeAddress } from '@/lib/hooks';
import { useApp } from '@/providers/AppProvider';
import { Btn, Spinner } from '@/components/ui';
const INP = { width:'100%', padding:'11px 14px', borderRadius:12, border:'1.5px solid #e5e5e5', fontSize:14, fontFamily:"'Nunito Sans',sans-serif", outline:'none', boxSizing:'border-box' };

const PW_RULES = [
  { id:'len',   label:'Mindst 8 tegn',              test: p => p.length >= 8 },
  { id:'upper', label:'Mindst ét stort bogstav',     test: p => /[A-Z]/.test(p) },
  { id:'lower', label:'Mindst ét lille bogstav',     test: p => /[a-z]/.test(p) },
  { id:'num',   label:'Mindst ét tal',               test: p => /[0-9]/.test(p) },
  { id:'spec',  label:'Mindst ét specialtegn (!@#…)',test: p => /[^A-Za-z0-9]/.test(p) },
];

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

function Modal({ title, icon, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:'32px 28px', maxWidth:440, width:'100%', boxShadow:'0 8px 40px rgba(0,0,0,0.18)', position:'relative' }} onClick={e=>e.stopPropagation()}>
        <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:'#f5f4f2', border:'none', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:16, color:INK3 }}>✕</button>
        <div style={{ fontSize:32, marginBottom:12, textAlign:'center' }}>{icon}</div>
        <h2 style={{ fontFamily:FONT, fontWeight:800, fontSize:20, color:INK, letterSpacing:'-0.03em', marginBottom:20, textAlign:'center' }}>{title}</h2>
        {children}
      </div>
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
    institution_type:      institution?.institution_type      || '',
    ownership_type:        institution?.ownership_type        || '',
    address:               institution?.address               || '',
    zipcode:               institution?.zipcode               || '',
    city:                  institution?.city                  || '',
    children_count:        institution?.children_count        || '',
    phone:                 institution?.phone                 || '',
    website:               institution?.website               || '',
    leader_name:           institution?.leader_name           || '',
    leader_phone:          institution?.leader_phone          || '',
    leader_email:          institution?.leader_email          || '',
    contact_name:          institution?.contact_name          || '',
    bank_reg_nr:           institution?.bank_reg_nr           || '',
    bank_account_nr:       institution?.bank_account_nr       || '',
  });
  const [saving, setSaving] = useState(false);

  const DEFAULT_TIERS = [
    { min_items: 2, percent: 5 },
    { min_items: 3, percent: 10 },
    { min_items: 5, percent: 20 },
  ];
  const [bundleEnabled, setBundleEnabled] = useState(institution?.bundle_discount_enabled ?? false);
  const [bundleTiers, setBundleTiers] = useState(institution?.bundle_discount_tiers ?? DEFAULT_TIERS);
  const [bundleSaving, setBundleSaving] = useState(false);

  useEffect(() => {
    if (!institution) return;
    setForm({
      institution_type:      institution.institution_type      || '',
      ownership_type:        institution.ownership_type        || '',
      address:               institution.address               || '',
      zipcode:               institution.zipcode               || '',
      city:                  institution.city                  || '',
      children_count:        institution.children_count        || '',
      phone:                 institution.phone                 || '',
      website:               institution.website               || '',
      leader_name:           institution.leader_name           || '',
      leader_phone:          institution.leader_phone          || '',
      leader_email:          institution.leader_email          || '',
      contact_name:          institution.contact_name          || '',
      bank_reg_nr:           institution.bank_reg_nr           || '',
      bank_account_nr:       institution.bank_account_nr       || '',
    });
    setBundleEnabled(institution.bundle_discount_enabled ?? false);
    setBundleTiers(institution.bundle_discount_tiers ?? DEFAULT_TIERS);
  }, [institution?.id]);

  // Modals
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPwModal, setShowPwModal]       = useState(false);

  // Email modal state
  const [newEmail, setNewEmail]     = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg]     = useState(null);

  // Password modal state
  const [pwForm, setPwForm]   = useState({ current:'', next:'', confirm:'' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg]     = useState(null);

  function onInstChange(updated) {
    if (adminInst) setAdminInst(updated);
    else setInstitution(updated);
  }

  async function handleSave() {
    if (!institution) { showToast('Ingen institution fundet', 'error'); return; }
    setSaving(true);
    const { error } = await db.from('institutions').update({
      institution_type:     form.institution_type,
      ownership_type:       form.ownership_type,
      address:              form.address,
      zipcode:              form.zipcode,
      city:                 form.city,
      children_count:       Number(form.children_count) || null,
      phone:                form.phone || null,
      website:              form.website || null,
      leader_name:          form.leader_name,
      leader_phone:         form.leader_phone,
      leader_email:         form.leader_email,
      contact_name:         form.contact_name,
      bank_reg_nr:          form.bank_reg_nr || null,
      bank_account_nr:      form.bank_account_nr || null,
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
    router.push('/profil');
  }

  async function handleBundleSave() {
    if (!institution) return;
    setBundleSaving(true);
    const { error } = await db.from('institutions').update({
      bundle_discount_enabled: bundleEnabled,
      bundle_discount_tiers: bundleTiers,
    }).eq('email', institution.email);
    setBundleSaving(false);
    if (error) { showToast('Noget gik galt', 'error'); return; }
    onInstChange({ ...institution, bundle_discount_enabled: bundleEnabled, bundle_discount_tiers: bundleTiers });
    showToast('Bundlerabatter gemt ✓');
  }

  async function handleEmailChange() {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setEmailMsg({ ok:false, text:'Indtast en gyldig e-mailadresse.' }); return;
    }
    if (trimmed === institution?.email?.toLowerCase()) {
      setEmailMsg({ ok:false, text:'Det er allerede din nuværende e-mail.' }); return;
    }
    setEmailSaving(true);
    setEmailMsg(null);
    // Check if email already exists in institutions
    const { data: existing } = await db.from('institutions').select('id').eq('email', trimmed).maybeSingle();
    if (existing) {
      setEmailSaving(false);
      setEmailMsg({ ok:false, text:'Denne e-mailadresse er allerede tilknyttet en konto.' }); return;
    }
    const { error } = await db.auth.updateUser({ email: trimmed });
    setEmailSaving(false);
    if (error) { setEmailMsg({ ok:false, text: error.message }); return; }
    setEmailMsg({ ok:true, text:`En bekræftelsesmail er sendt til ${trimmed}. Følg linket for at gennemføre skiftet.` });
    setNewEmail('');
  }

  async function handlePasswordChange() {
    if (!pwForm.current) { setPwMsg({ ok:false, text:'Indtast dit nuværende kodeord.' }); return; }
    const failed = PW_RULES.filter(r => !r.test(pwForm.next));
    if (failed.length) { setPwMsg({ ok:false, text:`Kodeordet opfylder ikke kravene: ${failed.map(r=>r.label.toLowerCase()).join(', ')}.` }); return; }
    if (pwForm.next !== pwForm.confirm) { setPwMsg({ ok:false, text:'De to kodeord stemmer ikke overens.' }); return; }
    setPwSaving(true);
    setPwMsg(null);
    const { data: { user } } = await db.auth.getUser();
    const { error: signInErr } = await db.auth.signInWithPassword({ email: user.email, password: pwForm.current });
    if (signInErr) { setPwSaving(false); setPwMsg({ ok:false, text:'Nuværende kodeord er forkert.' }); return; }
    const { error } = await db.auth.updateUser({ password: pwForm.next });
    setPwSaving(false);
    if (error) { setPwMsg({ ok:false, text: error.message }); return; }
    setPwMsg({ ok:true, text:'Kodeord opdateret.' });
    setPwForm({ current:'', next:'', confirm:'' });
  }

  const inp = (val, key, ph, type='text') => (
    <input type={type} value={val} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph} style={INP} />
  );

  const pwRulesMet = PW_RULES.filter(r => r.test(pwForm.next));

  return (
    <div style={{ minHeight:'100vh', paddingTop:80, background:'#f8f5f0' }} className="page-enter">
      <div style={{ maxWidth:760, margin:'0 auto', padding:isMobile?'24px 16px':'36px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:28 }}>
          <button onClick={()=>router.push('/profil')} style={{ background:'#fff', border:'1.5px solid #e5e5e5', borderRadius:12, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>← Tilbage</button>
          <h1 style={{ fontFamily:FONT, fontWeight:900, fontSize:isMobile?22:26, margin:0 }}>Rediger institutionsprofil</h1>
        </div>

        <div style={{ background:'#fff', borderRadius:22, padding:isMobile?20:32, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', display:'flex', flexDirection:'column', gap:24 }}>

          {/* CVR info */}
          <div style={{ background:'#f0f9f4', border:'1.5px solid #c6e8d4', borderRadius:14, padding:'14px 18px' }}>
            <div style={{ fontSize:12, color:'#5a9a74', fontWeight:700, marginBottom:4 }}>Fra CVR-registret (kan ikke ændres)</div>
            <div style={{ fontWeight:800, fontSize:16 }}>{institution?.name}</div>
            <div style={{ fontSize:13, color:'#888' }}>{institution?.pnr ? `P-nummer: ${institution.pnr}` : `CVR: ${institution?.cvr}`}</div>
            {institution?.kommune && <div style={{ fontSize:13, color:'#888', marginTop:2 }}>🏛️ Under: {institution.kommune}</div>}
          </div>

          {/* Om institutionen */}
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

          {/* Kontaktoplysninger */}
          <div style={{ borderTop:'1px solid #f0eeeb', paddingTop:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:0.8, marginBottom:14 }}>Kontaktoplysninger</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 120px', gap:12 }}>
                <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Adresse</label>{inp(form.address,'address','')}</div>
                <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Postnr.</label>{inp(form.zipcode,'zipcode','')}</div>
              </div>
              <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>By</label>{inp(form.city,'city','')}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Telefon</label><input type="tel" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value.replace(/[^+\d\s]/g,'')}))} placeholder="+45 12 34 56 78" style={INP} /></div>
                <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Hjemmeside</label>{inp(form.website,'website','https://...')}</div>
              </div>
            </div>
          </div>

          {/* Institutionsleder */}
          <div style={{ borderTop:'1px solid #f0eeeb', paddingTop:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:0.8, marginBottom:14 }}>Institutionsleder</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Fulde navn</label>{inp(form.leader_name,'leader_name','Fornavn Efternavn')}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Telefon</label><input type="tel" value={form.leader_phone} onChange={e=>setForm(f=>({...f,leader_phone:e.target.value.replace(/[^+\d\s]/g,'')}))} placeholder="+45 12 34 56 78" style={INP} /></div>
                <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>E-mail</label>{inp(form.leader_email,'leader_email','leder@institution.dk')}</div>
              </div>
            </div>
          </div>

          {/* Kontaktperson */}
          <div style={{ borderTop:'1px solid #f0eeeb', paddingTop:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:0.8, marginBottom:14 }}>Kontaktperson (byt&amp;leg)</div>
            <div><label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Dit fulde navn</label>{inp(form.contact_name,'contact_name','Fornavn Efternavn')}</div>
          </div>

          {/* Bankkonto til udbetaling */}
          <div style={{ borderTop:'1px solid #f0eeeb', paddingTop:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>Bankkonto til udbetaling</div>
            <div style={{ fontSize:13, color:INK3, marginBottom:14, lineHeight:1.5 }}>Bytogleg overfører betaling for solgte varer hertil. Oplysningerne opbevares sikkert og deles ikke med købere.</div>
            <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:12 }}>
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Reg.nr.</label>
                <input value={form.bank_reg_nr} onChange={e=>setForm(f=>({...f,bank_reg_nr:e.target.value.replace(/\D/g,'').slice(0,4)}))} placeholder="1234" maxLength={4} style={INP} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:6 }}>Kontonummer</label>
                <input value={form.bank_account_nr} onChange={e=>setForm(f=>({...f,bank_account_nr:e.target.value.replace(/\D/g,'').slice(0,10)}))} placeholder="12345678" maxLength={10} style={INP} />
              </div>
            </div>
          </div>

          {/* Bundlerabatter */}
          <div style={{ borderTop:'1px solid #f0eeeb', paddingTop:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:0.8, marginBottom:6 }}>Bundlerabatter</div>
            <div style={{ fontSize:13, color:INK3, marginBottom:16, lineHeight:1.5 }}>
              Giv købere en automatisk rabat når de køber flere varer fra dig på samme ordre. Rabatten beregnes af varernes samlede pris.
            </div>

            {/* Toggle */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'#f8f7f5', borderRadius:14, marginBottom:16, border:'1px solid #e8e5e1' }}>
              <div>
                <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK }}>Aktivér bundlerabatter</div>
                <div style={{ fontSize:12, color:INK3, marginTop:2 }}>Vises automatisk i købers kurv</div>
              </div>
              <button
                type="button"
                onClick={() => setBundleEnabled(v => !v)}
                style={{ width:48, height:26, borderRadius:99, border:'none', cursor:'pointer', position:'relative', background: bundleEnabled ? PRIMARY : '#d1d5db', transition:'background 0.2s', flexShrink:0 }}
              >
                <div style={{ position:'absolute', top:3, left: bundleEnabled ? 25 : 3, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
              </button>
            </div>

            {/* Tiers */}
            {bundleEnabled && (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:700, color:INK2 }}>Konfigurer rabatter</div>
                {bundleTiers.map((tier, idx) => (
                  <div key={idx} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'#f8f7f5', borderRadius:12, border:'1px solid #e8e5e1' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, color:INK3, marginBottom:4 }}>Antal varer</div>
                      <select
                        value={tier.min_items}
                        onChange={e => setBundleTiers(ts => ts.map((t, i) => i === idx ? { ...t, min_items: Number(e.target.value) } : t))}
                        style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1.5px solid #e5e5e5', fontSize:14, fontFamily:FONT, background:'#fff', outline:'none' }}
                      >
                        {[2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} varer</option>)}
                      </select>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, color:INK3, marginBottom:4 }}>Rabat</div>
                      <select
                        value={tier.percent}
                        onChange={e => setBundleTiers(ts => ts.map((t, i) => i === idx ? { ...t, percent: Number(e.target.value) } : t))}
                        style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1.5px solid #e5e5e5', fontSize:14, fontFamily:FONT, background:'#fff', outline:'none' }}
                      >
                        {[5,10,15,20,25,30].map(p => <option key={p} value={p}>{p}%</option>)}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBundleTiers(ts => ts.filter((_, i) => i !== idx))}
                      style={{ width:32, height:32, borderRadius:'50%', background:'none', border:'1.5px solid #e5e5e5', color:INK3, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:18 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {bundleTiers.length < 5 && (
                  <button
                    type="button"
                    onClick={() => setBundleTiers(ts => [...ts, { min_items: Math.max(...ts.map(t => t.min_items), 1) + 1, percent: 5 }])}
                    style={{ padding:'9px 16px', borderRadius:99, background:'none', border:`1.5px solid ${PRIMARY}`, color:PRIMARY, fontFamily:FONT, fontWeight:700, fontSize:13, cursor:'pointer', alignSelf:'flex-start' }}
                  >
                    + Tilføj trin
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleBundleSave}
              disabled={bundleSaving}
              style={{ padding:'11px 20px', borderRadius:12, background: bundleSaving ? '#e5e5e5' : PRIMARY, color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, cursor: bundleSaving ? 'default' : 'pointer', opacity: bundleSaving ? 0.7 : 1 }}
            >
              {bundleSaving ? 'Gemmer…' : '✓ Gem bundlerabatter'}
            </button>
          </div>

          {/* Kontosikkerhed */}
          <div style={{ borderTop:'1px solid #f0eeeb', paddingTop:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:0.8, marginBottom:14 }}>Kontosikkerhed</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:PAPER2, borderRadius:14, border:`1px solid ${PAPER3}` }}>
                <div>
                  <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK }}>Login-e-mail</div>
                  <div style={{ fontSize:13, color:INK3, marginTop:2 }}>{institution?.email}</div>
                </div>
                <button onClick={()=>{ setEmailMsg(null); setNewEmail(''); setShowEmailModal(true); }} style={{ padding:'8px 16px', borderRadius:99, background:'#fff', border:`1.5px solid ${PRIMARY}`, color:PRIMARY, fontFamily:FONT, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  Skift e-mail
                </button>
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:PAPER2, borderRadius:14, border:`1px solid ${PAPER3}` }}>
                <div>
                  <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK }}>Adgangskode</div>
                  <div style={{ fontSize:13, color:INK3, marginTop:2 }}>••••••••••••</div>
                </div>
                <button onClick={()=>{ setPwMsg(null); setPwForm({current:'',next:'',confirm:''}); setShowPwModal(true); }} style={{ padding:'8px 16px', borderRadius:99, background:'#fff', border:`1.5px solid ${PRIMARY}`, color:PRIMARY, fontFamily:FONT, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  Skift kodeord
                </button>
              </div>
            </div>
          </div>

          {/* Bottom actions */}
          <div style={{ borderTop:'1px solid #f0eeeb', paddingTop:20, display:'flex', gap:12 }}>
            <button onClick={()=>router.push('/profil')} style={{ flex:1, padding:'13px', borderRadius:14, background:'#f5f4f2', border:'none', fontWeight:700, cursor:'pointer', fontSize:14 }}>Annuller</button>
            <Btn variant="primary" color={PRIMARY} radius={22} onClick={handleSave} disabled={saving} style={{ flex:2, justifyContent:'center', padding:'13px', fontSize:15 }}>
              {saving ? <><Spinner/>Gemmer…</> : '✓ Gem oplysninger'}
            </Btn>
          </div>
        </div>
      </div>

      {/* Email modal */}
      {showEmailModal && (
        <Modal title="Skift login-e-mail" icon="📧" onClose={()=>setShowEmailModal(false)}>
          <p style={{ fontSize:14, color:INK3, lineHeight:1.6, marginBottom:20, textAlign:'center' }}>
            Nuværende: <strong style={{ color:INK }}>{institution?.email}</strong><br/>
            Efter skift sendes en bekræftelsesmail til den nye adresse.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <input
              type="email"
              value={newEmail}
              onChange={e=>{ setNewEmail(e.target.value); setEmailMsg(null); }}
              placeholder="ny@institution.dk"
              style={{ ...INP, fontSize:15 }}
              autoFocus
            />
            {emailMsg && (
              <div style={{ padding:'10px 14px', borderRadius:10, background:emailMsg.ok?'#e8f5ee':'#fff0f0', color:emailMsg.ok?PRIMARY:'#c0392b', fontSize:13, lineHeight:1.5 }}>
                {emailMsg.text}
              </div>
            )}
            {!emailMsg?.ok && (
              <button
                onClick={handleEmailChange}
                disabled={emailSaving || !newEmail}
                style={{ padding:'13px', borderRadius:12, background:PRIMARY, color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:emailSaving||!newEmail?'not-allowed':'pointer', opacity:emailSaving||!newEmail?0.6:1 }}
              >
                {emailSaving ? 'Tjekker…' : 'Send bekræftelse'}
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Password modal */}
      {showPwModal && (
        <Modal title="Skift adgangskode" icon="🔑" onClose={()=>setShowPwModal(false)}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { key:'current', label:'Nuværende kodeord' },
              { key:'next',    label:'Nyt kodeord' },
              { key:'confirm', label:'Gentag nyt kodeord' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label style={{ display:'block', fontSize:13, fontWeight:700, marginBottom:5, color:INK2 }}>{label}</label>
                <input
                  type="password"
                  value={pwForm[key]}
                  onChange={e=>{ setPwForm(f=>({...f,[key]:e.target.value})); setPwMsg(null); }}
                  placeholder="••••••••"
                  style={INP}
                  autoFocus={key==='current'}
                />
              </div>
            ))}

            {/* Password requirements */}
            {pwForm.next && (
              <div style={{ background:'#f8f7f5', borderRadius:10, padding:'12px 14px', display:'flex', flexDirection:'column', gap:6 }}>
                {PW_RULES.map(r => {
                  const met = r.test(pwForm.next);
                  return (
                    <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }}>
                      <span style={{ width:16, height:16, borderRadius:'50%', background:met?PRIMARY:'#e5e5e5', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {met && <svg width="9" height="9" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </span>
                      <span style={{ color:met?PRIMARY:INK3 }}>{r.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {pwMsg && (
              <div style={{ padding:'10px 14px', borderRadius:10, background:pwMsg.ok?'#e8f5ee':'#fff0f0', color:pwMsg.ok?PRIMARY:'#c0392b', fontSize:13, lineHeight:1.5 }}>
                {pwMsg.text}
              </div>
            )}

            {!pwMsg?.ok && (
              <button
                onClick={handlePasswordChange}
                disabled={pwSaving || pwRulesMet.length < PW_RULES.length}
                style={{ padding:'13px', borderRadius:12, background:PRIMARY, color:'#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:14, cursor:pwSaving||pwRulesMet.length<PW_RULES.length?'not-allowed':'pointer', opacity:pwSaving||pwRulesMet.length<PW_RULES.length?0.6:1 }}
              >
                {pwSaving ? 'Gemmer…' : 'Opdatér kodeord'}
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
