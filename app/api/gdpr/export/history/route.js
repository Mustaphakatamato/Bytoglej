import { NextResponse } from 'next/server';
import { requireAuth, UNAUTHORIZED } from '@/lib/api-auth';
import { createServerClient } from '@/lib/supabase-server';
import { resolveInstitution } from '@/lib/gdpr-institution';

// GET /api/gdpr/export/history
//
// Returnerer institutionens downloadhistorik for data-eksport: hvornår data er
// hentet og i hvilket format. Læses kun via service role (data_export_log har
// RLS slået til uden klient-policies), så historikken ikke kan manipuleres.
export async function GET(req) {
  const user = await requireAuth(req);
  if (!user) return UNAUTHORIZED();

  const supa = createServerClient();

  const institution = await resolveInstitution(supa, user, 'id');
  if (!institution?.id) {
    return NextResponse.json({ error: 'Ingen institution fundet' }, { status: 403 });
  }

  const { data, error } = await supa.from('data_export_log')
    .select('id, format, created_at')
    .eq('institution_id', institution.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[gdpr/export/history] fejl:', error);
    return NextResponse.json({ error: 'Kunne ikke hente historik' }, { status: 500 });
  }

  return NextResponse.json({ history: data || [] });
}
