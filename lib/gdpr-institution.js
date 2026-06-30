// Finder den indloggede brugers institution: først som ejer (email matcher
// institutions.email), ellers som medlem (institution_members.email). Samme
// mønster bruges på tværs af GDPR-routes (eksport, historik, samtykke).
export async function resolveInstitution(supa, user, columns = '*') {
  const { data: ownInst } = await supa.from('institutions')
    .select(columns).ilike('email', user.email).maybeSingle();
  if (ownInst) return ownInst;

  const { data: mem } = await supa.from('institution_members')
    .select(`institutions(${columns})`).ilike('email', user.email).maybeSingle();
  return mem?.institutions || null;
}
