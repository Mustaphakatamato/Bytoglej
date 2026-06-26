// Samlet notifikations-helper (C1).
//
// Én begivenhed → tre kanaler, konsistent:
//   1. Klokken  — række i `notifications` (institution_id + institution_name)
//   2. E-mail   — via Resend (hvis modtager-email kan findes)
//   3. Push     — web-push til institutionens bruger(e) (hvis user_id findes)
//
// Manglende nøgler udledes automatisk ud fra det der er givet, så kalderen
// kun behøver fx institutionName ELLER institutionId.
//
// Brug en server-supabase-klient (service role) som `supa`-argument.

import { sendPushToUser } from '@/lib/push';

// Slå manglende institution-nøgler op (id, navn, email).
// Bemærk: institutioner kobles til auth-brugere via EMAIL (ingen user_id-kolonne).
async function resolveInstitution(supa, { institutionId, institutionName }) {
  let inst = null;
  if (institutionId) {
    const { data } = await supa.from('institutions').select('id, name, email').eq('id', institutionId).maybeSingle();
    inst = data;
  } else if (institutionName) {
    const { data } = await supa.from('institutions').select('id, name, email').eq('name', institutionName).maybeSingle();
    inst = data;
  }
  return inst;
}

// Find alle auth-bruger-id'er knyttet til institutionen (ejer + teammedlemmer) til push.
// Mapping sker via email → auth.users (samme mønster som notify-message).
async function institutionUserIds(supa, inst) {
  if (!inst) return [];
  const emails = new Set();
  if (inst.email) emails.add(inst.email.toLowerCase());
  if (inst.id) {
    const { data: members } = await supa.from('institution_members').select('email').eq('institution_id', inst.id);
    for (const m of (members || [])) if (m.email) emails.add(m.email.toLowerCase());
  }
  if (!emails.size || !supa.auth?.admin?.listUsers) return [];
  try {
    const { data: { users } } = await supa.auth.admin.listUsers({ perPage: 1000 });
    return (users || []).filter(u => u.email && emails.has(u.email.toLowerCase())).map(u => u.id);
  } catch (e) {
    console.error('[notify] kunne ikke slå push-brugere op:', e?.message);
    return [];
  }
}

async function sendEmail(to, subject, html) {
  if (!to || !process.env.RESEND_API_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'byt&leg <noreply@bytogleg.dk>', to: [to], subject, html }),
    });
  } catch (e) {
    console.error('[notify] email-fejl:', e?.message);
  }
}

/**
 * Udløs en notifikation på alle relevante kanaler.
 *
 * @param {object} supa  Server-supabase-klient (service role)
 * @param {object} opts
 * @param {string} [opts.institutionId]
 * @param {string} [opts.institutionName]
 * @param {string} [opts.type]    notifikationstype (fx 'swap_proposal_received')
 * @param {string} opts.title     overskrift (klokke + push)
 * @param {string} [opts.body]    brødtekst
 * @param {object} [opts.data]    ekstra metadata (fx { conversation_id })
 * @param {string} [opts.email]   eksplicit modtager-email (ellers udledes)
 * @param {boolean}[opts.sendBell=true]
 * @param {boolean}[opts.sendEmail=true]
 * @param {boolean}[opts.sendPush=true]
 * @param {string} [opts.emailHtml] valgfri e-mail-HTML (ellers genereres en simpel)
 * @param {string} [opts.url]     hvor push/klik fører hen (default /notifikationer)
 */
export async function notify(supa, opts) {
  const {
    institutionId, institutionName, type, title, body = '', data = {},
    email, sendBell = true, sendEmail: doEmail = true, sendPush = true, emailHtml, url = '/notifikationer',
  } = opts;

  const inst = await resolveInstitution(supa, { institutionId, institutionName });
  const instId   = inst?.id   || institutionId   || null;
  const instName = inst?.name || institutionName || null;
  const toEmail  = email || inst?.email || null;

  const tasks = [];

  // 1. Klokken — sæt ALTID begge nøgler, så RLS og klient-filter matcher.
  if (sendBell && (instId || instName)) {
    tasks.push(
      supa.from('notifications').insert({
        institution_id: instId,
        institution_name: instName,
        type: type || 'generic',
        title, body, data,
      }).then(({ error }) => { if (error) console.error('[notify] klokke-fejl:', error.message); })
    );
  }

  // 2. E-mail
  if (doEmail && toEmail) {
    const html = emailHtml || `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#16221C;font-size:20px;margin:0 0 12px">${title}</h2>
      <p style="color:#3A473D;font-size:14px;line-height:1.6;margin:0 0 20px">${body}</p>
      <a href="https://bytogleg.dk${url}" style="display:inline-block;background:#2A7D4F;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 24px;border-radius:99px">Åbn byt&amp;leg →</a>
    </div>`;
    tasks.push(sendEmail(toEmail, title, html));
  }

  // 3. Push — til alle brugere knyttet til institutionen.
  if (sendPush && inst) {
    tasks.push((async () => {
      const userIds = await institutionUserIds(supa, inst);
      await Promise.allSettled(userIds.map(uid => sendPushToUser(uid, { title, body, url })));
    })());
  }

  await Promise.allSettled(tasks);
}
