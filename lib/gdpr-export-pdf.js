// Ægte PDF-rapport til "Download mine data" (GDPR art. 15 & 20).
// Bygges direkte med @react-pdf/renderer (ingen headless browser), så den
// kører let og stabilt på Vercels serverless-funktioner. Layoutet spejler
// HTML-versionen i lib/gdpr-export-html.js. JSON-varianten bevares som
// maskinlæsbar mulighed (?format=json), HTML via (?format=html).

import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

const GREEN = '#2A7D4F';
const INK = '#16221C';
const INK3 = '#6B7570';
const LINE = '#e3e0da';

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  try {
    return d.toLocaleString('da-DK', { dateStyle: 'long', timeStyle: 'short' });
  } catch {
    return d.toISOString();
  }
}

// Menneskevenlige labels for institutionsfelter (jf. HTML-versionen).
const FIELD_LABELS = {
  name: 'Navn', email: 'E-mail', phone: 'Telefon', address: 'Adresse', zipcode: 'Postnr.',
  city: 'By', cvr: 'CVR', institution_type: 'Institutionstype', ownership_type: 'Ejerform',
  leader_name: 'Leder', leader_email: 'Leder-e-mail', leader_phone: 'Leder-telefon',
  contact_name: 'Kontaktperson', ean: 'EAN', created_at: 'Oprettet',
};
const HIDDEN_FIELDS = new Set(['id', 'user_id', 'logo_url', 'updated_at', 'profile_public', 'password']);

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 44, fontSize: 9, color: INK, fontFamily: 'Helvetica', lineHeight: 1.4 },
  header: { borderBottomWidth: 2, borderBottomColor: GREEN, paddingBottom: 12, marginBottom: 18 },
  brand: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: GREEN, letterSpacing: -0.3 },
  h1: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginTop: 8, marginBottom: 3 },
  sub: { fontSize: 8.5, color: INK3 },
  section: { marginTop: 16 },
  h2: { fontSize: 11, fontFamily: 'Helvetica-Bold', borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 4, marginBottom: 8 },
  count: { fontFamily: 'Helvetica', color: INK3, fontSize: 9 },
  muted: { color: INK3, fontSize: 9, fontStyle: 'italic' },
  // Def-list (institution)
  dlRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: LINE, borderBottomStyle: 'dotted', paddingVertical: 2.5 },
  dt: { color: INK3, fontSize: 9, flex: 1 },
  dd: { fontFamily: 'Helvetica-Bold', fontSize: 9, flex: 1, textAlign: 'right' },
  // Tabeller
  table: { marginTop: 2 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 4, paddingHorizontal: 2 },
  thead: { borderBottomWidth: 1.5 },
  th: { color: INK3, fontSize: 7.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.3, paddingRight: 6 },
  td: { fontSize: 8.5, paddingRight: 6 },
  footer: { position: 'absolute', bottom: 22, left: 44, right: 44, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8, fontSize: 7.5, color: INK3, flexDirection: 'row', justifyContent: 'space-between' },
});

function Section({ title, count, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.h2}>
        {title}
        {count != null ? <Text style={styles.count}>{`   ${count}`}</Text> : null}
      </Text>
      {children}
    </View>
  );
}

function Table({ columns, rows }) {
  if (!rows?.length) return <Text style={styles.muted}>Ingen poster.</Text>;
  return (
    <View style={styles.table}>
      <View style={[styles.tr, styles.thead]} fixed>
        {columns.map((c, i) => (
          <Text key={i} style={[styles.th, { flex: c.flex || 1 }]}>{c.label}</Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={styles.tr} wrap={false}>
          {columns.map((c, i) => (
            <Text key={i} style={[styles.td, { flex: c.flex || 1 }]}>
              {c.render ? c.render(r) : String(r[c.key] ?? '')}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function DefList({ obj }) {
  const rows = Object.entries(obj || {})
    .filter(([k, v]) => !HIDDEN_FIELDS.has(k) && v != null && v !== '' && typeof v !== 'object')
    .map(([k, v]) => {
      const label = FIELD_LABELS[k] || k.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
      const val = /_at$/.test(k) ? fmtDate(v) : String(v);
      return { label, val };
    });
  if (!rows.length) return <Text style={styles.muted}>Ingen data</Text>;
  return (
    <View>
      {rows.map((r, i) => (
        <View key={i} style={styles.dlRow} wrap={false}>
          <Text style={styles.dt}>{r.label}</Text>
          <Text style={styles.dd}>{r.val}</Text>
        </View>
      ))}
    </View>
  );
}

function ExportDocument({ data }) {
  const meta = data._meta || {};
  const inst = data.institution || {};
  const saelgerIds = data.ordre_ids_som_saelger || [];

  return (
    <Document title="Mine data — byt&leg" author="byt&leg">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>byt&amp;leg.</Text>
          <Text style={styles.h1}>Eksport af mine data</Text>
          <Text style={styles.sub}>{meta.beskrivelse || 'GDPR art. 15 & 20'}</Text>
          <Text style={styles.sub}>{`Genereret: ${fmtDate(meta.genereret)}  ·  Bruger: ${meta.bruger_email || ''}`}</Text>
        </View>

        <Section title="Institution">
          <DefList obj={inst} />
        </Section>

        <Section title="Medarbejdere" count={(data.medarbejdere || []).length}>
          <Table
            columns={[
              { label: 'Navn', key: 'name', flex: 2 },
              { label: 'E-mail', key: 'email', flex: 3 },
              { label: 'Rolle', key: 'role', flex: 1.5 },
            ]}
            rows={data.medarbejdere}
          />
        </Section>

        <Section title="Opslag" count={(data.opslag || []).length}>
          <Table
            columns={[
              { label: 'Titel', key: 'title', flex: 3 },
              { label: 'Type', key: 'type', flex: 1.3 },
              { label: 'Pris', flex: 1.6, render: r => r.price != null ? `${r.price} kr.` : (r.estimated_value != null ? `${r.estimated_value} kr. (anslået)` : '—') },
              { label: 'Stand', key: 'condition', flex: 1.3 },
              { label: 'Status', flex: 1.2, render: r => r.is_sold ? 'Solgt' : r.is_active ? 'Aktiv' : 'Inaktiv' },
              { label: 'Oprettet', flex: 2, render: r => fmtDate(r.created_at) },
            ]}
            rows={data.opslag}
          />
        </Section>

        <Section title="Ordrer (som køber)" count={(data.ordrer_som_koeber || []).length}>
          <Table
            columns={[
              { label: 'Dato', flex: 2.2, render: r => fmtDate(r.created_at) },
              { label: 'Beløb', flex: 1.4, render: r => r.grand_total != null ? `${r.grand_total} kr.` : '—' },
              { label: 'Status', key: 'status', flex: 1.4 },
              { label: 'Tracking', flex: 2, render: r => r.tracking_number || '—' },
            ]}
            rows={data.ordrer_som_koeber}
          />
        </Section>

        <Section title="Ordrer (som sælger)" count={saelgerIds.length}>
          {saelgerIds.length
            ? <Text style={{ fontSize: 8.5 }}>{saelgerIds.join(', ')}</Text>
            : <Text style={styles.muted}>Ingen poster.</Text>}
        </Section>

        <Section title="Samtaler" count={(data.samtaler || []).length}>
          <Table
            columns={[
              { label: 'Opslag', key: 'listing_title', flex: 2.5 },
              { label: 'Oprettet', flex: 2, render: r => fmtDate(r.created_at) },
              { label: 'Seneste besked', flex: 3.5, render: r => r.last_message || '—' },
            ]}
            rows={data.samtaler}
          />
        </Section>

        <Section title="Samtykke-historik" count={(data.samtykke_historik || []).length}>
          <Table
            columns={[
              { label: 'Tidspunkt', flex: 2.5, render: r => fmtDate(r.changed_at) },
              { label: 'Type', key: 'consent_type', flex: 2 },
              { label: 'Værdi', flex: 2, render: r => (r.granted ? 'Givet' : 'Trukket tilbage') },
            ]}
            rows={data.samtykke_historik}
          />
        </Section>

        <View style={styles.footer} fixed>
          <Text>{`Dataansvarlig: ${meta.dataansvarlig || 'byt&leg'}  ·  support@bytogleg.dk`}</Text>
          <Text render={({ pageNumber, totalPages }) => `Side ${pageNumber} af ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// Returnerer rapporten som en PDF-buffer.
export function gdprExportPdf(data) {
  return renderToBuffer(<ExportDocument data={data} />);
}
