// Klientside PDF-generering for klimarapporten. Bygger en A4-PDF med
// @react-pdf/renderer og downloader den som en blob — samme robuste mønster som
// CSV-eksporten. Bruges i stedet for window.print(), som er upålidelig i
// standalone PWA/iOS (dialogen åbner ofte slet ikke).
//
// Importeres dynamisk i klik-handleren, så det tunge react-pdf-bundle først
// hentes når brugeren rent faktisk downloader.

import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

const GREEN = '#2A7D4F';
const GREEN_DEEP = '#133F2B';
const INK = '#16221C';
const INK2 = '#3C463F';
const INK3 = '#6B7570';
const LINE = '#e3e0da';
const TINT = '#EEF4EF';

function fmtDate(v) {
  const d = new Date(v);
  if (isNaN(d)) return String(v || '');
  try { return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return d.toISOString().slice(0, 10); }
}

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 44, fontSize: 10, color: INK, fontFamily: 'Helvetica', lineHeight: 1.4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 2, borderBottomColor: GREEN, paddingBottom: 12, marginBottom: 18 },
  brand: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: GREEN, letterSpacing: -0.3 },
  brandSub: { fontSize: 8.5, color: INK3, marginTop: 2 },
  docTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  docMeta: { fontSize: 9, color: INK3, textAlign: 'right', marginTop: 2 },
  instName: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: INK, letterSpacing: -0.5, marginBottom: 4 },
  intro: { fontSize: 9.5, color: INK3, lineHeight: 1.5, marginBottom: 18 },
  hero: { backgroundColor: TINT, borderRadius: 10, padding: 20, marginBottom: 22 },
  heroBig: { fontSize: 34, fontFamily: 'Helvetica-Bold', color: GREEN, letterSpacing: -1 },
  heroSub: { fontSize: 10, color: INK2, fontFamily: 'Helvetica-Bold', marginTop: 6 },
  heroCmp: { fontSize: 9.5, color: GREEN, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 6, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 12 },
  statVal: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: INK },
  statLabel: { fontSize: 8, color: INK3, marginTop: 4 },
  catRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: LINE },
  catTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catName: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: INK },
  catKg: { fontSize: 9, color: INK2, fontFamily: 'Helvetica-Bold' },
  barTrack: { height: 6, backgroundColor: '#E9E4DB', borderRadius: 99 },
  barFill: { height: 6, backgroundColor: GREEN, borderRadius: 99 },
  note: { fontSize: 8.5, color: INK3, marginTop: 20, lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 22, left: 44, right: 44, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8, fontSize: 7.5, color: INK3, textAlign: 'center' },
});

function CO2ReportDocument({ d }) {
  return (
    <Document title={`Klimarapport – ${d.institutionName}`} author="byt&leg">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>byt&amp;leg.</Text>
            <Text style={s.brandSub}>bytogleg.dk</Text>
          </View>
          <View>
            <Text style={s.docTitle}>Klimarapport</Text>
            <Text style={s.docMeta}>{`Genereret ${fmtDate(d.generatedAt)}`}</Text>
          </View>
        </View>

        <Text style={s.instName}>{d.institutionName}</Text>
        <Text style={s.intro}>
          Estimeret klimagevinst ved at købe, sælge og bytte brugt legetøj på byt&amp;leg.
          Alle tal er konservative estimater i kg CO₂e, beregnet med metode v{d.methodologyVersion}.
        </Text>

        <View style={s.hero}>
          <Text style={s.heroBig}>{`≈ ${d.totalLabel}`}</Text>
          <Text style={s.heroSub}>{`CO₂e sparet i alt · ${d.count} ${d.count === 1 ? 'handel' : 'handler'}`}</Text>
          {d.comparison ? <Text style={s.heroCmp}>{d.comparison}</Text> : null}
        </View>

        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statVal}>{d.thisYearLabel}</Text>
            <Text style={s.statLabel}>{`I år (${d.thisYear})`}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statVal}>{d.lastYearLabel}</Text>
            <Text style={s.statLabel}>{`Sidste år (${d.lastYear})`}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statVal}>{d.soldLabel}</Text>
            <Text style={s.statLabel}>Solgt / byttet væk</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statVal}>{d.boughtLabel}</Text>
            <Text style={s.statLabel}>Købt / byttet til</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Hvor besparelsen kommer fra</Text>
        {(d.categories || []).map((c, i) => (
          <View key={i} style={s.catRow} wrap={false}>
            <View style={s.catTop}>
              <Text style={s.catName}>{c.name}</Text>
              <Text style={s.catKg}>{`${c.kgLabel} · ${c.count} stk`}</Text>
            </View>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${Math.max(2, c.pct)}%` }]} />
            </View>
          </View>
        ))}

        <Text style={s.note}>
          Alle tal er estimater i kg CO₂e, beregnet med metode v{d.methodologyVersion} på handelstidspunktet.
          Historiske handler bevarer deres oprindelige beregning. Se hele metoden og kilderne på bytogleg.dk/baeredygtighed/metode.
        </Text>

        <Text style={s.footer} fixed>
          {`Klimarapport for ${d.institutionName}  ·  byt&leg  ·  bytogleg.dk`}
        </Text>
      </Page>
    </Document>
  );
}

// Bygger PDF'en og trigger download i browseren.
export async function downloadCO2ReportPdf(data) {
  const blob = await pdf(<CO2ReportDocument d={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (data.institutionName || 'institution').replace(/[^a-z0-9æøå]+/gi, '-').toLowerCase();
  a.href = url;
  a.download = `klimarapport-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
