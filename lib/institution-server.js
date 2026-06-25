// Server-side institution-opslag til API-routes (kører med service role).
// Matcher appens dual-identity-model: en bruger kan være ejer/leder af en
// institution (institutions.email / leader_email) eller medlem af en
// (institution_members.email). Undgår .or()-filtre med rå e-mail for ikke
// at risikere parsing-problemer — bruger separate, sikre opslag.

const INST_COLS = 'id, name, email, leader_email';

// Find den institution som den aktuelle bruger tilhører (eller null).
export async function resolveCallerInstitution(supa, user) {
  const email = (user?.email || '').toLowerCase();
  if (!email) return null;

  let { data: owned } = await supa
    .from('institutions').select(INST_COLS).ilike('email', email).maybeSingle();
  if (!owned) {
    ({ data: owned } = await supa
      .from('institutions').select(INST_COLS).ilike('leader_email', email).maybeSingle());
  }
  if (owned) return owned;

  const { data: mem } = await supa
    .from('institution_members')
    .select('institutions(' + INST_COLS + ')')
    .ilike('email', email)
    .maybeSingle();
  return mem?.institutions || null;
}

// Find institution ud fra navn (sælger udledes af opslagets institution_name).
export async function resolveInstitutionByName(supa, name) {
  if (!name) return null;
  const { data } = await supa
    .from('institutions').select(INST_COLS).ilike('name', name).maybeSingle();
  return data || null;
}

// Tjek om brugeren tilhører en given institution (via id).
export async function userBelongsToInstitution(supa, user, instId) {
  if (!instId) return false;
  const email = (user?.email || '').toLowerCase();
  if (!email) return false;

  const { data: inst } = await supa
    .from('institutions').select('id, email, leader_email').eq('id', instId).maybeSingle();
  if (inst && [inst.email, inst.leader_email]
    .filter(Boolean).some(e => e.toLowerCase() === email)) return true;

  const { data: mem } = await supa
    .from('institution_members').select('id')
    .eq('institution_id', instId).ilike('email', email).maybeSingle();
  return !!mem;
}
