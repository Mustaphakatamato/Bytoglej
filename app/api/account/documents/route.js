import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { resolveCallerInstitution } from '@/lib/institution-server';

// Kalderens bilag (købsfakturaer, afregningsbilag, udbetalingsbilag) med
// midlertidige, signerede download-URL'er. documents-bucket'en er privat, så
// URL'erne genereres server-side med service-rollen og udløber efter en time.
export async function GET(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const supa = createServerClient();
  const inst = await resolveCallerInstitution(supa, user);
  if (!inst) return NextResponse.json({ error: 'Ingen institution fundet' }, { status: 404 });

  const { data: docs } = await supa.from('documents')
    .select('id, doc_type, doc_number, counterparty_id, reference_type, amount_dkk, vat_dkk, issued_at, pdf_path, payload')
    .eq('institution_id', inst.id)
    .order('issued_at', { ascending: false })
    .limit(300);

  const rows = docs || [];
  const paths = rows.map(d => d.pdf_path).filter(Boolean);
  let urlByPath = {};
  if (paths.length) {
    const { data: signed } = await supa.storage.from('documents').createSignedUrls(paths, 3600);
    urlByPath = Object.fromEntries((signed || []).filter(s => s.signedUrl).map(s => [s.path, s.signedUrl]));
  }

  return NextResponse.json({
    documents: rows.map(d => ({
      id: d.id,
      docType: d.doc_type,
      docNumber: d.doc_number,
      title: d.payload?.title || d.doc_type,
      counterpartyName: d.payload?.parties?.[0]?.name || null,
      referenceType: d.reference_type,
      amount: Number(d.amount_dkk || 0),
      vat: Number(d.vat_dkk || 0),
      issuedAt: d.issued_at,
      downloadUrl: d.pdf_path ? (urlByPath[d.pdf_path] || null) : null,
    })),
  });
}
