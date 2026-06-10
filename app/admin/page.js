'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { checkIsAdmin } from '@/lib/admin';
import {
  PRIMARY, GREEN_SOFT, GREEN_TINT,
  PAPER, PAPER2, PAPER3,
  INK, INK2, INK3,
  CORAL, SKY,
} from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';

const FONT = "'Sora', sans-serif";

function IconBuilding() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 22V12h6v10"/><path d="M3 9h18"/></svg>;
}
function IconList() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
}
function IconActivity() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
}
function IconSearch() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}
function IconEye() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function IconTrash() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
}
function IconToggle({ on }) {
  return on
    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
}
function IconUsers() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
}
function IconTag() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
}
function IconMail() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
}
function IconChevron({ open }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>;
}
function IconLogout() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
}

function Stat({ label, value, color = PRIMARY, icon }) {
  return (
    <div style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.08)`, borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: INK3, fontSize: 13, fontFamily: FONT, fontWeight: 600 }}>
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 32, color: value > 0 ? color : INK3, letterSpacing: '-0.04em', lineHeight: 1 }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

const TABS = [
  { id: 'overview',      label: 'Overblik',      Icon: IconActivity },
  { id: 'institutions',  label: 'Institutioner', Icon: IconBuilding },
  { id: 'listings',      label: 'Opslag',         Icon: IconList },
  { id: 'shipping',      label: 'Forsendelser',   Icon: () => <span style={{ fontSize:16 }}>📦</span> },
];

// ── Login form ────────────────────────────────────────────────────────────────

function LoginForm({ email, setEmail, password, setPassword, onSubmit, error, loading }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0F1F17', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M4.93 4.93a10 10 0 000 14.14"/></svg>
            </div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: '-0.04em' }}>byt&amp;leg admin</div>
            <div style={{ fontFamily: FONT, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Intern administration</div>
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontFamily: FONT, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@bytogleg.dk"
              autoComplete="email"
              required
              style={{ width: '100%', padding: '13px 16px', background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#fff', fontFamily: FONT, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: FONT, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Kodeord</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              style={{ width: '100%', padding: '13px 16px', background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#fff', fontFamily: FONT, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {error && (
            <div style={{ fontFamily: FONT, fontSize: 13, color: '#EF4444', textAlign: 'center', background: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: '10px 14px' }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: 4, padding: '14px', borderRadius: 12, background: PRIMARY, border: 'none', color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Logger ind…' : 'Log ind'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Admin page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authState, setAuthState] = useState('checking');
  const [adminUser, setAdminUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [tab, setTab] = useState('overview');
  const [allInstitutions, setAllInstitutions] = useState([]);
  const [adminInst, setAdminInst] = useState(null);
  const w = useWindowWidth();
  const isMobile = w < 768;

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    const { data: { session } } = await db.auth.getSession();
    if (!session?.user) { setAuthState('login'); return; }
    const isAdm = await checkIsAdmin(session.user.id);
    if (isAdm) {
      setAdminUser(session.user);
      setAuthState('authenticated');
      fetchInstitutions();
    } else {
      setAuthState('denied');
    }
  }

  async function fetchInstitutions() {
    const { data } = await db.from('institutions').select('*').order('name');
    if (data) setAllInstitutions(data);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
      setLoginError('Forkert e-mail eller kodeord');
      setLoginLoading(false);
      return;
    }
    const isAdm = await checkIsAdmin(data.user.id);
    if (!isAdm) {
      await db.auth.signOut();
      setLoginError('Denne konto har ikke admin-adgang');
      setLoginLoading(false);
      return;
    }
    setAdminUser(data.user);
    setAuthState('authenticated');
    fetchInstitutions();
    setLoginLoading(false);
  }

  async function handleLogout() {
    await db.auth.signOut();
    setAuthState('login');
    setAdminUser(null);
    setAllInstitutions([]);
    setAdminInst(null);
    setEmail('');
    setPassword('');
  }

  if (authState === 'checking') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F1F17' }}>
        <span style={{ fontFamily: FONT, color: 'rgba(255,255,255,0.4)', fontSize: 15 }}>Kontrollerer adgang…</span>
      </div>
    );
  }

  if (authState === 'denied') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0F1F17', gap: 12 }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: '#EF4444' }}>Ingen adgang</div>
        <div style={{ fontFamily: FONT, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>Denne konto er ikke administrator</div>
        <button
          onClick={async () => { await db.auth.signOut(); setAuthState('login'); }}
          style={{ marginTop: 8, padding: '10px 24px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          Prøv igen
        </button>
      </div>
    );
  }

  if (authState === 'login') {
    return (
      <LoginForm
        email={email} setEmail={setEmail}
        password={password} setPassword={setPassword}
        onSubmit={handleLogin}
        error={loginError}
        loading={loginLoading}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: PAPER }}>
      {/* Admin header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: '#0F1F17', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 16px' : '0 28px', height: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14"/><path d="M4.93 4.93a10 10 0 000 14.14"/></svg>
          </div>
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.2 }}>byt&amp;leg admin</div>
            {adminUser && <div style={{ fontFamily: FONT, fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.2 }}>{adminUser.email}</div>}
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: isMobile ? '7px 10px' : '7px 14px', fontFamily: FONT, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <IconLogout />
          {!isMobile && 'Log ud'}
        </button>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '0 16px 32px' : '0 24px 32px' }}>
        <div style={{ padding: isMobile ? '20px 0 16px' : '28px 0 20px' }}>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 22 : 26, color: INK, margin: 0, letterSpacing: '-0.04em' }}>Platform admin</h1>
          <p style={{ fontFamily: FONT, fontSize: 12, color: INK3, margin: '4px 0 0' }}>byt&amp;leg intern administration</p>
        </div>

        {adminInst && (
          <div style={{ background: PRIMARY, borderRadius: 12, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconEye />
              Agerer som: <span style={{ fontWeight: 800 }}>{adminInst.name}</span>
            </div>
            <button onClick={() => setAdminInst(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 8, padding: '5px 12px', fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              Stop
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${PAPER3}`, marginBottom: 24, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} style={{ background: 'none', border: 'none', borderBottom: tab === id ? `2.5px solid ${PRIMARY}` : '2.5px solid transparent', padding: isMobile ? '10px 14px' : '10px 18px', fontFamily: FONT, fontWeight: tab === id ? 700 : 600, fontSize: 13, color: tab === id ? PRIMARY : INK3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderRadius: '8px 8px 0 0', transition: 'color 0.15s', marginBottom: -1, whiteSpace: 'nowrap', flexShrink: 0 }}>
              <Icon /> {label}
            </button>
          ))}
        </div>

        {tab === 'overview'     && <OverviewTab institutions={allInstitutions} setAdminInst={setAdminInst} adminInst={adminInst} isMobile={isMobile} />}
        {tab === 'institutions' && <InstitutionsTab institutions={allInstitutions} setAdminInst={setAdminInst} adminInst={adminInst} isMobile={isMobile} />}
        {tab === 'listings'     && <ListingsTab allInstitutions={allInstitutions} isMobile={isMobile} />}
        {tab === 'shipping'     && <ShippingAdminRedirect />}
      </div>
    </div>
  );
}

// ── Shipping admin redirect ───────────────────────────────────────────────────
function ShippingAdminRedirect() {
  const router = useRouter();
  useEffect(() => { router.push('/admin/shipping'); }, []);
  return <div style={{ padding: 40, textAlign: 'center', color: INK3, fontFamily: FONT }}>Åbner forsendelsesadmin…</div>;
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ institutions, setAdminInst, adminInst, isMobile }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { count: instCount },
        { count: listCount },
        { count: activeCount },
        { count: memberCount },
        { count: invCount },
        { data: recentConvs },
      ] = await Promise.all([
        db.from('institutions').select('*', { count: 'exact', head: true }),
        db.from('listings').select('*', { count: 'exact', head: true }),
        db.from('listings').select('*', { count: 'exact', head: true }).eq('is_active', true),
        db.from('institution_members').select('*', { count: 'exact', head: true }),
        db.from('institution_invitations').select('*', { count: 'exact', head: true }).is('accepted_at', null).gt('expires_at', new Date().toISOString()),
        db.from('conversations').select('id,created_at,listing_id,listings(title),status').order('created_at', { ascending: false }).limit(6),
      ]);
      setStats({ instCount, listCount, activeCount, memberCount, invCount });
      setRecent(recentConvs || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
        <Stat label="Institutioner" value={stats.instCount} color={PRIMARY} icon={<IconBuilding />} />
        <Stat label="Alle opslag" value={stats.listCount} color={INK2} icon={<IconTag />} />
        <Stat label="Aktive opslag" value={stats.activeCount} color={PRIMARY} icon={<IconToggle on />} />
        <Stat label="Medarbejdere" value={stats.memberCount} color={SKY} icon={<IconUsers />} />
        <Stat label="Afventende inv." value={stats.invCount} color={CORAL} icon={<IconMail />} />
      </div>

      <SectionHead title="Seneste handler" />
      {recent.length === 0
        ? <Empty text="Ingen samtaler endnu" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 32 }}>
            {recent.map(c => (
              <div key={c.id} style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.07)`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.status === 'completed' ? PRIMARY : c.status === 'rejected' ? CORAL : PAPER3, flexShrink: 0 }} />
                <div style={{ flex: 1, fontFamily: FONT, fontSize: 13, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.listings?.title || 'Ukendt opslag'}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, flexShrink: 0 }}>
                  {new Date(c.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        )
      }

      <SectionHead title="Hurtig — agér som institution" />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
        {institutions.slice(0, 6).map(inst => (
          <InstCard key={inst.id} inst={inst} active={adminInst?.id === inst.id} onSelect={() => setAdminInst(adminInst?.id === inst.id ? null : inst)} />
        ))}
      </div>
    </div>
  );
}

// ── Institutions tab ─────────────────────────────────────────────────────────

function InstitutionsTab({ institutions, setAdminInst, adminInst, isMobile }) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState({});
  const [loadingId, setLoadingId] = useState(null);

  const filtered = institutions.filter(i =>
    !query || i.name?.toLowerCase().includes(query.toLowerCase()) ||
    i.city?.toLowerCase().includes(query.toLowerCase()) ||
    i.cvr?.includes(query)
  );

  async function toggleDetail(inst) {
    if (openId === inst.id) { setOpenId(null); return; }
    setOpenId(inst.id);
    if (detail[inst.id]) return;
    setLoadingId(inst.id);
    const [{ data: members }, { data: invitations }, { data: listings }] = await Promise.all([
      db.from('institution_members').select('*').eq('institution_id', inst.id),
      db.from('institution_invitations').select('*').eq('institution_id', inst.id).order('created_at', { ascending: false }),
      db.from('listings').select('id,title,is_active,type,created_at').eq('institution_id', inst.id).order('created_at', { ascending: false }),
    ]);
    setDetail(prev => ({ ...prev, [inst.id]: { members: members || [], invitations: invitations || [], listings: listings || [] } }));
    setLoadingId(null);
  }

  return (
    <div>
      <div style={{ position: 'relative', maxWidth: 400, marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: INK3, display: 'flex' }}><IconSearch /></span>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Søg på navn, by eller CVR…" style={{ width: '100%', padding: '10px 14px 10px 36px', border: `1.5px solid ${PAPER3}`, borderRadius: 10, fontFamily: FONT, fontSize: 14, background: PAPER2, color: INK, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginBottom: 12 }}>{filtered.length} institutioner</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0
          ? <Empty text="Ingen institutioner fundet" />
          : filtered.map(inst => {
            const isActive = adminInst?.id === inst.id;
            const isOpen = openId === inst.id;
            const d = detail[inst.id];

            return (
              <div key={inst.id} style={{ background: PAPER2, border: `1.5px solid ${isActive ? PRIMARY : 'rgba(22,34,28,0.08)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: isActive ? PRIMARY : GREEN_TINT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 14, color: isActive ? '#fff' : PRIMARY, flexShrink: 0, overflow: 'hidden' }}>
                    {inst.logo_url
                      ? <img src={inst.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : inst.name?.charAt(0)?.toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: isActive ? PRIMARY : INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.name}</div>
                    <div style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{[inst.city, inst.cvr].filter(Boolean).join(' · ') || '—'}</div>
                  </div>

                  <button
                    onClick={() => setAdminInst(isActive ? null : inst)}
                    style={{ flexShrink: 0, background: isActive ? PRIMARY : GREEN_TINT, border: 'none', color: isActive ? '#fff' : PRIMARY, borderRadius: 10, padding: '7px 14px', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}
                  >
                    <IconEye />
                    {isActive ? 'Stop' : 'Agér'}
                  </button>

                  <button onClick={() => toggleDetail(inst)} style={{ background: 'none', border: 'none', color: INK3, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                    <IconChevron open={isOpen} />
                  </button>
                </div>

                {isOpen && (
                  <div style={{ borderTop: `1px solid ${PAPER3}`, padding: '16px' }}>
                    {loadingId === inst.id
                      ? <Spinner small />
                      : d
                        ? <InstDetail detail={{ inst, ...d }} isMobile={isMobile} />
                        : null
                    }
                  </div>
                )}
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

function InstCard({ inst, active, onSelect }) {
  return (
    <div style={{ background: active ? GREEN_TINT : PAPER2, border: `1.5px solid ${active ? PRIMARY : 'rgba(22,34,28,0.08)'}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.15s' }} onClick={onSelect}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: active ? PRIMARY : PAPER3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 14, color: active ? '#fff' : INK3, flexShrink: 0 }}>
        {inst.name?.charAt(0)?.toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: active ? PRIMARY : INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inst.name}</div>
        <div style={{ fontFamily: FONT, fontSize: 11, color: INK3 }}>{inst.city || '—'}</div>
      </div>
      {active
        ? <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: PRIMARY, flexShrink: 0 }}>✓ Aktiv</span>
        : <span style={{ fontFamily: FONT, fontSize: 11, color: INK3, flexShrink: 0 }}>Vælg</span>
      }
    </div>
  );
}

function InstDetail({ detail, isMobile }) {
  const { inst, members, invitations, listings } = detail;
  const pendingInvs = (invitations || []).filter(i => !i.accepted_at && new Date(i.expires_at) > new Date());

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        <InfoItem label="E-mail" value={inst.email || '—'} />
        <InfoItem label="By" value={inst.city || '—'} />
        <InfoItem label="CVR" value={inst.cvr || '—'} />
        <InfoItem label="Type" value={inst.type || '—'} />
        <InfoItem label="Oprettet" value={inst.created_at ? new Date(inst.created_at).toLocaleDateString('da-DK') : '—'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        <div>
          <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: INK3, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Medarbejdere ({(members || []).length})</p>
          {(members || []).length === 0
            ? <Empty text="Ingen" small />
            : (members || []).map(m => (
              <div key={m.id} style={{ fontFamily: FONT, fontSize: 13, color: INK, padding: '6px 0', borderBottom: `1px solid ${PAPER3}`, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{m.email}</span>
                <span style={{ fontSize: 11, color: INK3, fontWeight: 600, flexShrink: 0 }}>{m.role}</span>
              </div>
            ))
          }
          {pendingInvs.length > 0 && (
            <>
              <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: CORAL, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '12px 0 8px' }}>Afventer ({pendingInvs.length})</p>
              {pendingInvs.map(inv => (
                <div key={inv.id} style={{ fontFamily: FONT, fontSize: 13, color: INK3, padding: '6px 0', borderBottom: `1px solid ${PAPER3}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</div>
              ))}
            </>
          )}
        </div>
        <div>
          <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: INK3, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Opslag ({(listings || []).length})</p>
          {(listings || []).length === 0
            ? <Empty text="Ingen" small />
            : (listings || []).slice(0, 8).map(l => (
              <div key={l.id} style={{ fontFamily: FONT, fontSize: 13, color: INK, padding: '6px 0', borderBottom: `1px solid ${PAPER3}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{l.title}</span>
                <span style={{ fontSize: 11, background: l.is_active ? GREEN_TINT : PAPER3, color: l.is_active ? PRIMARY : INK3, fontWeight: 700, padding: '2px 8px', borderRadius: 99, flexShrink: 0 }}>{l.is_active ? 'Aktiv' : 'Inaktiv'}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: INK3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: FONT, fontSize: 13, color: INK }}>{value}</div>
    </div>
  );
}

// ── Listings tab ─────────────────────────────────────────────────────────────

function EditListingModal({ listing, onClose, onSave }) {
  const [form, setForm] = useState({
    title: listing.title || '',
    description: listing.description || '',
    price: listing.price || '',
    condition: listing.condition || '',
    is_active: listing.is_active,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const update = { title: form.title, description: form.description, price: form.price ? Number(form.price) : null, condition: form.condition, is_active: form.is_active };
    await db.from('listings').update(update).eq('id', listing.id);
    setSaving(false);
    onSave({ id: listing.id, ...update });
  }

  const inp = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #DAD3C4', fontSize: 14, fontFamily: FONT, outline: 'none', boxSizing: 'border-box', background: '#fff' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(22,34,28,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 520, width: '100%', boxShadow: '0 20px 60px rgba(22,34,28,0.2)' }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: INK, marginBottom: 18 }}>Rediger opslag</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={{ display: 'block', fontFamily: FONT, fontWeight: 700, fontSize: 11, color: INK3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Titel</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inp} /></div>
          <div><label style={{ display: 'block', fontFamily: FONT, fontWeight: 700, fontSize: 11, color: INK3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Beskrivelse</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
          <div><label style={{ display: 'block', fontFamily: FONT, fontWeight: 700, fontSize: 11, color: INK3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Pris (kr.)</label><input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} style={inp} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="active-toggle" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: 18, height: 18, cursor: 'pointer', accentColor: PRIMARY }} />
            <label htmlFor="active-toggle" style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: INK, cursor: 'pointer' }}>Opslag er aktivt</label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 99, background: PAPER2, border: 'none', fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK2, cursor: 'pointer' }}>Annuller</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 99, background: PRIMARY, border: 'none', fontFamily: FONT, fontWeight: 700, fontSize: 14, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Gemmer…' : 'Gem ændringer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ListingsTab({ allInstitutions = [], isMobile }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [editing, setEditing] = useState(null);

  const instMap = Object.fromEntries(allInstitutions.map(i => [i.id, i.name]));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await db.from('listings').select('id,title,type,is_active,created_at,institution_id').order('created_at', { ascending: false });
    setListings(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function toggleActive(id, current) {
    await db.from('listings').update({ is_active: !current }).eq('id', id);
    setListings(prev => prev.map(l => l.id === id ? { ...l, is_active: !current } : l));
  }

  async function deleteListing(id) {
    await db.from('listings').delete().eq('id', id);
    setListings(prev => prev.filter(l => l.id !== id));
    setConfirm(null);
  }

  const filtered = listings.filter(l => {
    if (filterType && l.type !== filterType) return false;
    if (filterActive === 'active' && !l.is_active) return false;
    if (filterActive === 'inactive' && l.is_active) return false;
    if (query && !l.title?.toLowerCase().includes(query.toLowerCase()) && !(instMap[l.institution_id] || '').toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: INK3, display: 'flex' }}><IconSearch /></span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Søg…" style={{ width: '100%', padding: '10px 12px 10px 34px', border: `1.5px solid ${PAPER3}`, borderRadius: 10, fontFamily: FONT, fontSize: 14, background: PAPER2, color: INK, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '10px 12px', border: `1.5px solid ${PAPER3}`, borderRadius: 10, fontFamily: FONT, fontSize: 13, background: PAPER2, color: INK, outline: 'none', cursor: 'pointer' }}>
          <option value="">Alle typer</option>
          <option value="køb">Køb</option>
          <option value="byd">Byd</option>
          <option value="byt">Byt</option>
        </select>
        <select value={filterActive} onChange={e => setFilterActive(e.target.value)} style={{ padding: '10px 12px', border: `1.5px solid ${PAPER3}`, borderRadius: 10, fontFamily: FONT, fontSize: 13, background: PAPER2, color: INK, outline: 'none', cursor: 'pointer' }}>
          <option value="">Alle statusser</option>
          <option value="active">Aktive</option>
          <option value="inactive">Inaktive</option>
        </select>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginBottom: 10 }}>Viser {filtered.length} af {listings.length} opslag</div>

          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.length === 0
                ? <Empty text="Ingen opslag fundet" />
                : filtered.map(l => (
                  <div key={l.id} style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.08)`, borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
                        <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginTop: 2 }}>{instMap[l.institution_id] || '—'}</div>
                      </div>
                      <span style={{ background: l.is_active ? GREEN_TINT : PAPER3, color: l.is_active ? PRIMARY : INK3, fontWeight: 700, fontSize: 11, padding: '3px 10px', borderRadius: 99, flexShrink: 0 }}>
                        {l.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <TypeBadge type={l.type} />
                      <span style={{ fontFamily: FONT, fontSize: 11, color: INK3 }}>{new Date(l.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <button onClick={() => toggleActive(l.id, l.is_active)} style={{ background: l.is_active ? PAPER3 : GREEN_TINT, border: 'none', color: l.is_active ? INK3 : PRIMARY, borderRadius: 7, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <IconToggle on={!l.is_active} />
                        </button>
                        <button onClick={() => setEditing(l)} style={{ background: GREEN_TINT, border: 'none', color: PRIMARY, borderRadius: 7, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => setConfirm(l.id)} style={{ background: '#FEF2F2', border: 'none', color: '#EF4444', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <IconTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          ) : (
            <div style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.08)`, borderRadius: 16, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${PAPER3}` }}>
                    {['Titel', 'Institution', 'Type', 'Status', 'Oprettet', ''].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: INK3, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={6} style={{ padding: '28px 16px', textAlign: 'center', color: INK3 }}>Ingen opslag fundet</td></tr>
                    : filtered.map((l, i) => (
                      <tr key={l.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${PAPER3}` : 'none' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: INK, maxWidth: 220 }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</span>
                        </td>
                        <td style={{ padding: '12px 16px', color: INK2 }}>{instMap[l.institution_id] || '—'}</td>
                        <td style={{ padding: '12px 16px' }}><TypeBadge type={l.type} /></td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: l.is_active ? GREEN_TINT : PAPER3, color: l.is_active ? PRIMARY : INK3, fontWeight: 700, fontSize: 12, padding: '3px 10px', borderRadius: 99 }}>{l.is_active ? 'Aktiv' : 'Inaktiv'}</span>
                        </td>
                        <td style={{ padding: '12px 16px', color: INK3 }}>{new Date(l.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => toggleActive(l.id, l.is_active)} style={{ background: l.is_active ? PAPER3 : GREEN_TINT, border: 'none', color: l.is_active ? INK3 : PRIMARY, borderRadius: 7, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><IconToggle on={!l.is_active} /></button>
                            <button onClick={() => setEditing(l)} style={{ background: GREEN_TINT, border: 'none', color: PRIMARY, borderRadius: 7, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button onClick={() => setConfirm(l.id)} style={{ background: '#FEF2F2', border: 'none', color: '#EF4444', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><IconTrash /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,34,28,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 20 }}>
          <div style={{ background: PAPER2, borderRadius: 20, padding: '28px 24px', maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(22,34,28,0.25)', textAlign: 'center' }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: INK, marginBottom: 10 }}>Slet opslag?</div>
            <p style={{ fontFamily: FONT, fontSize: 14, color: INK3, marginBottom: 22 }}>Dette kan ikke fortrydes. Alle tilknyttede samtaler vil også blive slettet.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirm(null)} style={{ flex: 1, padding: '11px', borderRadius: 99, border: `1.5px solid ${PAPER3}`, background: PAPER2, fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK2, cursor: 'pointer' }}>Annuller</button>
              <button onClick={() => deleteListing(confirm)} style={{ flex: 1, padding: '11px', borderRadius: 99, border: 'none', background: CORAL, fontFamily: FONT, fontWeight: 700, fontSize: 14, color: '#fff', cursor: 'pointer' }}>Slet</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <EditListingModal listing={editing} onClose={() => setEditing(null)} onSave={updated => {
          setListings(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l));
          setEditing(null);
        }} />
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function SectionHead({ title }) {
  return <h3 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: INK2, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</h3>;
}

function Spinner({ small }) {
  return <div style={{ padding: small ? '16px 0' : '40px 0', textAlign: 'center', fontFamily: FONT, color: INK3, fontSize: 13 }}>Indlæser…</div>;
}

function Empty({ text, small }) {
  return <div style={{ fontFamily: FONT, fontSize: small ? 12 : 14, color: INK3, padding: small ? '6px 0' : '20px 0' }}>{text}</div>;
}

function StatusBadge({ status }) {
  const map = {
    completed: { label: 'Afsluttet', bg: GREEN_TINT, color: PRIMARY },
    rejected:  { label: 'Afvist',    bg: '#FEF2F2', color: '#EF4444' },
    active:    { label: 'Aktiv',     bg: PAPER3,    color: INK2 },
  };
  const s = map[status] || { label: status || 'Ukendt', bg: PAPER3, color: INK3 };
  return <span style={{ background: s.bg, color: s.color, fontFamily: FONT, fontWeight: 700, fontSize: 11, padding: '3px 10px', borderRadius: 99 }}>{s.label}</span>;
}

function TypeBadge({ type }) {
  const map = { køb: { label: 'Køb', bg: GREEN_TINT, color: PRIMARY }, byd: { label: 'Byd', bg: '#E6EEF7', color: SKY }, byt: { label: 'Byt', bg: '#FCEAE6', color: CORAL } };
  const s = map[type] || { label: type, bg: PAPER3, color: INK3 };
  return <span style={{ background: s.bg, color: s.color, fontFamily: FONT, fontWeight: 700, fontSize: 12, padding: '3px 10px', borderRadius: 99 }}>{s.label}</span>;
}
