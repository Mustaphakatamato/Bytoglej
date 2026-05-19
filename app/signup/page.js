'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRIMARY } from '@/lib/constants';
import { Btn, Spinner } from '@/components/ui';
import { db } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { geocodeAddress } from '@/lib/hooks';
import { LogoLockup } from '@/components/Logo';

function SField({label, hint, children}) {
  return (
    <div>
      <label style={{display:'block',fontSize:13,fontWeight:700,marginBottom:5}}>
        {label}{hint&&<span style={{fontWeight:400,color:'#aaa',marginLeft:6}}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}
function SInput({value, onChange, type='text', placeholder, ...rest}) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{width:'100%',padding:'11px 14px',borderRadius:12,border:'1.5px solid #e5e5e5',fontSize:14,fontFamily:"'Nunito Sans',sans-serif",outline:'none'}} {...rest} />
  );
}
function SChoiceGroup({value, onChange, options, primary}) {
  return (
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      {options.map(o=>(
        <button key={o} type="button" onClick={()=>onChange(o)}
          style={{padding:'9px 16px',borderRadius:20,border:`2px solid ${value===o?primary:'#e5e5e5'}`,background:value===o?primary:'#fff',color:value===o?'#fff':'#444',fontSize:13,fontWeight:600,cursor:'pointer',transition:'all 0.15s'}}>
          {o}
        </button>
      ))}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const { setLoggedIn, showToast } = useApp();
  const [step, setStep]           = useState(1);
  const [cvr, setCvr]             = useState('');
  const [cvrStatus, setCvrStatus] = useState(null);
  const [cvrData, setCvrData]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [authError, setAuthError] = useState(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [form, setForm] = useState({
    inst_type:'', ownership:'', address:'', zipcode:'', city:'',
    children_count:'', inst_phone:'', website:'',
    leader_name:'', leader_phone:'', leader_email:'',
    contact_name:'', email:'', pass:''
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  async function checkCvr() {
    if (cvr.length!==8 && cvr.length!==10) return;
    setCvrStatus('checking');
    try {
      const url = cvr.length===10
        ? `https://cvrapi.dk/api?produ=${cvr}&country=dk`
        : `https://cvrapi.dk/api?search=${cvr}&country=dk`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data || data.error) throw new Error('ikke fundet');

      let kommune = '';
      if (cvr.length===10 && data.cvr) {
        try {
          const parentRes = await fetch(`https://cvrapi.dk/api?search=${data.cvr}&country=dk`);
          const parentData = await parentRes.json();
          if (parentData && !parentData.error) kommune = parentData.name;
        } catch {}
      }

      setCvrStatus('ok');
      const cd = { name:data.name, address:data.address||'', zipcode:data.zipcode||'', city:data.city||'', type:data.company_type||'Institution', phone:data.phone||'', website:data.website||'', kommune };
      setCvrData(cd);
      setForm(f=>({
        ...f,
        address: cd.address, zipcode: cd.zipcode, city: cd.city, inst_phone: cd.phone, website: cd.website,
        ...(cvr.length===10 ? { ownership:'Offentlig' } : {})
      }));
    } catch { setCvrStatus('err'); }
  }

  function validateStep2() {
    if (!form.inst_type) return 'Vælg institutionstype';
    if (!form.ownership) return 'Vælg driftsform';
    if (!form.address.trim()) return 'Udfyld adresse';
    if (!form.city.trim()) return 'Udfyld by';
    return null;
  }
  function validateStep3() {
    if (!form.leader_name.trim()) return 'Udfyld institutionslederens navn';
    if (!form.leader_phone.trim()) return 'Udfyld telefonnummer';
    if (!form.leader_email.trim() || !form.leader_email.includes('@')) return 'Udfyld gyldig e-mail';
    return null;
  }
  function validateStep4() {
    if (!form.contact_name.trim()) return 'Udfyld dit navn';
    if (!form.email.trim() || !form.email.includes('@')) return 'Udfyld gyldig e-mail';
    if (form.pass.length < 6) return 'Kodeord skal være mindst 6 tegn';
    return null;
  }

  async function handleCreate() {
    const err = validateStep4();
    if (err) { setAuthError(err); return; }
    setSaving(true); setAuthError(null);
    const { data, error } = await db.auth.signUp({
      email: form.email, password: form.pass,
      options: { data: { full_name: form.contact_name } }
    });
    if (error) { setAuthError(error.message); setSaving(false); return; }
    await db.from('institutions').insert({
      cvr: cvr.length===8 ? cvr : null,
      pnr: cvr.length===10 ? cvr : null,
      name: cvrData.name,
      kommune: cvrData.kommune || null,
      institution_type: form.inst_type,
      ownership_type: form.ownership,
      address: form.address, zipcode: form.zipcode, city: form.city,
      children_count: Number(form.children_count)||null,
      phone: form.inst_phone||null, website: form.website||null,
      leader_name: form.leader_name, leader_phone: form.leader_phone, leader_email: form.leader_email,
      contact_name: form.contact_name, email: form.email.toLowerCase()
    });
    geocodeAddress(form.address, form.zipcode, form.city).then(coords => {
      if (coords) db.from('institutions').update({ latitude: coords.lat, longitude: coords.lon }).eq('email', form.email.toLowerCase());
    });
    setSaving(false);
    if (data.user && !data.session) { setNeedsConfirm(true); setStep(5); }
    else { setLoggedIn(true); router.push('/dashboard'); showToast('Velkommen til byt&leg! 🎉'); }
  }

  const steps = ['CVR / P-nr','Om institutionen','Leder & kontakt','Opret konto'];
  const stepTitles = ['Verificér institution','Om institutionen','Institutionsleder','Opret konto'];
  const stepSubs   = ['Vi slår institutionen op via CVR- eller P-nummer-registret','Fortæl os lidt mere om jer','Hvem er den daglige leder?','Vælg login til platformen'];

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'80px 24px 40px',background:'var(--paper)'}} className="page-enter">
      <div style={{width:'100%',maxWidth:560}}>
        <div onClick={()=>router.push('/')} style={{cursor:'pointer',marginBottom:28,display:'flex',justifyContent:'center'}}><LogoLockup markSize={40} textSize={20} /></div>

        {step<=4 && (
          <div style={{display:'flex',alignItems:'center',marginBottom:28,gap:0}}>
            {steps.map((s,i)=>{
              const done = step>i+1, active = step===i+1;
              return (
                <div key={i} style={{display:'contents'}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',flex:1,minWidth:0}}>
                    <div style={{width:32,height:32,borderRadius:'50%',background:done?PRIMARY:active?PRIMARY:'#e5e5e5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:done||active?'#fff':'#aaa',transition:'all 0.2s',boxShadow:active?`0 0 0 4px ${PRIMARY}33`:'none'}}>
                      {done?'✓':i+1}
                    </div>
                    <div style={{fontSize:11,fontWeight:600,color:active?PRIMARY:done?PRIMARY:'#bbb',marginTop:4,textAlign:'center',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:80}}>{s}</div>
                  </div>
                  {i<steps.length-1 && <div style={{flex:2,height:2,background:step>i+1?PRIMARY:'#e5e5e5',transition:'all 0.3s',marginBottom:20}}/>}
                </div>
              );
            })}
          </div>
        )}

        <div style={{background:'var(--paper)',borderRadius:24,padding:40,boxShadow:'0 8px 40px rgba(0,0,0,0.08)'}}>
          {step<=4 && (
            <div style={{marginBottom:28}}>
              <h2 style={{fontFamily:"'Sora',sans-serif",fontWeight:900,fontSize:24,marginBottom:4}}>{stepTitles[step-1]}</h2>
              <p style={{color:'#888',fontSize:14}}>{stepSubs[step-1]}</p>
            </div>
          )}

          {step===1 && (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <SField label="CVR-nummer (8 cifre) eller P-nummer (10 cifre)">
                <div style={{display:'flex',gap:10}}>
                  <input value={cvr} onChange={e=>setCvr(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="CVR: 12345678 / P-nr: 1234567890" maxLength={10}
                    onKeyDown={e=>e.key==='Enter'&&checkCvr()}
                    style={{flex:1,padding:'11px 14px',borderRadius:12,border:`1.5px solid ${cvrStatus==='err'?'#ef4444':cvrStatus==='ok'?PRIMARY:'#e5e5e5'}`,fontSize:15,letterSpacing:2,fontWeight:700,outline:'none'}} />
                  <Btn variant="primary" color={PRIMARY} radius={22} onClick={checkCvr} disabled={(cvr.length!==8&&cvr.length!==10)||cvrStatus==='checking'}>
                    {cvrStatus==='checking'?<><Spinner/>Tjekker…</>:'Slå op'}
                  </Btn>
                </div>
                <div style={{fontSize:12,color:'#888',marginTop:6}}>Offentlige institutioner under kommunen bruger P-nummer (10 cifre). Private institutioner bruger CVR-nummer (8 cifre).</div>
              </SField>
              {cvrStatus==='err' && <div style={{background:'#FEF2F2',border:'1.5px solid #fca5a5',borderRadius:10,padding:'12px 16px',fontSize:13,color:'#b91c1c'}}>❌ Nummeret ikke fundet i registret. Tjek at du har indtastet CVR-nummer (8 cifre) eller P-nummer (10 cifre) korrekt.</div>}
              {cvrStatus==='ok' && cvrData && (
                <div>
                  <div style={{background:'#E8F5EE',border:'1.5px solid #a7d7b8',borderRadius:14,padding:18,marginBottom:20}}>
                    <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                      <div style={{fontSize:28,lineHeight:1}}>✅</div>
                      <div>
                        <div style={{fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:14,color:'#1a5c38',marginBottom:6}}>Fundet i {cvr.length===10?'P-nummer-registret':'CVR-registret'}</div>
                        <div style={{fontWeight:700,fontSize:15}}>{cvrData.name}</div>
                        <div style={{fontSize:13,color:'#555',marginTop:3}}>{cvrData.address}, {cvrData.zipcode} {cvrData.city}</div>
                        {cvrData.kommune && <div style={{fontSize:13,color:'#555',marginTop:2}}>🏛️ Under: {cvrData.kommune}</div>}
                        {cvrData.phone && <div style={{fontSize:13,color:'#555',marginTop:2}}>📞 {cvrData.phone}</div>}
                        {cvrData.website && <div style={{fontSize:13,color:'#555',marginTop:2}}>🌐 {cvrData.website}</div>}
                      </div>
                    </div>
                  </div>
                  <Btn variant="primary" color={PRIMARY} radius={22} onClick={()=>setStep(2)} style={{justifyContent:'center',width:'100%',padding:'13px',fontSize:15}}>Fortsæt →</Btn>
                </div>
              )}
            </div>
          )}

          {step===2 && (
            <div style={{display:'flex',flexDirection:'column',gap:18}}>
              <SField label="Institutionstype">
                <SChoiceGroup value={form.inst_type} onChange={v=>set('inst_type',v)} primary={PRIMARY} options={['Vuggestue','Børnehave','Integreret institution','SFO / KSFO','Andet']} />
              </SField>
              <SField label="Driftsform">
                <SChoiceGroup value={form.ownership} onChange={v=>set('ownership',v)} primary={PRIMARY} options={['Offentlig','Privat','Selvejende']} />
              </SField>
              <div style={{display:'grid',gridTemplateColumns:'1fr 120px',gap:12}}>
                <SField label="Adresse"><SInput value={form.address} onChange={e=>set('address',e.target.value)} placeholder="Vejnavn og husnummer" /></SField>
                <SField label="Postnr."><SInput value={form.zipcode} onChange={e=>set('zipcode',e.target.value)} placeholder="1234" /></SField>
              </div>
              <SField label="By"><SInput value={form.city} onChange={e=>set('city',e.target.value)} placeholder="Fx København" /></SField>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <SField label="Institutionens telefon"><SInput value={form.inst_phone} onChange={e=>set('inst_phone',e.target.value)} placeholder="+45 12 34 56 78" /></SField>
                <SField label="Antal indskrevne børn"><SInput value={form.children_count} onChange={e=>set('children_count',e.target.value)} type="number" placeholder="Fx 60" /></SField>
              </div>
              <SField label="Hjemmeside" hint="(valgfri)"><SInput value={form.website} onChange={e=>set('website',e.target.value)} placeholder="https://min-institution.dk" /></SField>
              {authError && <div style={{background:'#FEF2F2',border:'1.5px solid #fca5a5',borderRadius:10,padding:'12px 16px',fontSize:13,color:'#b91c1c'}}>❌ {authError}</div>}
              <div style={{display:'flex',gap:10,marginTop:4}}>
                <Btn variant="outline" radius={22} onClick={()=>setStep(1)} style={{padding:'12px 20px',fontSize:14}}>← Tilbage</Btn>
                <Btn variant="primary" color={PRIMARY} radius={22} onClick={()=>{ const e=validateStep2(); if(e){setAuthError(e);}else{setAuthError(null);setStep(3);} }} style={{flex:1,justifyContent:'center',padding:'13px',fontSize:15}}>Fortsæt →</Btn>
              </div>
            </div>
          )}

          {step===3 && (
            <div style={{display:'flex',flexDirection:'column',gap:18}}>
              <div style={{background:'#f8f5f0',borderRadius:12,padding:'12px 16px',fontSize:13,color:'#666'}}>
                ℹ️ Disse oplysninger vises ikke offentligt, men bruges ved henvendelse om opslag.
              </div>
              <SField label="Institutionslederens fulde navn"><SInput value={form.leader_name} onChange={e=>set('leader_name',e.target.value)} placeholder="Fornavn Efternavn" /></SField>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <SField label="Telefon"><SInput value={form.leader_phone} onChange={e=>set('leader_phone',e.target.value)} placeholder="+45 12 34 56 78" /></SField>
                <SField label="E-mail"><SInput value={form.leader_email} onChange={e=>set('leader_email',e.target.value)} type="email" placeholder="leder@institution.dk" /></SField>
              </div>
              {authError && <div style={{background:'#FEF2F2',border:'1.5px solid #fca5a5',borderRadius:10,padding:'12px 16px',fontSize:13,color:'#b91c1c'}}>❌ {authError}</div>}
              <div style={{display:'flex',gap:10,marginTop:4}}>
                <Btn variant="outline" radius={22} onClick={()=>setStep(2)} style={{padding:'12px 20px',fontSize:14}}>← Tilbage</Btn>
                <Btn variant="primary" color={PRIMARY} radius={22} onClick={()=>{ const e=validateStep3(); if(e){setAuthError(e);}else{setAuthError(null);setStep(4);} }} style={{flex:1,justifyContent:'center',padding:'13px',fontSize:15}}>Fortsæt →</Btn>
              </div>
            </div>
          )}

          {step===4 && (
            <div style={{display:'flex',flexDirection:'column',gap:18}}>
              <div style={{background:'#f8f5f0',borderRadius:12,padding:'12px 16px',fontSize:13,color:'#666'}}>
                ℹ️ Det er disse oplysninger I logger ind med. Det kan være den samme person som lederen, eller en administrator.
              </div>
              <SField label="Dit fulde navn"><SInput value={form.contact_name} onChange={e=>set('contact_name',e.target.value)} placeholder="Fornavn Efternavn" /></SField>
              <SField label="E-mail (bruges til login)"><SInput value={form.email} onChange={e=>set('email',e.target.value)} type="email" placeholder="din@email.dk" /></SField>
              <SField label="Kodeord" hint="(mindst 6 tegn)"><SInput value={form.pass} onChange={e=>set('pass',e.target.value)} type="password" placeholder="••••••••" /></SField>
              {authError && <div style={{background:'#FEF2F2',border:'1.5px solid #fca5a5',borderRadius:10,padding:'12px 16px',fontSize:13,color:'#b91c1c'}}>❌ {authError}</div>}
              <div style={{display:'flex',gap:10,marginTop:4}}>
                <Btn variant="outline" radius={22} onClick={()=>setStep(3)} style={{padding:'12px 20px',fontSize:14}}>← Tilbage</Btn>
                <Btn variant="primary" color={PRIMARY} radius={22} onClick={handleCreate} disabled={saving} style={{flex:1,justifyContent:'center',padding:'13px',fontSize:15}}>
                  {saving?<><Spinner/>Opretter…</>:'Opret institution →'}
                </Btn>
              </div>
            </div>
          )}

          {step===5 && (
            <div style={{textAlign:'center'}}>
              {needsConfirm ? <>
                <div style={{fontSize:72,marginBottom:16}}>📧</div>
                <h2 style={{fontFamily:"'Sora',sans-serif",fontWeight:900,fontSize:26,marginBottom:10}}>Bekræft din e-mail</h2>
                <p style={{color:'#555',fontSize:15,lineHeight:1.65,marginBottom:8}}>Vi har sendt en bekræftelsesmail til</p>
                <p style={{fontWeight:700,fontSize:15,color:PRIMARY,marginBottom:24}}>{form.email}</p>
                <p style={{color:'#888',fontSize:13,lineHeight:1.65,marginBottom:32}}>Klik på linket i mailen for at aktivere kontoen. Tjek evt. spam-mappen.</p>
                <Btn variant="outline" radius={22} onClick={()=>router.push('/login')} style={{justifyContent:'center',padding:'13px',fontSize:14}}>Gå til login →</Btn>
              </> : <>
                <div style={{fontSize:72,marginBottom:16}}>🎉</div>
                <h2 style={{fontFamily:"'Sora',sans-serif",fontWeight:900,fontSize:28,marginBottom:10}}>Velkommen til byt&amp;leg!</h2>
                <p style={{color:'#888',fontSize:15,lineHeight:1.65,marginBottom:32}}>{cvrData?.name} er nu oprettet og verificeret.</p>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <Btn variant="primary" color={PRIMARY} radius={22} onClick={()=>router.push('/dashboard')} style={{justifyContent:'center',padding:'13px',fontSize:14}}>Gå til dashboard →</Btn>
                  <Btn variant="outline" radius={22} onClick={()=>router.push('/opslag')} style={{justifyContent:'center',padding:'13px',fontSize:14}}>Browse opslag</Btn>
                </div>
              </>}
            </div>
          )}
        </div>
        <p style={{textAlign:'center',marginTop:20,fontSize:13,color:'#888'}}>Allerede tilmeldt? <a onClick={()=>router.push('/login')} style={{color:PRIMARY,fontWeight:700,cursor:'pointer'}}>Log ind her</a></p>
      </div>
    </div>
  );
}
