'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PRIMARY, GREEN_TINT, GREEN_SOFT, GREEN_DEEP, PAPER, PAPER2, PAPER3, INK, INK2, INK3 } from '@/lib/constants';
import { Btn, Spinner } from '@/components/ui';
import { db } from '@/lib/supabase';
import { useApp } from '@/providers/AppProvider';
import { geocodeAddress, useDebounce } from '@/lib/hooks';
import { LogoLockup } from '@/components/Logo';

const FONT = "'Sora', sans-serif";

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

  // Live CVR search
  const [cvrQuery, setCvrQuery]       = useState('');
  const [liveSuggestions, setLiveSuggestions] = useState([]);
  const [liveSearching, setLiveSearching]     = useState(false);
  const [showDrop, setShowDrop]               = useState(false);
  const dropRef = useRef(null);
  const debouncedQuery = useDebounce(cvrQuery, 380);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDrop) return;
    function handler(e) { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDrop]);

  // Fire live search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < 3 || cvrStatus === 'ok') {
      setLiveSuggestions([]);
      setShowDrop(false);
      return;
    }
    let cancelled = false;
    async function doSearch() {
      setLiveSearching(true);
      try {
        const isNum = /^\d+$/.test(debouncedQuery);
        const url = (isNum && debouncedQuery.length === 10)
          ? `https://cvrapi.dk/api?produ=${debouncedQuery}&country=dk`
          : `https://cvrapi.dk/api?search=${encodeURIComponent(debouncedQuery)}&country=dk`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;
        if (!data || data.error) {
          setLiveSuggestions([]);
          setShowDrop(false);
        } else {
          setLiveSuggestions([{
            name:    data.name        || '',
            address: data.address     || '',
            zipcode: data.zipcode     || '',
            city:    data.city        || '',
            cvr:     data.vat ? String(data.vat) : '',
            pnr:     data.pno ? String(data.pno) : null,
            phone:   data.phone       || '',
            website: data.website     || '',
          }]);
          setShowDrop(true);
        }
      } catch {
        if (!cancelled) setLiveSuggestions([]);
      }
      if (!cancelled) setLiveSearching(false);
    }
    doSearch();
    return () => { cancelled = true; };
  }, [debouncedQuery, cvrStatus]);

  function selectSuggestion(s) {
    const finalCvr = s.pnr || s.cvr;
    setCvr(finalCvr);
    setCvrQuery(finalCvr);
    setCvrStatus('ok');
    setCvrData({ name: s.name, address: s.address, zipcode: s.zipcode, city: s.city, phone: s.phone, website: s.website, kommune: '' });
    setForm(f => ({ ...f, address: s.address, zipcode: s.zipcode, city: s.city, inst_phone: s.phone, website: s.website }));
    setShowDrop(false);
    setLiveSuggestions([]);
  }

  function resetCvr() {
    setCvr(''); setCvrQuery(''); setCvrStatus(null); setCvrData(null);
    setLiveSuggestions([]); setShowDrop(false);
  }
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
              <div>
                <label style={{display:'block',fontSize:13,fontWeight:700,marginBottom:5,fontFamily:FONT}}>
                  Søg på institutionsnavn, CVR- eller P-nummer
                </label>

                {/* Search input + dropdown wrapper */}
                <div ref={dropRef} style={{position:'relative'}}>
                  <div style={{
                    display:'flex',alignItems:'center',gap:10,
                    padding:'10px 16px',
                    borderRadius: showDrop && liveSuggestions.length ? '14px 14px 0 0' : 14,
                    border:`1.5px solid ${cvrStatus==='ok' ? PRIMARY : showDrop ? PRIMARY : PAPER3}`,
                    background: cvrStatus==='ok' ? GREEN_TINT : PAPER2,
                    transition:'border-color 0.15s',
                  }}>
                    {/* Search icon or spinner */}
                    {liveSearching
                      ? <div style={{width:16,height:16,border:`2px solid ${PRIMARY}44`,borderTopColor:PRIMARY,borderRadius:'50%',animation:'spin 0.7s linear infinite',flexShrink:0}} />
                      : cvrStatus==='ok'
                        ? <div style={{width:16,height:16,borderRadius:'50%',background:PRIMARY,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        : <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{flexShrink:0,opacity:0.4}}>
                            <circle cx="6.5" cy="6.5" r="5.5" stroke={INK} strokeWidth="1.5"/>
                            <path d="M11 11L14 14" stroke={INK} strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                    }
                    <input
                      value={cvrQuery}
                      onChange={e => {
                        const v = e.target.value;
                        setCvrQuery(v);
                        // Reset if user edits after having selected
                        if (cvrStatus === 'ok') { setCvrStatus(null); setCvrData(null); setCvr(''); }
                      }}
                      placeholder="Fx 'Regnbuehuset' eller '12345678'"
                      style={{
                        border:'none',background:'transparent',outline:'none',
                        fontSize:14,fontFamily:FONT,flex:1,minWidth:0,
                        color: cvrStatus==='ok' ? PRIMARY : INK,
                        fontWeight: cvrStatus==='ok' ? 700 : 400,
                      }}
                    />
                    {cvrQuery && (
                      <button onClick={resetCvr} style={{border:'none',background:'none',color:INK3,fontSize:13,cursor:'pointer',padding:0,lineHeight:1,flexShrink:0}}>✕</button>
                    )}
                  </div>

                  {/* Live suggestion dropdown */}
                  {showDrop && liveSuggestions.length > 0 && (
                    <div style={{
                      position:'absolute',left:0,right:0,zIndex:200,
                      background:PAPER,
                      border:`1.5px solid ${PRIMARY}`,
                      borderTop:'none',
                      borderRadius:'0 0 14px 14px',
                      overflow:'hidden',
                      boxShadow:'0 8px 24px rgba(22,34,28,0.12)',
                    }}>
                      {liveSuggestions.map((s, i) => (
                        <button key={i} onClick={() => selectSuggestion(s)} style={{
                          display:'block',width:'100%',textAlign:'left',
                          padding:'14px 16px',border:'none',
                          background:'transparent',cursor:'pointer',
                          borderTop: i > 0 ? `1px solid ${PAPER2}` : 'none',
                          transition:'background 0.12s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = GREEN_TINT}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontFamily:FONT,fontWeight:700,fontSize:14,color:INK,marginBottom:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                                {s.name}
                              </div>
                              <div style={{fontSize:12,color:INK3,fontFamily:FONT}}>
                                {[s.address, s.zipcode, s.city].filter(Boolean).join(', ')}
                              </div>
                            </div>
                            {s.cvr && (
                              <span style={{background:GREEN_TINT,color:PRIMARY,borderRadius:99,padding:'3px 10px',fontSize:11,fontWeight:700,fontFamily:FONT,whiteSpace:'nowrap',flexShrink:0}}>
                                CVR {s.cvr}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No results state */}
                  {showDrop && liveSuggestions.length === 0 && !liveSearching && debouncedQuery.length >= 3 && (
                    <div style={{
                      position:'absolute',left:0,right:0,zIndex:200,
                      background:PAPER,border:`1.5px solid ${PAPER3}`,borderTop:'none',
                      borderRadius:'0 0 14px 14px',padding:'14px 16px',
                      fontSize:13,color:INK3,fontFamily:FONT,
                    }}>
                      Ingen institution fundet — prøv et andet navn eller CVR-nummer
                    </div>
                  )}
                </div>

                <div style={{fontSize:12,color:INK3,marginTop:7,fontFamily:FONT}}>
                  Skriv institutionens navn, CVR-nummer (8 cifre) eller P-nummer (10 cifre) for kommunale institutioner.
                </div>
              </div>

              {/* Confirmed institution card */}
              {cvrStatus==='ok' && cvrData && (
                <div>
                  <div style={{background:GREEN_TINT,border:`1.5px solid ${GREEN_SOFT}`,borderRadius:14,padding:18,marginBottom:16,borderLeft:`3px solid ${PRIMARY}`}}>
                    <div style={{fontFamily:FONT,fontWeight:800,fontSize:13,color:PRIMARY,marginBottom:8}}>
                      Fundet i {cvr.length===10?'P-nummer-registret':'CVR-registret'}
                    </div>
                    <div style={{fontFamily:FONT,fontWeight:700,fontSize:15,color:INK,marginBottom:4}}>{cvrData.name}</div>
                    <div style={{fontSize:13,color:INK3,fontFamily:FONT}}>{cvrData.address}, {cvrData.zipcode} {cvrData.city}</div>
                    {cvrData.kommune && <div style={{fontSize:13,color:INK3,marginTop:3,fontFamily:FONT}}>Under: {cvrData.kommune}</div>}
                    {cvrData.phone  && <div style={{fontSize:13,color:INK3,marginTop:3,fontFamily:FONT}}>{cvrData.phone}</div>}
                    {cvrData.website && <div style={{fontSize:13,color:INK3,marginTop:3,fontFamily:FONT}}>{cvrData.website}</div>}
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
