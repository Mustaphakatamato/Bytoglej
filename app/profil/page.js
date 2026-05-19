'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY } from '@/lib/constants';
import { useWindowWidth, geocodeAddress } from '@/lib/hooks';
import { useApp } from '@/providers/AppProvider';
import { Btn, Spinner } from '@/components/ui';

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
