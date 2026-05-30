'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3 } from '@/lib/constants';
import { EMISSION_FACTORS, METHODOLOGY_VERSION } from '@/lib/co2/emission-factors';
import { Spinner } from '@/components/ui';

const FONT = "'Sora', sans-serif";
const ADMIN_EMAIL = 'mustaphakatamato@gmail.com';

export default function Co2ConfigPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState([]);
  const [versions, setVersions] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [tab, setTab] = useState('factors');
  const [editRow, setEditRow] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [editReason, setEditReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [newVersion, setNewVersion] = useState({ version: '', displacement_rate: '0.6', transport_emission_g_per_km: '170', notes: '', reason: '' });
  const [creatingVersion, setCreatingVersion] = useState(false);

  useEffect(() => {
    db.auth.getUser().then(({ data: { user } }) => {
      if (user?.email !== ADMIN_EMAIL) { router.push('/dashboard'); return; }
      setAuthed(true);
      fetchAll();
    });
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [f, v, a] = await Promise.all([
      db.from('co2_emission_factors').select('*').order('id'),
      db.from('co2_methodology_versions').select('*').order('effective_from', { ascending: false }),
      db.from('co2_audit_log').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (f.data) setFactors(f.data);
    if (v.data) setVersions(v.data);
    if (a.data) setAuditLog(a.data);
    setLoading(false);
  }

  async function saveFactor() {
    if (!editReason.trim()) { alert('Begrundelse er påkrævet'); return; }
    const newVal = parseFloat(editVal);
    if (isNaN(newVal) || newVal <= 0) { alert('Ugyldig værdi'); return; }
    setSaving(true);
    const old = factors.find(f => f.id === editRow.id);
    await db.from('co2_emission_factors').update({
      co2_kg_per_unit: newVal,
      methodology_version: `${METHODOLOGY_VERSION}-custom`,
      updated_at: new Date().toISOString(),
    }).eq('id', editRow.id);
    await db.from('co2_audit_log').insert({
      table_name: 'co2_emission_factors',
      record_id: editRow.id,
      action: 'update',
      changed_by: ADMIN_EMAIL,
      reason: editReason,
      old_value: { co2_kg_per_unit: old?.co2_kg_per_unit },
      new_value: { co2_kg_per_unit: newVal },
    });
    await fetchAll();
    setEditRow(null); setEditVal(''); setEditReason('');
    setSaving(false);
  }

  async function activateVersion(version) {
    if (!window.confirm(`Aktivér metode-version ${version}? Dette gælder for alle fremtidige handler.`)) return;
    await db.from('co2_methodology_versions').update({ active: false }).neq('version', version);
    await db.from('co2_methodology_versions').update({ active: true }).eq('version', version);
    await db.from('co2_audit_log').insert({
      table_name: 'co2_methodology_versions',
      record_id: version,
      action: 'version_activated',
      changed_by: ADMIN_EMAIL,
      reason: `Version ${version} aktiveret manuelt`,
      old_value: null,
      new_value: { version, activated_at: new Date().toISOString() },
    });
    fetchAll();
  }

  async function createVersion() {
    if (!newVersion.version.trim() || !newVersion.reason.trim()) { alert('Version og begrundelse er påkrævet'); return; }
    setCreatingVersion(true);
    await db.from('co2_methodology_versions').insert({
      version: newVersion.version.trim(),
      displacement_rate: parseFloat(newVersion.displacement_rate),
      transport_emission_g_per_km: parseInt(newVersion.transport_emission_g_per_km),
      notes: newVersion.notes,
      active: false,
    });
    await db.from('co2_audit_log').insert({
      table_name: 'co2_methodology_versions',
      record_id: newVersion.version.trim(),
      action: 'insert',
      changed_by: ADMIN_EMAIL,
      reason: newVersion.reason,
      old_value: null,
      new_value: { version: newVersion.version.trim() },
    });
    setNewVersion({ version: '', displacement_rate: '0.6', transport_emission_g_per_km: '170', notes: '', reason: '' });
    setCreatingVersion(false);
    fetchAll();
  }

  if (!authed || loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  );

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${PAPER3}`, fontSize: 14, fontFamily: FONT, background: '#fff', color: INK, boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', background: PAPER, paddingTop: 80 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        <div style={{ marginBottom: 28 }}>
          <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: PRIMARY, fontWeight: 700, fontFamily: FONT, cursor: 'pointer', fontSize: 13 }}>← Admin</button>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 28, color: INK, marginTop: 8, marginBottom: 4 }}>CO₂-konfiguration</h1>
          <p style={{ fontFamily: FONT, fontSize: 13, color: INK3 }}>Ændringer her påvirker KUN fremtidige handler. Historiske beregninger er låst og uændrede.</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[['factors','Emissionsfaktorer'],['versions','Metode-versioner'],['audit','Audit log']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding: '8px 18px', borderRadius: 99, border: `1.5px solid ${tab===k?PRIMARY:PAPER3}`, background: tab===k?GREEN_TINT:'transparent', color: tab===k?PRIMARY:INK3, fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>

        {/* Emission factors */}
        {tab === 'factors' && (
          <div style={{ background: '#fff', borderRadius: 18, border: `1px solid ${PAPER2}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${PAPER2}`, background: PAPER }}>
              <div style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>
                Kodebase-konstanter (lib/co2/emission-factors.js) og DB-værdier vises parallelt. Ændringer her opdaterer DB og skriver til audit log.
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: PAPER }}>
                    {['ID', 'Navn', 'Kode-værdi', 'DB-værdi', 'Kilder', 'Sidst opdateret', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: INK2, borderBottom: `1px solid ${PAPER2}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {factors.map((f, i) => {
                    const codeVal = EMISSION_FACTORS[f.id]?.co2KgPerUnit;
                    const mismatch = codeVal != null && codeVal !== f.co2_kg_per_unit;
                    return (
                      <tr key={f.id} style={{ background: i%2===0?'#fff':PAPER, borderBottom: `1px solid ${PAPER2}` }}>
                        <td style={{ padding: '10px 14px', color: INK3, fontFamily: "'Courier New', monospace", fontSize: 12 }}>{f.id}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: INK }}>{f.name_da}</td>
                        <td style={{ padding: '10px 14px', color: PRIMARY, fontWeight: 700 }}>{codeVal ?? '—'}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: mismatch ? '#e11d48' : PRIMARY }}>
                          {f.co2_kg_per_unit}
                          {mismatch && <span style={{ marginLeft: 6, fontSize: 10, background: '#FEF2F2', color: '#e11d48', padding: '2px 6px', borderRadius: 99, fontWeight: 800 }}>AFVIGER</span>}
                        </td>
                        <td style={{ padding: '10px 14px', color: INK3 }}>{(f.source_ids || []).join(', ')}</td>
                        <td style={{ padding: '10px 14px', color: INK3 }}>{f.updated_at ? new Date(f.updated_at).toLocaleDateString('da-DK') : '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <button onClick={() => { setEditRow(f); setEditVal(String(f.co2_kg_per_unit)); setEditReason(''); }}
                            style={{ padding: '4px 12px', borderRadius: 99, background: GREEN_TINT, border: 'none', color: PRIMARY, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>
                            Foreslå opdatering
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Methodology versions */}
        {tab === 'versions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {versions.map(v => (
              <div key={v.version} style={{ background: '#fff', borderRadius: 16, border: `1.5px solid ${v.active?PRIMARY:PAPER2}`, padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: INK }}>v{v.version}</span>
                  {v.active && <span style={{ background: GREEN_TINT, color: PRIMARY, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 800, fontFamily: FONT }}>AKTIV</span>}
                  {!v.active && <button onClick={() => activateVersion(v.version)}
                    style={{ padding: '4px 12px', borderRadius: 99, background: PAPER2, border: `1px solid ${PAPER3}`, color: INK3, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                    Aktivér
                  </button>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                  {[['Displacement rate', v.displacement_rate],['Transport g/km', v.transport_emission_g_per_km],['Gælder fra', new Date(v.effective_from).toLocaleDateString('da-DK')]].map(([l,val]) => (
                    <div key={l}>
                      <div style={{ fontSize: 11, color: INK3, fontFamily: FONT, marginBottom: 2 }}>{l}</div>
                      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 15, color: INK }}>{val}</div>
                    </div>
                  ))}
                </div>
                {v.notes && <p style={{ fontFamily: FONT, fontSize: 13, color: INK3, marginTop: 10, marginBottom: 0 }}>{v.notes}</p>}
              </div>
            ))}

            {/* New version form */}
            <div style={{ background: '#fff', borderRadius: 16, border: `1.5px dashed ${PAPER3}`, padding: '20px 24px' }}>
              <h3 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: INK, marginBottom: 16 }}>Opret ny metode-version</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 12 }}>
                {[['version','Versionsnummer (fx "1.1")'],['displacement_rate','Displacement rate'],['transport_emission_g_per_km','Transport g CO₂/km']].map(([k,l]) => (
                  <div key={k}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, fontFamily: FONT, color: INK2, marginBottom: 5 }}>{l}</label>
                    <input value={newVersion[k]} onChange={e => setNewVersion(p => ({ ...p, [k]: e.target.value }))} style={inputStyle} />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, fontFamily: FONT, color: INK2, marginBottom: 5 }}>Noter / ændringsbeskrivelse</label>
                <textarea value={newVersion.notes} onChange={e => setNewVersion(p => ({ ...p, notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, fontFamily: FONT, color: '#e11d48', marginBottom: 5 }}>Begrundelse for ændring *</label>
                <input value={newVersion.reason} onChange={e => setNewVersion(p => ({ ...p, reason: e.target.value }))} placeholder="Skal udfyldes — gemmes i audit log" style={{ ...inputStyle, border: `1.5px solid ${newVersion.reason ? PAPER3 : '#FCA5A5'}` }} />
              </div>
              <button onClick={createVersion} disabled={creatingVersion}
                style={{ padding: '10px 20px', borderRadius: 99, background: PRIMARY, border: 'none', color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: creatingVersion ? 'not-allowed' : 'pointer' }}>
                {creatingVersion ? <Spinner /> : 'Opret version (ikke aktiv endnu)'}
              </button>
            </div>
          </div>
        )}

        {/* Audit log */}
        {tab === 'audit' && (
          <div style={{ background: '#fff', borderRadius: 18, border: `1px solid ${PAPER2}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontSize: 12 }}>
              <thead>
                <tr style={{ background: PAPER }}>
                  {['Tidspunkt','Tabel','Record','Handling','Ændret af','Begrundelse'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: INK2, borderBottom: `1px solid ${PAPER2}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLog.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: INK3, fontFamily: FONT }}>Ingen ændringer logget endnu</td></tr>
                )}
                {auditLog.map((a, i) => (
                  <tr key={a.id} style={{ background: i%2===0?'#fff':PAPER, borderBottom: `1px solid ${PAPER2}` }}>
                    <td style={{ padding: '10px 14px', color: INK3, whiteSpace: 'nowrap' }}>{new Date(a.created_at).toLocaleString('da-DK')}</td>
                    <td style={{ padding: '10px 14px', fontFamily: "'Courier New',monospace", color: INK3 }}>{a.table_name}</td>
                    <td style={{ padding: '10px 14px', fontFamily: "'Courier New',monospace", color: INK3 }}>{a.record_id}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: a.action==='insert'?'#DCFCE7':a.action==='update'?'#FFFBEB':'#EFF6FF', color: a.action==='insert'?'#166534':a.action==='update'?'#92400E':'#1D4ED8', borderRadius: 99, padding: '2px 8px', fontWeight: 700, fontSize: 11 }}>{a.action}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: INK3 }}>{a.changed_by}</td>
                    <td style={{ padding: '10px 14px', color: INK }}>{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit factor modal */}
      {editRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,34,28,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setEditRow(null)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px', maxWidth: 480, width: '100%' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: INK, marginBottom: 6 }}>Foreslå opdatering</h2>
            <p style={{ fontFamily: FONT, fontSize: 13, color: INK3, marginBottom: 20 }}>
              Ændringen gælder KUN fremtidige handler. Historiske beregninger er låst.
            </p>
            <div style={{ background: '#FEF9C3', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, fontFamily: FONT, color: '#92400E' }}>
              <strong>{editRow.name_da}</strong> — nuværende værdi: {editRow.co2_kg_per_unit} kg CO₂e/enhed
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, fontFamily: FONT, color: INK2, marginBottom: 5 }}>Ny værdi (kg CO₂e/enhed)</label>
              <input type="number" step="0.1" value={editVal} onChange={e => setEditVal(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, fontFamily: FONT, color: '#e11d48', marginBottom: 5 }}>Begrundelse *</label>
              <textarea value={editReason} onChange={e => setEditReason(e.target.value)} rows={3} placeholder="Angiv kilde og begrundelse for ændringen" style={{ ...inputStyle, resize: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditRow(null)} style={{ flex: 1, padding: '11px', borderRadius: 99, background: PAPER2, border: 'none', fontFamily: FONT, fontWeight: 700, color: INK3, cursor: 'pointer' }}>Annuller</button>
              <button onClick={saveFactor} disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 99, background: PRIMARY, border: 'none', color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? <Spinner /> : 'Gem ændring + log'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
