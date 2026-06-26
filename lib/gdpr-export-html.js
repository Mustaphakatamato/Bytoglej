// H1: Pæn, print-optimeret HTML-rapport til "Download mine data".
// Klienten renderer denne i en skjult iframe og kalder print() → "Gem som PDF".
// JSON-varianten bevares som maskinlæsbar mulighed (?format=json).

import { escapeHtml } from '@/lib/escape-html';

const esc = v => escapeHtml(String(v ?? ''));

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return esc(v);
  return d.toLocaleString('da-DK', { dateStyle: 'long', timeStyle: 'short' });
}

// Menneskevenlige labels for institutionsfelter.
const FIELD_LABELS = {
  name: 'Navn', email: 'E-mail', phone: 'Telefon', address: 'Adresse', zipcode: 'Postnr.',
  city: 'By', cvr: 'CVR', institution_type: 'Institutionstype', ownership_type: 'Ejerform',
  leader_name: 'Leder', leader_email: 'Leder-e-mail', leader_phone: 'Leder-telefon',
  contact_name: 'Kontaktperson', ean: 'EAN', created_at: 'Oprettet',
};
// Felter vi ikke viser (interne/irrelevante for indsigt).
const HIDDEN_FIELDS = new Set(['id', 'user_id', 'logo_url', 'updated_at', 'profile_public', 'password']);

function defList(obj) {
  const rows = Object.entries(obj || {})
    .filter(([k, v]) => !HIDDEN_FIELDS.has(k) && v != null && v !== '' && typeof v !== 'object')
    .map(([k, v]) => {
      const label = FIELD_LABELS[k] || k.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
      const val = /_at$/.test(k) ? fmtDate(v) : esc(v);
      return `<div class="dl-row"><dt>${esc(label)}</dt><dd>${val}</dd></div>`;
    }).join('');
  return `<dl class="dl">${rows || '<div class="muted">Ingen data</div>'}</dl>`;
}

function table(columns, rows) {
  if (!rows?.length) return '<p class="muted">Ingen poster.</p>';
  const head = columns.map(c => `<th>${esc(c.label)}</th>`).join('');
  const body = rows.map(r => `<tr>${columns.map(c => `<td>${c.render ? c.render(r) : esc(r[c.key])}</td>`).join('')}</tr>`).join('');
  return `<table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function section(title, count, inner) {
  return `<section>
    <h2>${esc(title)}${count != null ? ` <span class="count">${count}</span>` : ''}</h2>
    ${inner}
  </section>`;
}

export function gdprExportHtml(data) {
  const meta = data._meta || {};
  const inst = data.institution || {};

  const opslag = section('Opslag', (data.opslag || []).length, table([
    { label: 'Titel', key: 'title' },
    { label: 'Type', key: 'type' },
    { label: 'Pris', render: r => r.price != null ? `${esc(r.price)} kr.` : (r.estimated_value != null ? `${esc(r.estimated_value)} kr. (anslået)` : '—') },
    { label: 'Stand', key: 'condition' },
    { label: 'Status', render: r => r.is_sold ? 'Solgt' : r.is_active ? 'Aktiv' : 'Inaktiv' },
    { label: 'Oprettet', render: r => fmtDate(r.created_at) },
  ], data.opslag));

  const ordrer = section('Ordrer (som køber)', (data.ordrer_som_koeber || []).length, table([
    { label: 'Dato', render: r => fmtDate(r.created_at) },
    { label: 'Beløb', render: r => r.grand_total != null ? `${esc(r.grand_total)} kr.` : '—' },
    { label: 'Status', key: 'status' },
    { label: 'Tracking', render: r => esc(r.tracking_number || '—') },
  ], data.ordrer_som_koeber));

  const medarbejdere = section('Medarbejdere', (data.medarbejdere || []).length, table([
    { label: 'Navn', key: 'name' },
    { label: 'E-mail', key: 'email' },
    { label: 'Rolle', key: 'role' },
  ], data.medarbejdere));

  const samtaler = section('Samtaler', (data.samtaler || []).length, table([
    { label: 'Opslag', key: 'listing_title' },
    { label: 'Oprettet', render: r => fmtDate(r.created_at) },
    { label: 'Seneste besked', render: r => esc(r.last_message || '—') },
  ], data.samtaler));

  const samtykke = section('Samtykke-historik', (data.samtykke_historik || []).length, table([
    { label: 'Tidspunkt', render: r => fmtDate(r.changed_at) },
    { label: 'Type', key: 'consent_type' },
    { label: 'Værdi', render: r => (r.granted ? 'Givet' : 'Trukket tilbage') },
  ], data.samtykke_historik));

  const saelgerIds = (data.ordre_ids_som_saelger || []);
  const saelger = section('Ordrer (som sælger)', saelgerIds.length,
    saelgerIds.length ? `<p>${saelgerIds.map(esc).join(', ')}</p>` : '<p class="muted">Ingen poster.</p>');

  return `<!DOCTYPE html>
<html lang="da"><head><meta charset="utf-8"><title>Mine data — byt&leg</title>
<style>
  :root { --green:#2A7D4F; --ink:#16221C; --ink3:#6B7570; --line:#e3e0da; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: var(--ink); margin: 0; padding: 32px 40px; line-height: 1.5; }
  header { border-bottom: 3px solid var(--green); padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; color: var(--green); }
  h1 { font-size: 20px; margin: 10px 0 4px; }
  .sub { color: var(--ink3); font-size: 12px; margin: 0; }
  section { margin: 26px 0; page-break-inside: avoid; }
  h2 { font-size: 15px; border-bottom: 1px solid var(--line); padding-bottom: 6px; margin: 0 0 12px; }
  .count { color: var(--ink3); font-weight: 600; font-size: 12px; }
  .dl { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin: 0; }
  .dl-row { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px dotted var(--line); padding: 3px 0; }
  dt { color: var(--ink3); font-size: 12px; }
  dd { margin: 0; font-size: 12px; font-weight: 600; text-align: right; }
  .tbl { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  .tbl th { text-align: left; color: var(--ink3); font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1.5px solid var(--line); padding: 6px 8px; }
  .tbl td { border-bottom: 1px solid var(--line); padding: 6px 8px; vertical-align: top; }
  .muted { color: var(--ink3); font-size: 12px; font-style: italic; }
  footer { margin-top: 32px; border-top: 1px solid var(--line); padding-top: 12px; color: var(--ink3); font-size: 10px; }
  @page { margin: 16mm; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <header>
    <div class="brand">byt<span style="opacity:.55">&amp;</span>leg.</div>
    <h1>Eksport af mine data</h1>
    <p class="sub">${esc(meta.beskrivelse || 'GDPR art. 15 & 20')}<br>
      Genereret: ${fmtDate(meta.genereret)} · Bruger: ${esc(meta.bruger_email || '')}</p>
  </header>

  ${section('Institution', null, defList(inst))}
  ${medarbejdere}
  ${opslag}
  ${ordrer}
  ${saelger}
  ${samtaler}
  ${samtykke}

  <footer>
    Dette dokument indeholder de personoplysninger byt&amp;leg behandler om din institution.
    Dataansvarlig: ${esc(meta.dataansvarlig || 'byt&leg')} · support@bytogleg.dk
  </footer>
</body></html>`;
}
