// PDF-generering for byt&leg-bilag (købsfaktura, afregningsbilag, udbetalingsbilag).
// Bygges med @react-pdf/renderer — samme mønster som lib/gdpr-export-pdf.js, så
// det kører let og stabilt serverless (ingen headless browser). Én generisk
// skabelon renderer alle bilagstyper ud fra et payload-objekt bygget i
// lib/documents.js, så payloadet både gemmes (til regenerering) og printes.

import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

const GREEN = '#2A7D4F';
const INK = '#16221C';
const INK3 = '#6B7570';
const LINE = '#e3e0da';

const kr = n => `${Number(n || 0).toFixed(2).replace('.', ',')} kr.`;
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
  issuerLine: { fontSize: 8.5, color: INK3, marginTop: 2 },
  docTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  docMeta: { fontSize: 9, color: INK3, textAlign: 'right', marginTop: 2 },
  party: { marginBottom: 14 },
  partyLabel: { fontSize: 8, color: INK3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  partyName: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  partyLine: { fontSize: 9, color: INK3 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 5 },
  thead: { borderBottomWidth: 1.5, borderBottomColor: '#DAD3C4' },
  th: { fontSize: 8, color: INK3, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.3 },
  tdDesc: { flex: 4, fontSize: 9.5 },
  tdVat: { flex: 1.2, fontSize: 9.5, color: INK3, textAlign: 'right' },
  tdAmt: { flex: 1.6, fontSize: 9.5, textAlign: 'right' },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  sumLabel: { fontSize: 9.5, color: INK3 },
  sumVal: { fontSize: 9.5 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1.5, borderTopColor: INK, marginTop: 8, paddingTop: 8 },
  totalLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  totalVal: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: GREEN },
  note: { fontSize: 8.5, color: INK3, marginTop: 14, lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 22, left: 44, right: 44, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8, fontSize: 7.5, color: INK3, textAlign: 'center' },
});

function Party({ block }) {
  return (
    <View style={s.party}>
      <Text style={s.partyLabel}>{block.label}</Text>
      <Text style={s.partyName}>{block.name}</Text>
      {(block.lines || []).filter(Boolean).map((l, i) => <Text key={i} style={s.partyLine}>{l}</Text>)}
    </View>
  );
}

function BilagDocument({ d }) {
  const issuer = d.issuer || {};
  return (
    <Document title={`${d.title} ${d.docNumber}`} author="byt&leg">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>byt&amp;leg.</Text>
            <Text style={s.issuerLine}>{issuer.name}{issuer.cvr ? `  ·  CVR ${issuer.cvr}` : ''}</Text>
            <Text style={s.issuerLine}>{[issuer.address, [issuer.zip, issuer.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</Text>
            {issuer.vatNo ? <Text style={s.issuerLine}>{`Momsnr. ${issuer.vatNo}`}</Text> : null}
          </View>
          <View>
            <Text style={s.docTitle}>{d.title}</Text>
            <Text style={s.docMeta}>{d.docNumber}</Text>
            <Text style={s.docMeta}>{fmtDate(d.issuedAt)}</Text>
          </View>
        </View>

        {(d.parties || []).map((b, i) => <Party key={i} block={b} />)}

        <View style={[s.tr, s.thead]}>
          <Text style={[s.th, { flex: 4 }]}>Beskrivelse</Text>
          <Text style={[s.th, { flex: 1.2, textAlign: 'right' }]}>Moms</Text>
          <Text style={[s.th, { flex: 1.6, textAlign: 'right' }]}>Beløb</Text>
        </View>
        {(d.lines || []).map((l, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <Text style={s.tdDesc}>{l.description}</Text>
            <Text style={s.tdVat}>{l.vatLabel}</Text>
            <Text style={s.tdAmt}>{kr(l.amount)}</Text>
          </View>
        ))}

        <View style={{ marginTop: 10, alignSelf: 'flex-end', width: '55%' }}>
          {(d.summary || []).map((r, i) => (
            <View key={i} style={s.sumRow}>
              <Text style={s.sumLabel}>{r.label}</Text>
              <Text style={s.sumVal}>{r.value}</Text>
            </View>
          ))}
          {d.total ? (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>{d.total.label}</Text>
              <Text style={s.totalVal}>{kr(d.total.amount)}</Text>
            </View>
          ) : null}
        </View>

        {(d.notes || []).filter(Boolean).map((n, i) => <Text key={i} style={s.note}>{n}</Text>)}

        <Text style={s.footer} fixed>
          {`${issuer.name || 'byt&leg'}  ·  bytogleg.dk  ·  ${issuer.email || 'support@bytogleg.dk'}`}
        </Text>
      </Page>
    </Document>
  );
}

// Returnerer bilaget som en PDF-buffer.
export function renderDocumentPdf(payload) {
  return renderToBuffer(<BilagDocument d={payload} />);
}
