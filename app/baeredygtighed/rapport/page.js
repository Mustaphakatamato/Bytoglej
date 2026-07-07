'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, FONT } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { Spinner } from '@/components/ui';
import { aggregateSavings, getCO2Comparison } from '@/lib/co2/calculator';
import { EMISSION_FACTORS, METHODOLOGY_VERSION } from '@/lib/co2/emission-factors';

const MONTHS_DA = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function fmtKg(n) {
  const v = Math.round((n || 0) * 10) / 10;
  if (v >= 1000) return `${(v / 1000).toFixed(2)} tons`;
  return `${v.toLocaleString('da-DK')} kg`;
}

function StatCard({ value, label, sub, accent }) {
  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '22px 22px', boxShadow: '0 1px 6px rgba(22,34,28,0.08)', border: `1px solid ${PAPER3}` }}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: accent || INK, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, marginTop: 8 }}>{label}</div>
      {sub && <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function CO2RapportPage() {
  const router = useRouter();
  const { effectiveInstitution } = useApp();
  const { realUserId, userId } = useActiveUser();
  const ww = useWindowWidth();
  const isMobile = ww > 0 && ww < 768;

  const [loading, setLoading] = useState(true);
  const [institution, setInstitution] = useState(effectiveInstitution || null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setLoading(true);
      let inst = effectiveInstitution || null;
      if (!inst) {
        const { data: { user } } = await db.auth.getUser();
        if (!user || cancelled) { setLoading(false); return; }
        const { data: ownInst } = await db.from('institutions').select('*').ilike('email', user.email).maybeSingle();
        if (ownInst) inst = ownInst;
        else {
          const { data: mem } = await db.from('institution_members').select('role,institutions(*)').eq('email', user.email).maybeSingle();
          if (mem?.institutions) inst = mem.institutions;
        }
      }
      if (cancelled) return;
      setInstitution(inst);

      if (!inst?.id) { setLoading(false); return; }
      const { data } = await db
        .from('transaction_co2_savings')
        .select('net_saved_kg, calculated_at, listing_category_id, seller_institution_id, buyer_institution_id, breakdown, methodology_version')
        .or(`seller_institution_id.eq.${inst.id},buyer_institution_id.eq.${inst.id}`)
        .order('calculated_at', { ascending: false });
      if (!cancelled) { setRows(data || []); setLoading(false); }
    }
    boot();
    return () => { cancelled = true; };
  }, [effectiveInstitution?.id]);

  const instId = institution?.id;

  const agg = useMemo(() => aggregateSavings(rows), [rows]);

  const soldKg = useMemo(
    () => rows.filter(r => r.seller_institution_id === instId).reduce((s, r) => s + (r.net_saved_kg || 0), 0),
    [rows, instId]
  );
  const boughtKg = useMemo(
    () => rows.filter(r => r.buyer_institution_id === instId).reduce((s, r) => s + (r.net_saved_kg || 0), 0),
    [rows, instId]
  );

  // Top-kategorier
  const byCategory = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const id = r.listing_category_id || 'other';
      const cur = map.get(id) || { kg: 0, count: 0 };
      cur.kg += r.net_saved_kg || 0;
      cur.count += 1;
      map.set(id, cur);
    }
    return [...map.entries()]
      .map(([id, v]) => ({ id, name: EMISSION_FACTORS[id]?.nameDA || id, ...v }))
      .sort((a, b) => b.kg - a.kg);
  }, [rows]);

  // Sidste 12 måneder
  const monthly = useMemo(() => {
    const buckets = [];
    const now = new Date();
    for (let k = 11; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS_DA[d.getMonth()], year: d.getFullYear(), kg: 0 });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    for (const r of rows) {
      const d = new Date(r.calculated_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (idx.has(key)) buckets[idx.get(key)].kg += r.net_saved_kg || 0;
    }
    return buckets;
  }, [rows]);
  const maxMonth = Math.max(1, ...monthly.map(m => m.kg));

  const comparison = agg.total ? getCO2Comparison(agg.total) : null;

  const [pdfBusy, setPdfBusy] = useState(false);
  async function downloadPDF() {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const { downloadCO2ReportPdf } = await import('@/lib/co2/report-pdf');
      await downloadCO2ReportPdf({
        institutionName: institution?.name || 'Din institution',
        generatedAt: new Date().toISOString(),
        methodologyVersion: METHODOLOGY_VERSION,
        totalLabel: fmtKg(agg.total),
        count: agg.count,
        comparison,
        thisYear: new Date().getFullYear(),
        lastYear: new Date().getFullYear() - 1,
        thisYearLabel: fmtKg(agg.thisYear),
        lastYearLabel: fmtKg(agg.lastYear),
        soldLabel: fmtKg(soldKg),
        boughtLabel: fmtKg(boughtKg),
        categories: byCategory.map(c => ({
          name: c.name,
          kgLabel: fmtKg(c.kg),
          count: c.count,
          pct: agg.total > 0 ? (c.kg / agg.total) * 100 : 0,
        })),
      });
    } catch (e) {
      console.error('PDF-generering fejlede', e);
      alert('Kunne ikke generere PDF. Prøv igen.');
    } finally {
      setPdfBusy(false);
    }
  }

  function exportCSV() {
    const header = ['Dato', 'Kategori', 'Rolle', 'kg CO2e sparet', 'Metode-version'];
    const lines = rows.map(r => {
      const role = r.seller_institution_id === instId ? 'Solgt/byttet væk' : 'Købt/byttet til';
      const date = new Date(r.calculated_at).toLocaleDateString('da-DK');
      const cat = (EMISSION_FACTORS[r.listing_category_id]?.nameDA || r.listing_category_id || 'Andet').replace(/;/g, ',');
      const ver = r.methodology_version || r.breakdown?.methodologyVersion || METHODOLOGY_VERSION;
      return [date, cat, role, String(r.net_saved_kg ?? 0).replace('.', ','), ver].join(';');
    });
    const csv = '﻿' + [header.join(';'), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (institution?.name || 'institution').replace(/[^a-z0-9æøå]+/gi, '-').toLowerCase();
    a.href = url;
    a.download = `co2-rapport-${safeName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  }

  const h2 = { fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 18 : 21, color: INK, margin: '36px 0 14px', letterSpacing: '-0.02em' };

  return (
    <div style={{ minHeight: '100vh', background: PAPER }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`, paddingTop: 90, paddingBottom: 44 }}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 24px' }}>
          <button onClick={() => router.push('/profil')} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 99, padding: '7px 16px', color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, marginBottom: 18 }}>← Tilbage til profil</button>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 99, padding: '5px 14px', marginBottom: 14 }}>
            <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>🌱 Klimarapport</span>
          </div>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 26 : 36, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 8 }}>
            {institution?.name || 'Din institution'}
          </h1>
          <p style={{ fontFamily: FONT, fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: 0 }}>
            Estimeret klimagevinst ved at købe, sælge og bytte brugt legetøj på byt&amp;leg. Tallene er konservative estimater (kg CO₂e) — se{' '}
            <a href="/baeredygtighed/metode" style={{ color: '#fff', textDecoration: 'underline' }}>metoden</a>.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: '0 auto', padding: isMobile ? '28px 18px 80px' : '36px 24px 100px' }}>

        {rows.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 18, padding: '48px 28px', textAlign: 'center', border: `1px solid ${PAPER3}`, marginTop: 16 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🌱</div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 19, color: INK, marginBottom: 8 }}>Ingen handler endnu</div>
            <p style={{ fontFamily: FONT, fontSize: 14, color: INK3, lineHeight: 1.6, maxWidth: 420, margin: '0 auto 20px' }}>
              Når I gennemfører jeres første køb, salg eller bytte, beregner vi automatisk den estimerede CO₂-besparelse her — klar til jeres års- eller CSR-rapport.
            </p>
            <button onClick={() => router.push('/')} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, fontFamily: FONT, fontWeight: 700, fontSize: 14, padding: '11px 26px', cursor: 'pointer' }}>
              Find legetøj →
            </button>
          </div>
        ) : (
          <>
            {/* Hovedtal */}
            <div style={{ background: '#fff', borderRadius: 20, padding: isMobile ? '26px 22px' : '32px 36px', boxShadow: '0 2px 14px rgba(19,63,43,0.08)', border: `1px solid ${GREEN_SOFT}`, display: 'flex', alignItems: 'center', gap: isMobile ? 18 : 28, flexWrap: 'wrap' }}>
              <div style={{ fontSize: isMobile ? 46 : 60 }}>🌍</div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 38 : 52, color: PRIMARY, letterSpacing: '-0.04em', lineHeight: 1 }}>
                  ≈ {fmtKg(agg.total)}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 14, color: INK2, fontWeight: 600, marginTop: 8 }}>
                  CO₂e sparet i alt · {agg.count} {agg.count === 1 ? 'handel' : 'handler'}
                </div>
                {comparison && <div style={{ fontFamily: FONT, fontSize: 13, color: PRIMARY, fontWeight: 600, marginTop: 6 }}>{comparison}</div>}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'nowrap', width: isMobile ? '100%' : 'auto' }}>
                <button onClick={exportCSV} style={{ flex: isMobile ? 1 : 'none', whiteSpace: 'nowrap', textAlign: 'center', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, fontFamily: FONT, fontWeight: 700, fontSize: 13, padding: '10px 16px', cursor: 'pointer' }}>⬇ Download CSV</button>
                <button onClick={downloadPDF} disabled={pdfBusy} style={{ flex: isMobile ? 1 : 'none', whiteSpace: 'nowrap', textAlign: 'center', background: 'none', color: PRIMARY, border: `1.5px solid ${PRIMARY}`, borderRadius: 99, fontFamily: FONT, fontWeight: 700, fontSize: 13, padding: '10px 16px', cursor: pdfBusy ? 'default' : 'pointer', opacity: pdfBusy ? 0.6 : 1 }}>{pdfBusy ? 'Genererer…' : '⬇ Download PDF'}</button>
              </div>
            </div>

            {/* Nøgletal */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
              <StatCard value={fmtKg(agg.thisYear)} label="I år" sub={`${new Date().getFullYear()}`} accent={PRIMARY} />
              <StatCard value={fmtKg(agg.lastYear)} label="Sidste år" sub={`${new Date().getFullYear() - 1}`} />
              <StatCard value={fmtKg(soldKg)} label="Solgt / byttet væk" sub="Som sælger" />
              <StatCard value={fmtKg(boughtKg)} label="Købt / byttet til" sub="Som køber" />
            </div>

            {/* Udvikling over tid */}
            <h2 style={h2}>Udvikling — seneste 12 måneder</h2>
            <div style={{ background: '#fff', borderRadius: 18, padding: isMobile ? '20px 14px' : '26px 28px', border: `1px solid ${PAPER3}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: isMobile ? 4 : 10, height: 160 }}>
                {monthly.map((m, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontFamily: FONT, fontSize: 10, color: INK3, fontWeight: 600 }}>{m.kg > 0 ? Math.round(m.kg) : ''}</div>
                    <div title={`${m.label} ${m.year}: ${fmtKg(m.kg)}`} style={{
                      width: '100%', maxWidth: 34,
                      height: `${Math.max(m.kg > 0 ? 4 : 0, (m.kg / maxMonth) * 120)}px`,
                      background: m.kg > 0 ? `linear-gradient(180deg, ${PRIMARY}, ${GREEN_DEEP})` : PAPER2,
                      borderRadius: '6px 6px 0 0', transition: 'height 0.3s',
                    }} />
                    <div style={{ fontFamily: FONT, fontSize: 10, color: INK3 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top-kategorier */}
            <h2 style={h2}>Hvor besparelsen kommer fra</h2>
            <div style={{ background: '#fff', borderRadius: 18, padding: isMobile ? '8px 14px' : '12px 24px', border: `1px solid ${PAPER3}` }}>
              {byCategory.map((c, i) => {
                const pct = agg.total > 0 ? (c.kg / agg.total) * 100 : 0;
                return (
                  <div key={c.id} style={{ padding: '14px 0', borderBottom: i < byCategory.length - 1 ? `1px solid ${PAPER2}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <span style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>{c.name}</span>
                      <span style={{ fontFamily: FONT, fontSize: 13, color: INK2, fontWeight: 700 }}>{fmtKg(c.kg)} <span style={{ color: INK3, fontWeight: 500 }}>· {c.count} {c.count === 1 ? 'stk' : 'stk'}</span></span>
                    </div>
                    <div style={{ height: 8, background: PAPER2, borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: PRIMARY, borderRadius: 99 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Forbehold */}
            <div style={{ marginTop: 28, background: GREEN_TINT, border: `1px solid ${GREEN_SOFT}`, borderRadius: 14, padding: '16px 20px' }}>
              <p style={{ fontFamily: FONT, fontSize: 13, color: INK2, lineHeight: 1.65, margin: 0 }}>
                Alle tal er <strong>estimater</strong> i kg CO₂e, beregnet med metode v{METHODOLOGY_VERSION} på handelstidspunktet. Historiske handler bevarer deres oprindelige beregning.{' '}
                <a href="/baeredygtighed/metode" style={{ color: PRIMARY, fontWeight: 700 }}>Se hele metoden og kilderne →</a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
