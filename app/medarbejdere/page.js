'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, PAPER, PAPER2, PAPER3, INK, INK2, INK3 } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { useApp } from '@/providers/AppProvider';
import { Spinner } from '@/components/ui';

const FONT = "'Sora', sans-serif";

export default function MedarbejderePage() {
  const router = useRouter();
  const { effectiveInstitution, showToast } = useApp();
  const ww = useWindowWidth();
  const isMobile = ww < 768;

  const [institution, setInstitution] = useState(effectiveInstitution || null);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [memberEmail, setMemberEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      let inst = effectiveInstitution || null;
      if (!inst) {
        const { data: { user } } = await db.auth.getUser();
        if (!user || cancelled) { setLoading(false); return; }
        const { data: own } = await db.from('institutions').select('*').ilike('email', user.email).maybeSingle();
        if (own) inst = own;
        else {
          const { data: mem } = await db.from('institution_members').select('role,institutions(*)').eq('email', user.email).maybeSingle();
          if (mem?.institutions) inst = { ...mem.institutions, _memberRole: mem.role };
        }
      }
      if (!inst || cancelled) { setLoading(false); return; }
      setInstitution(inst);
      if (inst.id) await fetchMembers(inst.id);
      if (!cancelled) setLoading(false);
    }
    boot();
    return () => { cancelled = true; };
  }, [effectiveInstitution?.id]);

  async function fetchMembers(instId) {
    const id = instId || institution?.id;
    if (!id) return;
    const [{ data: mems }, { data: invs }] = await Promise.all([
      db.from('institution_members').select('*').eq('institution_id', id).order('created_at'),
      db.from('institution_invitations').select('*').eq('institution_id', id).is('accepted_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
    ]);
    if (mems) setMembers(mems);
    if (invs) setInvitations(invs);
  }

  async function inviteMember() {
    const email = memberEmail.trim().toLowerCase();
    if (!email || !institution?.id) return;
    if (members.some(m => m.email.toLowerCase() === email)) { showToast('Denne e-mail er allerede tilknyttet institutionen', 'error'); return; }
    if (invitations.some(i => i.email.toLowerCase() === email)) { showToast('En invitation er allerede sendt til denne e-mail', 'error'); return; }
    setSaving(true);
    const { data: inv, error: invErr } = await db.from('institution_invitations').insert({
      institution_id: institution.id,
      institution_name: institution.name,
      email,
      invited_by: institution.name,
    }).select().single();
    if (invErr) { showToast('Noget gik galt', 'error'); setSaving(false); return; }
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: inv.token, email, institution_name: institution.name, invited_by: institution.name }),
    });
    setSaving(false);
    if (!res.ok) {
      await db.from('institution_invitations').delete().eq('id', inv.id);
      showToast('E-mail kunne ikke sendes — prøv igen', 'error');
      return;
    }
    setMemberEmail('');
    fetchMembers();
    showToast(`Invitation sendt til ${email} ✓`);
  }

  async function cancelInvitation(id) {
    await db.from('institution_invitations').delete().eq('id', id);
    setInvitations(is => is.filter(i => i.id !== id));
    showToast('Invitation annulleret');
  }

  async function removeMember(id) {
    await db.from('institution_members').delete().eq('id', id);
    setMembers(ms => ms.filter(m => m.id !== id));
    showToast('Medarbejder fjernet');
  }

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', background:'#F6F2EA', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F6F2EA', paddingTop:isMobile?60:80, paddingBottom:90 }}>
      <div style={{ maxWidth:540, margin:'0 auto' }}>

        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 16px 0' }}>
          <button onClick={() => router.push('/profil')} style={{ background:'none', border:'none', cursor:'pointer', padding:6, display:'flex', alignItems:'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <h1 style={{ fontFamily:FONT, fontWeight:800, fontSize:18, color:INK, margin:0, flex:1 }}>Medarbejdere</h1>
        </div>

        <div style={{ padding:'16px 16px 0', display:'flex', flexDirection:'column', gap:12 }}>

          {/* Invite */}
          <div style={{ background:'#fff', borderRadius:16, padding:'18px 16px', boxShadow:'0 1px 3px rgba(22,34,28,0.06)', border:`1px solid ${PAPER3}` }}>
            <div style={{ fontFamily:FONT, fontWeight:700, fontSize:14, color:INK, marginBottom:4 }}>Inviter medarbejder</div>
            <div style={{ fontSize:13, color:INK3, marginBottom:14, lineHeight:1.5 }}>
              Medarbejderen modtager en invitation på e-mail og opretter selv sin konto.
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <input
                value={memberEmail}
                onChange={e => setMemberEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && inviteMember()}
                placeholder="medarbejder@institution.dk"
                type="email"
                style={{ flex:1, padding:'11px 14px', borderRadius:12, border:`1.5px solid ${PAPER3}`, fontSize:14, outline:'none', fontFamily:FONT, background:'#fff', color:INK, boxSizing:'border-box' }}
              />
              <button onClick={inviteMember} disabled={saving || !memberEmail.trim()}
                style={{ padding:'11px 18px', borderRadius:12, background: saving || !memberEmail.trim() ? PAPER3 : PRIMARY, color: saving || !memberEmail.trim() ? INK3 : '#fff', border:'none', fontFamily:FONT, fontWeight:700, fontSize:13, cursor: saving || !memberEmail.trim() ? 'not-allowed' : 'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:6 }}>
                {saving ? <Spinner /> : 'Send invitation'}
              </button>
            </div>
          </div>

          {/* Pending invitations */}
          {invitations.length > 0 && (
            <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 3px rgba(22,34,28,0.06)', border:`1px solid ${PAPER3}` }}>
              <div style={{ padding:'14px 16px 8px', fontFamily:FONT, fontSize:12, fontWeight:700, color:INK3, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                Afventer svar ({invitations.length})
              </div>
              {invitations.map((inv, i) => (
                <div key={inv.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderTop: i > 0 ? `1px solid ${PAPER3}` : 'none' }}>
                  <div style={{ width:38, height:38, borderRadius:'50%', background:'#FFFBEB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color:'#B45309', flexShrink:0, fontFamily:FONT }}>
                    {inv.email.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:FONT, color:INK }}>{inv.email}</div>
                    <div style={{ fontSize:11, color:'#B45309', marginTop:2, fontFamily:FONT, fontWeight:600 }}>
                      Invitation sendt · udløber {new Date(inv.expires_at).toLocaleDateString('da-DK', { day:'numeric', month:'short' })}
                    </div>
                  </div>
                  <button onClick={() => cancelInvitation(inv.id)}
                    style={{ background:'#FEF2F2', border:'none', borderRadius:99, padding:'5px 12px', fontSize:12, fontWeight:700, color:'#e11d48', cursor:'pointer', fontFamily:FONT, flexShrink:0 }}>
                    Annuller
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Active members */}
          <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 3px rgba(22,34,28,0.06)', border:`1px solid ${PAPER3}` }}>
            <div style={{ padding:'14px 16px 8px', fontFamily:FONT, fontSize:12, fontWeight:700, color:INK3, textTransform:'uppercase', letterSpacing:'0.06em' }}>
              Aktive medarbejdere ({members.length})
            </div>
            {members.length === 0 ? (
              <div style={{ textAlign:'center', padding:'28px 20px', fontFamily:FONT, fontSize:13, color:INK3 }}>
                Ingen aktive medarbejdere endnu
              </div>
            ) : members.map((m, i) => (
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderTop: i > 0 ? `1px solid ${PAPER3}` : 'none' }}>
                <div style={{ width:38, height:38, borderRadius:'50%', background:GREEN_TINT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color:PRIMARY, flexShrink:0, fontFamily:FONT }}>
                  {m.email.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:FONT, color:INK }}>{m.email}</div>
                  <div style={{ fontSize:11, color:INK3, marginTop:1, fontFamily:FONT }}>
                    Medarbejder · Tilmeldt {new Date(m.created_at).toLocaleDateString('da-DK')}
                  </div>
                </div>
                <button onClick={() => removeMember(m.id)}
                  style={{ background:'#FEF2F2', border:'none', borderRadius:99, padding:'6px 12px', fontSize:12, fontWeight:700, color:'#e11d48', cursor:'pointer', fontFamily:FONT, flexShrink:0 }}>
                  Fjern
                </button>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
