'use client';
import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/supabase';
import {
  PRIMARY, GREEN_SOFT, GREEN_TINT, GREEN_DEEP,
  PAPER, PAPER2, PAPER3,
  INK, INK2, INK3,
  CORAL, SKY,
  FONT,
} from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import AdminListingEditModal from '@/components/AdminListingEditModal';

// ── Shared small components ────────────────────────────────────────────────────

function Spinner({ small }) {
  return <div style={{ padding: small ? '16px 0' : '40px 0', textAlign: 'center', fontFamily: FONT, color: INK3, fontSize: 13 }}>Indlæser…</div>;
}

function Empty({ text, small }) {
  return <div style={{ fontFamily: FONT, fontSize: small ? 12 : 14, color: INK3, padding: small ? '6px 0' : '20px 0' }}>{text}</div>;
}

function SectionHead({ title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 12px' }}>
      <h3 style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: INK2, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</h3>
      {action}
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

function Badge({ bg, color, children, border }) {
  return (
    <span style={{ background: bg, color, border: border ? `1px solid ${border}` : 'none', padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, fontFamily: FONT, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

const ORDER_STATUS_CFG = {
  pending:   { bg: '#FEF9C3', color: '#92400E', label: 'Afventer' },
  paid:      { bg: '#DBEAFE', color: '#1E40AF', label: 'Betalt' },
  shipped:   { bg: '#FFEDD5', color: '#9A3412', label: 'Sendt' },
  delivered: { bg: '#D1FAE5', color: '#065F46', label: 'Leveret' },
  refunded:  { bg: '#FEE2E2', color: '#991B1B', label: 'Refunderet' },
};

function OrderStatusBadge({ status }) {
  const c = ORDER_STATUS_CFG[status] || { bg: PAPER3, color: INK3, label: status || '—' };
  return <Badge bg={c.bg} color={c.color}>{c.label}</Badge>;
}

const SHIPMENT_STATUS_CFG = {
  pending:    { bg: '#FEF9C3', color: '#92400E', label: 'Afventer' },
  booked:     { bg: '#DBEAFE', color: '#1E40AF', label: 'Booket' },
  printed:    { bg: '#E0E7FF', color: '#3730A3', label: 'Printet' },
  in_transit: { bg: '#FFEDD5', color: '#9A3412', label: 'Undervejs' },
  delivered:  { bg: '#D1FAE5', color: '#065F46', label: 'Leveret' },
  failed:     { bg: '#FEE2E2', color: '#991B1B', label: 'Fejlet' },
  cancelled:  { bg: PAPER3, color: INK3, label: 'Annulleret' },
};

const INVOICE_STATUS_CFG = {
  draft:     { bg: PAPER3, color: INK3, label: 'Kladde' },
  sent:      { bg: '#DBEAFE', color: '#1E40AF', label: 'Sendt' },
  paid:      { bg: '#D1FAE5', color: '#065F46', label: 'Betalt' },
  overdue:   { bg: '#FEE2E2', color: '#991B1B', label: 'Forfalden' },
  cancelled: { bg: PAPER3, color: INK3, label: 'Annulleret' },
};

function TypeBadge({ type }) {
  const map = {
    'sælges': { label: 'Sælges', bg: GREEN_TINT, color: PRIMARY },
    'søges':  { label: 'Søges', bg: '#F5F0FF', color: '#7C3AED' },
    'byttes': { label: 'Byttes', bg: '#FCEAE6', color: CORAL },
    køb:      { label: 'Køb', bg: GREEN_TINT, color: PRIMARY },
    byd:      { label: 'Byd', bg: '#E6EEF7', color: SKY },
    byt:      { label: 'Byt', bg: '#FCEAE6', color: CORAL },
  };
  const s = map[type] || { label: type || '—', bg: PAPER3, color: INK3 };
  return <Badge bg={s.bg} color={s.color}>{s.label}</Badge>;
}

function Stat({ label, sub, value, color = PRIMARY }) {
  return (
    <div style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.08)`, borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ color: INK3, fontSize: 12, fontFamily: FONT, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: value > 0 ? color : INK3, letterSpacing: '-0.04em', lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ color: INK3, fontSize: 11, fontFamily: FONT }}>{sub}</div>}
    </div>
  );
}

function fmtDate(iso, withTime) {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
  if (!withTime) return date;
  return date + ' · ' + d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}

function fmtKr(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(n);
}

// Auth helper for API calls
async function authHeaders() {
  const { data: { session } } = await db.auth.getSession();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` };
}

// ── Tabs definition ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',     label: 'Overblik',      emoji: '📊' },
  { id: 'approvals',    label: 'Godkendelser',  emoji: '✅' },
  { id: 'institutions', label: 'Institutioner', emoji: '🏫' },
  { id: 'listings',     label: 'Opslag',        emoji: '📋' },
  { id: 'orders',       label: 'Handler',       emoji: '🛒' },
  { id: 'shipping',     label: 'Forsendelser',  emoji: '🚚' },
  { id: 'feedback',     label: 'Feedback',      emoji: '🐛' },
  { id: 'users',        label: 'Brugere',       emoji: '👥' },
  { id: 'economy',      label: 'Økonomi',       emoji: '💰' },
  { id: 'log',          label: 'Log',           emoji: '📝' },
  { id: 'ai-bot',       label: 'AI Bot',        emoji: '🤖' },
];

// ── Login form ──────────────────────────────────────────────────────────────────

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
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@bytogleg.dk" autoComplete="email" required
              style={{ width: '100%', padding: '13px 16px', background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#fff', fontFamily: FONT, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontFamily: FONT, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Kodeord</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" required
              style={{ width: '100%', padding: '13px 16px', background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#fff', fontFamily: FONT, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {error && (
            <div style={{ fontFamily: FONT, fontSize: 13, color: '#EF4444', textAlign: 'center', background: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: '10px 14px' }}>{error}</div>
          )}
          <button type="submit" disabled={loading}
            style={{ marginTop: 4, padding: '14px', borderRadius: 12, background: PRIMARY, border: 'none', color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Logger ind…' : 'Log ind'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Admin page (auth shell) ─────────────────────────────────────────────────────

export default function AdminPage() {
  const [authState, setAuthState] = useState('checking');
  const [adminUser, setAdminUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [tab, setTab] = useState('overview');
  const [allInstitutions, setAllInstitutions] = useState([]);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [feedbackNewCount, setFeedbackNewCount] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const w = useWindowWidth();
  const isMobile = w < 768;

  useEffect(() => { checkAuth(); }, []);

  useEffect(() => {
    if (authState !== 'authenticated') return;
    async function fetchCounts() {
      const [{ count: approvals }, { count: newFb }, { count: pendingReviews }] = await Promise.all([
        db.from('institutions').select('id', { count: 'exact', head: true }).eq('is_approved', false),
        db.from('feedback').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        db.from('listings').select('id', { count: 'exact', head: true }).eq('review_status', 'pending'),
      ]);
      setPendingApprovalCount(approvals || 0);
      setFeedbackNewCount(newFb || 0);
      setPendingReviewCount(pendingReviews || 0);
    }
    fetchCounts();
  }, [authState]);

  async function checkAuth() {
    const { data: { session } } = await db.auth.getSession();
    if (!session?.user) { setAuthState('login'); return; }
    const { data: adminRow } = await db.from('admins').select('id').eq('user_id', session.user.id).maybeSingle();
    if (adminRow) {
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
    const { data: adminRow } = await db.from('admins').select('id').eq('user_id', data.user.id).maybeSingle();
    if (!adminRow) {
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
        <button onClick={async () => { await db.auth.signOut(); setAuthState('login'); }}
          style={{ marginTop: 8, padding: '10px 24px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, fontFamily: FONT, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
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
        onSubmit={handleLogin} error={loginError} loading={loginLoading}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: PAPER }}>
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
        <button onClick={handleLogout}
          style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: isMobile ? '7px 10px' : '7px 14px', fontFamily: FONT, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          {!isMobile && 'Log ud'}
        </button>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '0 16px 32px' : '0 24px 32px' }}>
        <div style={{ padding: isMobile ? '20px 0 16px' : '28px 0 20px' }}>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 22 : 26, color: INK, margin: 0, letterSpacing: '-0.04em' }}>Platform admin</h1>
          <p style={{ fontFamily: FONT, fontSize: 12, color: INK3, margin: '4px 0 0' }}>byt&amp;leg intern administration</p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, rowGap: 2, borderBottom: `1px solid ${PAPER3}`, marginBottom: 24 }}>
          {TABS.map(({ id, label, emoji }) => (
            <button key={id} onClick={() => setTab(id)} style={{ background: 'none', border: 'none', borderBottom: tab === id ? `2.5px solid ${PRIMARY}` : '2.5px solid transparent', padding: isMobile ? '10px 12px' : '10px 16px', fontFamily: FONT, fontWeight: tab === id ? 700 : 600, fontSize: 13, color: tab === id ? PRIMARY : INK3, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderRadius: '8px 8px 0 0', transition: 'color 0.15s', marginBottom: -1, whiteSpace: 'nowrap', flexShrink: 0 }}>
              <span style={{ fontSize: 15 }}>{emoji}</span> {label}
              {id === 'approvals' && pendingApprovalCount > 0 && (
                <span style={{ background: '#EF476F', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{pendingApprovalCount}</span>
              )}
              {id === 'feedback' && feedbackNewCount > 0 && (
                <span style={{ background: '#EF476F', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{feedbackNewCount}</span>
              )}
              {id === 'listings' && pendingReviewCount > 0 && (
                <span style={{ background: '#F59E0B', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{pendingReviewCount}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'overview'     && <OverviewTab isMobile={isMobile} onGoTo={setTab} />}
        {tab === 'approvals'    && <ApprovalsTab isMobile={isMobile} onCountChange={setPendingApprovalCount} />}
        {tab === 'institutions' && <InstitutionsTab institutions={allInstitutions} refresh={fetchInstitutions} isMobile={isMobile} />}
        {tab === 'listings'     && <ListingsTab allInstitutions={allInstitutions} isMobile={isMobile} />}
        {tab === 'orders'       && <OrdersTab isMobile={isMobile} />}
        {tab === 'shipping'     && <ShippingTab isMobile={isMobile} />}
        {tab === 'feedback'     && <FeedbackTab isMobile={isMobile} onNewCountChange={setFeedbackNewCount} />}
        {tab === 'users'        && <UsersTab isMobile={isMobile} />}
        {tab === 'economy'      && <EconomyTab isMobile={isMobile} />}
        {tab === 'log'          && <LogTab isMobile={isMobile} />}
        {tab === 'ai-bot'       && <AiBotTab isMobile={isMobile} />}
      </div>
    </div>
  );
}

// ── SECTION 1: Overview ─────────────────────────────────────────────────────────

function OverviewTab({ isMobile, onGoTo }) {
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [supaOk, setSupaOk] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { count: instTotal }, { count: instApproved }, { count: instPending },
        { count: listTotal }, { count: listActive }, { count: listSold },
        { count: orderTotal }, { count: orderPaid }, { count: orderPending },
        { count: fbTotal }, { count: fbNew },
        { count: shipFailed },
        { data: orders }, { data: feedback }, { data: probe },
      ] = await Promise.all([
        db.from('institutions').select('id', { count: 'exact', head: true }),
        db.from('institutions').select('id', { count: 'exact', head: true }).eq('is_approved', true),
        db.from('institutions').select('id', { count: 'exact', head: true }).eq('is_approved', false),
        db.from('listings').select('id', { count: 'exact', head: true }),
        db.from('listings').select('id', { count: 'exact', head: true }).eq('is_active', true),
        db.from('listings').select('id', { count: 'exact', head: true }).eq('is_sold', true),
        db.from('orders').select('id', { count: 'exact', head: true }),
        db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
        db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        db.from('feedback').select('id', { count: 'exact', head: true }),
        db.from('feedback').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        db.from('shipments').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
        db.from('orders').select('id,buyer_name,buyer_email,grand_total,status,created_at').order('created_at', { ascending: false }).limit(5),
        db.from('feedback').select('id,category,message,institution_name,user_email,status,created_at').order('created_at', { ascending: false }).limit(3),
        db.from('admins').select('id').limit(1),
      ]);
      setStats({ instTotal, instApproved, instPending, listTotal, listActive, listSold, orderTotal, orderPaid, orderPending, fbTotal, fbNew, shipFailed });
      setRecentOrders(orders || []);
      setRecentFeedback(feedback || []);
      setSupaOk(probe != null);
      setLoading(false);
    }
    load().catch(() => { setSupaOk(false); setLoading(false); });
  }, []);

  if (loading) return <Spinner />;

  const catEmoji = { bug: '🐛', suggestion: '💡', general: '⭐' };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        <Stat label="Institutioner" value={stats.instTotal} sub={`${stats.instApproved} godkendt · ${stats.instPending} afventer`} color={PRIMARY} />
        <Stat label="Opslag" value={stats.listTotal} sub={`${stats.listActive} aktive · ${stats.listSold} solgte`} color={INK2} />
        <Stat label="Handler" value={stats.orderTotal} sub={`${stats.orderPaid} betalt · ${stats.orderPending} afventer`} color={SKY} />
        <Stat label="Feedback" value={stats.fbTotal} sub={`${stats.fbNew} nye`} color={stats.fbNew > 0 ? CORAL : INK2} />
      </div>

      {stats.shipFailed > 0 && (
        <div onClick={() => onGoTo('shipping')} style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '12px 16px', marginBottom: 24, color: '#991B1B', fontFamily: FONT, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          ⚠️ {stats.shipFailed} fejlede forsendelse{stats.shipFailed !== 1 ? 'r' : ''} — klik for at se
        </div>
      )}

      <SectionHead title="Seneste handler" action={<button onClick={() => onGoTo('orders')} style={{ background: 'none', border: 'none', color: PRIMARY, fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Se alle →</button>} />
      {recentOrders.length === 0 ? <Empty text="Ingen handler endnu" /> : (
        <div style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.08)`, borderRadius: 14, overflow: 'hidden', marginBottom: 28 }}>
          {recentOrders.map((o, i) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < recentOrders.length - 1 ? `1px solid ${PAPER3}` : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.buyer_name || o.buyer_email || 'Ukendt køber'}</div>
                <div style={{ fontFamily: FONT, fontSize: 11, color: INK3 }}>{fmtDate(o.created_at)}</div>
              </div>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: INK, flexShrink: 0 }}>{fmtKr(o.grand_total)}</div>
              <OrderStatusBadge status={o.status} />
            </div>
          ))}
        </div>
      )}

      <SectionHead title="Ny feedback" action={<button onClick={() => onGoTo('feedback')} style={{ background: 'none', border: 'none', color: PRIMARY, fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Se alle →</button>} />
      {recentFeedback.length === 0 ? <Empty text="Ingen feedback endnu" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
          {recentFeedback.map(f => (
            <div key={f.id} style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.08)`, borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18 }}>{catEmoji[f.category] || '⭐'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 12, color: INK }}>{f.institution_name || f.user_email || 'Anonym'}</div>
                <div style={{ fontFamily: FONT, fontSize: 13, color: INK3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.message}</div>
              </div>
              <div style={{ fontFamily: FONT, fontSize: 11, color: INK3, flexShrink: 0 }}>{fmtDate(f.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      <SectionHead title="Systemstatus" />
      <div style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.08)`, borderRadius: 14, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <StatusDot ok={supaOk} label="Supabase" detail={supaOk ? 'Online' : 'Fejl'} />
        <StatusDot ok={null} label="Shipmondo" detail="Kontrolleres ikke automatisk — se Forsendelser fanen" />
        <StatusDot ok={null} label="Anthropic" detail="Kontrolleres ikke automatisk" />
      </div>
    </div>
  );
}

function StatusDot({ ok, label, detail }) {
  const color = ok === true ? PRIMARY : ok === false ? CORAL : INK3;
  const icon = ok === true ? '✅' : ok === false ? '❌' : '○';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: FONT, fontSize: 13 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontWeight: 700, color: INK }}>{label}</span>
      <span style={{ color: INK3 }}>{icon} {detail}</span>
    </div>
  );
}

// ── SECTION 2: Approvals ────────────────────────────────────────────────────────

function ApprovalsTab({ isMobile, onCountChange }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);

  useEffect(() => { fetchPending(); }, []);

  async function fetchPending() {
    setLoading(true);
    const { data } = await db.from('institutions').select('*').eq('is_approved', false).order('created_at', { ascending: false });
    setPending(data || []);
    onCountChange?.((data || []).length);
    setLoading(false);
  }

  async function handleAction(institutionId, action, note = '') {
    setActing(institutionId + action);
    const { data: { session } } = await db.auth.getSession();
    await fetch('/api/admin-approve-institution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ institutionId, action, note }),
    });
    setActing(null);
    setRejectTarget(null);
    setRejectNote('');
    fetchPending();
  }

  if (loading) return <Spinner />;

  if (!pending.length) return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 18, color: INK }}>Ingen afventende ansøgninger</div>
      <div style={{ fontSize: 14, color: INK3, marginTop: 8 }}>Alle institutioner er godkendt.</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: INK3 }}>{pending.length} afventende godkendelse{pending.length !== 1 ? 'r' : ''}</div>
      {pending.map(inst => (
        <div key={inst.id} style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', border: `1px solid ${PAPER3}`, boxShadow: '0 1px 4px rgba(22,34,28,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: INK, marginBottom: 4 }}>{inst.name}</div>
              <div style={{ fontSize: 12, color: INK3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {inst.email && <span>📧 {inst.email}</span>}
                {inst.cvr && <span>CVR {inst.cvr}</span>}
                {inst.pnr && <span>P-nr {inst.pnr}</span>}
                {inst.institution_type && <span>🏫 {inst.institution_type}</span>}
                {inst.city && <span>📍 {inst.city}</span>}
                {inst.contact_name && <span>👤 {inst.contact_name}</span>}
                {inst.phone && <span>📞 {inst.phone}</span>}
              </div>
              <div style={{ fontSize: 11, color: INK3, marginTop: 6 }}>Tilmeldt {fmtDate(inst.created_at)}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => handleAction(inst.id, 'approve')} disabled={!!acting}
                style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: PRIMARY, color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: acting ? 'default' : 'pointer', opacity: acting ? 0.7 : 1 }}>
                {acting === inst.id + 'approve' ? '…' : '✓ Godkend'}
              </button>
              <button onClick={() => setRejectTarget(inst)} disabled={!!acting}
                style={{ padding: '9px 18px', borderRadius: 10, border: `1.5px solid #FCA5A5`, background: '#FEF2F2', color: '#DC2626', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: acting ? 'default' : 'pointer' }}>
                ✕ Afvis
              </button>
            </div>
          </div>
          {rejectTarget?.id === inst.id && (
            <div style={{ marginTop: 16, padding: '14px 16px', background: '#FEF2F2', borderRadius: 12 }}>
              <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: '#DC2626', marginBottom: 8 }}>Begrundelse (valgfri — sendes til institutionen)</div>
              <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} placeholder="Evt. forklaring til institutionen…"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #FCA5A5', fontSize: 13, fontFamily: FONT, resize: 'none', outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => { setRejectTarget(null); setRejectNote(''); }} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${PAPER3}`, background: '#fff', fontFamily: FONT, fontSize: 13, cursor: 'pointer', color: INK3 }}>Annuller</button>
                <button onClick={() => handleAction(inst.id, 'reject', rejectNote)} disabled={!!acting} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: acting ? 'default' : 'pointer' }}>
                  {acting === inst.id + 'reject' ? '…' : 'Bekræft afvisning'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── SECTION 3: Institutions ─────────────────────────────────────────────────────

function InstitutionsTab({ institutions, refresh, isMobile }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | approved | pending
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  const filtered = institutions.filter(i => {
    if (filter === 'approved' && !i.is_approved) return false;
    if (filter === 'pending' && i.is_approved) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return i.name?.toLowerCase().includes(q) || i.email?.toLowerCase().includes(q) || i.city?.toLowerCase().includes(q) || i.cvr?.includes(query);
  });

  async function toggleDetail(inst) {
    if (openId === inst.id) { setOpenId(null); return; }
    setOpenId(inst.id);
    if (detail[inst.id]) return;
    setLoadingId(inst.id);
    const [{ data: members }, { data: invitations }, { count: listCount }, { count: convCount }] = await Promise.all([
      db.from('institution_members').select('*').eq('institution_id', inst.id),
      db.from('institution_invitations').select('*').eq('institution_id', inst.id).order('created_at', { ascending: false }),
      db.from('listings').select('id', { count: 'exact', head: true }).eq('institution_id', inst.id),
      db.from('conversations').select('id', { count: 'exact', head: true }).or(`initiator_institution_id.eq.${inst.id},owner_institution_id.eq.${inst.id}`),
    ]);
    setDetail(prev => ({ ...prev, [inst.id]: { members: members || [], invitations: invitations || [], listCount: listCount || 0, convCount: convCount || 0 } }));
    setLoadingId(null);
  }

  async function resetPassword(inst) {
    if (!inst.email) { setMsg({ id: inst.id, text: 'Ingen e-mail på institutionen', err: true }); return; }
    setBusy(inst.id + 'reset');
    try {
      const res = await fetch('/api/admin/reset-password', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ email: inst.email }) });
      const j = await res.json();
      setMsg({ id: inst.id, text: res.ok ? 'Nulstillingsmail sendt' : (j.error || 'Fejl'), err: !res.ok });
    } catch (e) { setMsg({ id: inst.id, text: e.message, err: true }); }
    setBusy(null);
  }

  async function toggleApprove(inst) {
    setBusy(inst.id + 'toggle');
    try {
      const res = await fetch('/api/admin/institution-toggle', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ institutionId: inst.id, approve: !inst.is_approved }) });
      if (res.ok) { await refresh(); }
      else { const j = await res.json(); setMsg({ id: inst.id, text: j.error || 'Fejl', err: true }); }
    } catch (e) { setMsg({ id: inst.id, text: e.message, err: true }); }
    setBusy(null);
  }

  return (
    <div>
      <div style={{ position: 'relative', maxWidth: 400, marginBottom: 12 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Søg på navn, e-mail, by eller CVR…"
          style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${PAPER3}`, borderRadius: 10, fontFamily: FONT, fontSize: 14, background: PAPER2, color: INK, outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['all', 'Alle'], ['approved', 'Godkendt'], ['pending', 'Afventer godkendelse']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '6px 14px', borderRadius: 99, border: `1.5px solid ${filter === k ? PRIMARY : PAPER3}`, background: filter === k ? GREEN_TINT : PAPER2, color: filter === k ? PRIMARY : INK3, fontFamily: FONT, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginBottom: 12 }}>{filtered.length} institutioner</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 ? <Empty text="Ingen institutioner fundet" /> : filtered.map(inst => {
          const isOpen = openId === inst.id;
          const d = detail[inst.id];
          return (
            <div key={inst.id} style={{ background: PAPER2, border: `1.5px solid rgba(22,34,28,0.08)`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }} onClick={() => toggleDetail(inst)}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: GREEN_TINT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 14, color: PRIMARY, flexShrink: 0, overflow: 'hidden' }}>
                  {inst.logo_url ? <img src={inst.logo_url} alt={inst.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : inst.name?.charAt(0)?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.name}</div>
                  <div style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{[inst.city, inst.email, inst.type].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                {inst.is_approved
                  ? <Badge bg={GREEN_TINT} color={PRIMARY}>Godkendt</Badge>
                  : <Badge bg="#FEF9C3" color="#92400E">Afventer</Badge>}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={INK3} strokeWidth="2.5" strokeLinecap="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {isOpen && (
                <div style={{ borderTop: `1px solid ${PAPER3}`, padding: 16 }}>
                  {loadingId === inst.id ? <Spinner small /> : d ? (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
                        <InfoItem label="E-mail" value={inst.email || '—'} />
                        <InfoItem label="By" value={inst.city || '—'} />
                        <InfoItem label="Type" value={inst.type || inst.institution_type || '—'} />
                        <InfoItem label="CVR" value={inst.cvr || '—'} />
                        <InfoItem label="Opslag" value={d.listCount} />
                        <InfoItem label="Samtaler" value={d.convCount} />
                        <InfoItem label="Medarbejdere" value={d.members.length} />
                        <InfoItem label="Oprettet" value={fmtDate(inst.created_at)} />
                      </div>

                      {d.members.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                          <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: INK3, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>Medarbejdere</p>
                          {d.members.map(m => (
                            <div key={m.id} style={{ fontFamily: FONT, fontSize: 13, color: INK, padding: '5px 0', borderBottom: `1px solid ${PAPER3}`, display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>{m.email}</span>
                              <span style={{ fontSize: 11, color: INK3, fontWeight: 600 }}>{m.role}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                        <button onClick={() => resetPassword(inst)} disabled={busy === inst.id + 'reset'}
                          style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${PAPER3}`, background: '#fff', color: INK, fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                          {busy === inst.id + 'reset' ? 'Sender…' : '🔑 Send nulstil adgangskode'}
                        </button>
                        <button onClick={() => toggleApprove(inst)} disabled={busy === inst.id + 'toggle'}
                          style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: inst.is_approved ? '#FEF2F2' : PRIMARY, color: inst.is_approved ? '#DC2626' : '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                          {busy === inst.id + 'toggle' ? '…' : inst.is_approved ? 'Deaktiver' : 'Aktiver'}
                        </button>
                      </div>
                      {msg?.id === inst.id && (
                        <div style={{ marginTop: 10, fontFamily: FONT, fontSize: 12, color: msg.err ? CORAL : PRIMARY }}>{msg.text}</div>
                      )}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SECTION 4: Listings ─────────────────────────────────────────────────────────

function ListingsTab({ allInstitutions = [], isMobile }) {
  const [subTab, setSubTab] = useState('listings'); // listings | reports | review
  const [listings, setListings] = useState([]);
  const [reports, setReports] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [reviewActing, setReviewActing] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [editModalListing, setEditModalListing] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: l }, { data: r }, { data: pr }] = await Promise.all([
      db.from('listings').select('*').order('created_at', { ascending: false }).limit(300),
      db.from('listing_reports').select('*, listings(title, institution_name)').eq('status', 'pending').order('created_at', { ascending: false }),
      db.from('listings').select('*').eq('review_status', 'pending').order('review_requested_at', { ascending: true }),
    ]);
    setListings(l || []);
    setReports(r || []);
    setPendingReviews(pr || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleReviewAction(listingId, action, reason = '') {
    setReviewActing(listingId + action);
    // Optimistic: remove from UI immediately so it doesn't wait for the API
    setPendingReviews(prev => prev.filter(l => l.id !== listingId));
    setRejectTarget(null);
    setRejectReason('');
    const { data: { session } } = await db.auth.getSession();
    const res = await fetch('/api/admin/review-listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ listing_id: listingId, action, reason }),
    });
    if (res.ok) {
      if (action === 'approve') {
        setListings(prev => prev.map(l => l.id === listingId ? { ...l, review_status: 'approved', is_active: true } : l));
      } else {
        setListings(prev => prev.filter(l => l.id !== listingId));
      }
    }
    setReviewActing(null);
  }

  async function toggleActive(l) {
    await db.from('listings').update({ is_active: !l.is_active }).eq('id', l.id);
    setListings(prev => prev.map(x => x.id === l.id ? { ...x, is_active: !l.is_active } : x));
  }
  async function markSold(l) {
    await db.from('listings').update({ is_sold: true, sold_at: new Date().toISOString() }).eq('id', l.id);
    setListings(prev => prev.map(x => x.id === l.id ? { ...x, is_sold: true } : x));
  }
  async function deleteListing(id) {
    await db.from('listings').delete().eq('id', id);
    setListings(prev => prev.filter(l => l.id !== id));
    setConfirm(null);
  }
  function startEdit(l) {
    setEditing(l.id);
    setEditForm({
      title: l.title || '',
      description: l.description || '',
      price: l.price ?? '',
      condition: l.condition || '',
      age_group: l.age_group || '',
      city: l.city || '',
      category: l.category || '',
      type: l.type || '',
    });
  }
  async function saveEdit(l) {
    setSavingEdit(true);
    const patch = {
      title: (editForm.title || '').trim(),
      description: editForm.description || null,
      price: editForm.price === '' || editForm.price == null ? null : Number(editForm.price),
      condition: editForm.condition || null,
      age_group: editForm.age_group || null,
      city: editForm.city || null,
      category: editForm.category || null,
      type: editForm.type || null,
    };
    const { error } = await db.from('listings').update(patch).eq('id', l.id);
    setSavingEdit(false);
    if (error) { alert('Kunne ikke gemme ændringer: ' + error.message); return; }
    setListings(prev => prev.map(x => x.id === l.id ? { ...x, ...patch } : x));
    setEditing(null);
  }
  async function setReportStatus(id, status) {
    const { data: { session } } = await db.auth.getSession();
    await db.from('listing_reports').update({ status, reviewed_by: session?.user?.email, reviewed_at: new Date().toISOString() }).eq('id', id);
    setReports(prev => prev.filter(r => r.id !== id));
  }

  const filtered = listings.filter(l => {
    if (filterType && l.type !== filterType) return false;
    if (filterStatus === 'active' && !l.is_active) return false;
    if (filterStatus === 'sold' && !l.is_sold) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!l.title?.toLowerCase().includes(q) && !l.institution_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['listings', `Alle opslag (${listings.length})`], ['reports', `Rapporterede (${reports.length})`], ['review', `Til gennemgang${pendingReviews.length > 0 ? ` (${pendingReviews.length})` : ''}`]].map(([k, l]) => (
          <button key={k} onClick={() => setSubTab(k)} style={{ padding: '7px 16px', borderRadius: 99, border: `1.5px solid ${subTab === k ? (k === 'review' ? '#F59E0B' : PRIMARY) : PAPER3}`, background: subTab === k ? (k === 'review' ? '#FEF3C7' : GREEN_TINT) : PAPER2, color: subTab === k ? (k === 'review' ? '#92400E' : PRIMARY) : INK3, fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      {subTab === 'reports' ? (
        loading ? <Spinner /> : reports.length === 0 ? <Empty text="Ingen afventende rapporter" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reports.map(r => (
              <div key={r.id} style={{ background: '#fff', border: `1px solid ${PAPER3}`, borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 14, color: INK }}>{r.listings?.title || 'Slettet opslag'}</div>
                    <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginTop: 2 }}>{r.listings?.institution_name || '—'}</div>
                    <div style={{ fontFamily: FONT, fontSize: 13, color: CORAL, fontWeight: 700, marginTop: 8 }}>Årsag: {r.reason}</div>
                    {r.details && <div style={{ fontFamily: FONT, fontSize: 13, color: INK2, marginTop: 4, whiteSpace: 'pre-wrap' }}>{r.details}</div>}
                    <div style={{ fontFamily: FONT, fontSize: 11, color: INK3, marginTop: 8 }}>Rapporteret af {r.reporter_institution_name || r.reporter_email || 'ukendt'} · {fmtDate(r.created_at)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button onClick={() => setReportStatus(r.id, 'reviewed')} style={{ padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${PAPER3}`, background: '#fff', color: INK, fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Gennemgået</button>
                  <button onClick={() => setReportStatus(r.id, 'removed')} style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: '#FEF2F2', color: '#DC2626', fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Marker fjernet</button>
                  <button onClick={() => setReportStatus(r.id, 'dismissed')} style={{ padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${PAPER3}`, background: PAPER2, color: INK3, fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Afvis</button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : subTab === 'review' ? (
        loading ? <Spinner /> : pendingReviews.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 18, color: INK }}>Ingen opslag til gennemgang</div>
            <div style={{ fontSize: 14, color: INK3, marginTop: 8 }}>Alle indsendte opslag er behandlet.</div>
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginBottom: 12 }}>{pendingReviews.length} opslag afventer gennemgang</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pendingReviews.map(l => (
                <div key={l.id} style={{ background: '#fff', border: '1.5px solid #FDE68A', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', gap: 14, padding: '16px 18px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                    {Array.isArray(l.images) && l.images[0] && (
                      <img src={l.images[0]} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 15, color: INK, marginBottom: 4 }}>{l.title}</div>
                      <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginBottom: 6 }}>{l.institution_name} · Indsendt {fmtDate(l.review_requested_at || l.created_at)}</div>
                      {l.description && <div style={{ fontFamily: FONT, fontSize: 13, color: INK2, lineHeight: 1.5, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.description}</div>}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <TypeBadge type={l.type} />
                        {l.price != null && <span style={{ fontFamily: FONT, fontSize: 12, color: INK2, fontWeight: 700 }}>{fmtKr(l.price)}</span>}
                        {l.category && <span style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{l.category}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '0 18px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => handleReviewAction(l.id, 'approve')} disabled={!!reviewActing || rejectTarget === l.id}
                      style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: PRIMARY, color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: !!reviewActing ? 'default' : 'pointer', opacity: !!reviewActing ? 0.7 : 1 }}>
                      {reviewActing === l.id + 'approve' ? '…' : '✓ Godkend'}
                    </button>
                    <button onClick={() => { setRejectTarget(l.id); setRejectReason(''); }} disabled={!!reviewActing}
                      style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: !!reviewActing ? 'default' : 'pointer' }}>
                      ✕ Afvis
                    </button>
                  </div>
                  {rejectTarget === l.id && (
                    <div style={{ padding: '0 18px 18px' }}>
                      <div style={{ background: '#FEF2F2', borderRadius: 12, padding: '14px 16px' }}>
                        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 13, color: '#DC2626', marginBottom: 8 }}>Begrundelse (sendes til sælger)</div>
                        <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} placeholder="Beskriv hvorfor opslaget ikke kan godkendes…"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #FCA5A5', fontSize: 13, fontFamily: FONT, resize: 'none', outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                          <button onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                            style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${PAPER3}`, background: '#fff', fontFamily: FONT, fontSize: 13, cursor: 'pointer', color: INK3 }}>Annuller</button>
                          <button onClick={() => handleReviewAction(l.id, 'reject', rejectReason)} disabled={!rejectReason.trim() || !!reviewActing}
                            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: !rejectReason.trim() ? 'not-allowed' : 'pointer', opacity: !rejectReason.trim() ? 0.6 : 1 }}>
                            {reviewActing === l.id + 'reject' ? '…' : 'Bekræft afvisning'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Søg…" style={{ flex: '1 1 200px', minWidth: 160, padding: '10px 14px', border: `1.5px solid ${PAPER3}`, borderRadius: 10, fontFamily: FONT, fontSize: 14, background: PAPER2, color: INK, outline: 'none', boxSizing: 'border-box' }} />
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '10px 12px', border: `1.5px solid ${PAPER3}`, borderRadius: 10, fontFamily: FONT, fontSize: 13, background: PAPER2, color: INK, cursor: 'pointer' }}>
              <option value="">Alle typer</option>
              <option value="køb">Sælges</option>
              <option value="byd">Søges</option>
              <option value="byt">Byttes</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '10px 12px', border: `1.5px solid ${PAPER3}`, borderRadius: 10, fontFamily: FONT, fontSize: 13, background: PAPER2, color: INK, cursor: 'pointer' }}>
              <option value="">Alle statusser</option>
              <option value="active">Aktive</option>
              <option value="sold">Solgte</option>
            </select>
          </div>

          {loading ? <Spinner /> : (
            <>
              <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginBottom: 10 }}>Viser {filtered.length} af {listings.length} opslag</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.length === 0 ? <Empty text="Ingen opslag fundet" /> : filtered.map(l => {
                  const isOpen = expanded === l.id;
                  return (
                    <div key={l.id} style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.08)`, borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : l.id)}>
                        <span style={{ fontSize: 20 }}>{l.emoji || '📦'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
                          <div style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{l.institution_name || '—'} · {l.price != null ? fmtKr(l.price) : '—'}</div>
                        </div>
                        <TypeBadge type={l.type} />
                        {l.is_sold ? <Badge bg="#FEE2E2" color="#991B1B">Solgt</Badge> : <Badge bg={l.is_active ? GREEN_TINT : PAPER3} color={l.is_active ? PRIMARY : INK3}>{l.is_active ? 'Aktiv' : 'Inaktiv'}</Badge>}
                      </div>
                      {isOpen && (
                        <div style={{ borderTop: `1px solid ${PAPER3}`, padding: 16 }}>
                          <>
                          {l.description && <div style={{ fontFamily: FONT, fontSize: 13, color: INK2, lineHeight: 1.6, marginBottom: 12, whiteSpace: 'pre-wrap' }}>{l.description}</div>}
                          {Array.isArray(l.images) && l.images.length > 0 && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                              {l.images.slice(0, 6).map((img, i) => (
                                <img key={i} src={img} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: `1px solid ${PAPER3}` }} />
                              ))}
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
                            <InfoItem label="Stand" value={l.condition || '—'} />
                            <InfoItem label="Aldersgruppe" value={l.age_group || '—'} />
                            <InfoItem label="By" value={l.city || '—'} />
                            <InfoItem label="Kategori" value={l.category || '—'} />
                            <InfoItem label="Favoritter" value={l.fav_count ?? 0} />
                            <InfoItem label="Bud" value={l.bid_count ?? 0} />
                            <InfoItem label="Oprettet" value={fmtDate(l.created_at)} />
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button onClick={() => setEditModalListing(l)} style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: PRIMARY, color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Rediger</button>
                            <button onClick={() => toggleActive(l)} style={{ padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${PAPER3}`, background: '#fff', color: INK, fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{l.is_active ? 'Deaktiver' : 'Aktiver'}</button>
                            {!l.is_sold && <button onClick={() => markSold(l)} style={{ padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${PAPER3}`, background: '#fff', color: INK, fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Marker solgt</button>}
                            <button onClick={() => setConfirm(l.id)} style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: '#FEF2F2', color: '#DC2626', fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Slet</button>
                          </div>
                          </>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(22,34,28,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 20 }}>
          <div style={{ background: PAPER2, borderRadius: 20, padding: '28px 24px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 18, color: INK, marginBottom: 10 }}>Slet opslag?</div>
            <p style={{ fontFamily: FONT, fontSize: 14, color: INK3, marginBottom: 22 }}>Dette kan ikke fortrydes.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirm(null)} style={{ flex: 1, padding: '11px', borderRadius: 99, border: `1.5px solid ${PAPER3}`, background: PAPER2, fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK2, cursor: 'pointer' }}>Annuller</button>
              <button onClick={() => deleteListing(confirm)} style={{ flex: 1, padding: '11px', borderRadius: 99, border: 'none', background: CORAL, fontFamily: FONT, fontWeight: 700, fontSize: 14, color: '#fff', cursor: 'pointer' }}>Slet</button>
            </div>
          </div>
        </div>
      )}

      {editModalListing && (
        <AdminListingEditModal
          listing={editModalListing}
          onClose={() => setEditModalListing(null)}
          onSaved={(updated) => {
            setListings(prev => prev.map(x => x.id === updated.id ? updated : x));
            setEditModalListing(null);
          }}
        />
      )}
    </div>
  );
}

// ── SECTION 5: Orders ───────────────────────────────────────────────────────────

function OrdersTab({ isMobile }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [draftStatus, setDraftStatus] = useState({});
  const [saving, setSaving] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/orders', { headers: await authHeaders() });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Fejl');
        setOrders(j.orders || []);
      } catch (e) { setError(e.message); }
      setLoading(false);
    }
    load();
  }, []);

  async function saveStatus(order) {
    const status = draftStatus[order.id] || order.status;
    if (status === order.status) return;
    setSaving(order.id);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, { method: 'PATCH', headers: await authHeaders(), body: JSON.stringify({ status }) });
      const j = await res.json();
      if (res.ok && j.order) setOrders(prev => prev.map(o => o.id === order.id ? j.order : o));
    } catch (e) { /* noop */ }
    setSaving(null);
  }

  const filtered = orders.filter(o => {
    if (filter && o.status !== filter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!o.buyer_name?.toLowerCase().includes(q) && !o.buyer_email?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) return <Spinner />;
  if (error) return <Empty text={`Kunne ikke hente handler: ${error}`} />;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Søg på køber…" style={{ flex: '1 1 200px', minWidth: 160, padding: '10px 14px', border: `1.5px solid ${PAPER3}`, borderRadius: 10, fontFamily: FONT, fontSize: 14, background: PAPER2, color: INK, outline: 'none', boxSizing: 'border-box' }} />
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '10px 12px', border: `1.5px solid ${PAPER3}`, borderRadius: 10, fontFamily: FONT, fontSize: 13, background: PAPER2, color: INK, cursor: 'pointer' }}>
          <option value="">Alle statusser</option>
          {Object.entries(ORDER_STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginBottom: 10 }}>{filtered.length} handler</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 ? <Empty text="Ingen handler fundet" /> : filtered.map(o => {
          const isOpen = expanded === o.id;
          return (
            <div key={o.id} style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.08)`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : o.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.buyer_name || o.buyer_email || 'Ukendt køber'}</div>
                  <div style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{o.buyer_email} · {fmtDate(o.created_at)}</div>
                </div>
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, flexShrink: 0 }}>{fmtKr(o.grand_total)}</div>
                <OrderStatusBadge status={o.status} />
              </div>
              {isOpen && (
                <div style={{ borderTop: `1px solid ${PAPER3}`, padding: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
                    <InfoItem label="Telefon" value={o.buyer_phone || '—'} />
                    <InfoItem label="Adresse" value={[o.buyer_address, o.buyer_zip, o.buyer_city].filter(Boolean).join(', ') || '—'} />
                    <InfoItem label="Betalt" value={fmtDate(o.paid_at)} />
                    <InfoItem label="Sendt" value={fmtDate(o.shipped_at)} />
                    <InfoItem label="Payment Intent" value={<span style={{ fontFamily: 'monospace', fontSize: 11 }}>{o.payment_intent_id || '—'}</span>} />
                  </div>

                  {o.tracking_number && (
                    <div style={{ marginBottom: 14, fontFamily: FONT, fontSize: 13, color: INK2 }}>
                      📦 Tracking: <strong>{o.tracking_number}</strong> {o.tracking_url && <a href={o.tracking_url} target="_blank" rel="noreferrer" style={{ color: PRIMARY, marginLeft: 6 }}>spor →</a>}
                    </div>
                  )}
                  {o.shipment_error && <div style={{ marginBottom: 14, fontFamily: FONT, fontSize: 12, color: CORAL }}>Forsendelsesfejl: {o.shipment_error}</div>}

                  {Array.isArray(o.order_groups) && o.order_groups.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: 11, color: INK3, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>Ordregrupper</p>
                      <pre style={{ fontFamily: 'monospace', fontSize: 11, color: INK2, background: '#fff', border: `1px solid ${PAPER3}`, borderRadius: 8, padding: 12, overflow: 'auto', margin: 0, maxHeight: 240 }}>{JSON.stringify(o.order_groups, null, 2)}</pre>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={draftStatus[o.id] ?? o.status} onChange={e => setDraftStatus(d => ({ ...d, [o.id]: e.target.value }))} style={{ padding: '8px 12px', border: `1.5px solid ${PAPER3}`, borderRadius: 10, fontFamily: FONT, fontSize: 13, background: '#fff', color: INK, cursor: 'pointer' }}>
                      {Object.entries(ORDER_STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <button onClick={() => saveStatus(o)} disabled={saving === o.id || (draftStatus[o.id] ?? o.status) === o.status}
                      style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: PRIMARY, color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (draftStatus[o.id] ?? o.status) === o.status ? 0.5 : 1 }}>
                      {saving === o.id ? 'Gemmer…' : 'Gem status'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SECTION 6: Shipping ─────────────────────────────────────────────────────────

function ShippingTab({ isMobile }) {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    db.from('shipments').select('status').limit(500).then(({ data }) => {
      const c = {};
      (data || []).forEach(s => { c[s.status] = (c[s.status] || 0) + 1; });
      setCounts(c);
    });
  }, []);

  return (
    <div>
      <a href="/admin/shipping" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 24px', borderRadius: 14, background: PRIMARY, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 15, textDecoration: 'none', marginBottom: 24 }}>
        🚚 Åbn forsendelsesadmin →
      </a>

      <SectionHead title="Forsendelser pr. status" />
      {!counts ? <Spinner /> : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
          {Object.keys(SHIPMENT_STATUS_CFG).map(k => {
            const cfg = SHIPMENT_STATUS_CFG[k];
            const n = counts[k] || 0;
            const isFailed = k === 'failed';
            return (
              <div key={k} style={{ background: isFailed && n > 0 ? '#FEE2E2' : PAPER2, border: `1px solid ${isFailed && n > 0 ? '#FCA5A5' : 'rgba(22,34,28,0.08)'}`, borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontFamily: FONT, fontSize: 12, color: isFailed && n > 0 ? '#991B1B' : INK3, fontWeight: 600 }}>{cfg.label}</div>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 28, color: isFailed && n > 0 ? '#991B1B' : (n > 0 ? INK : INK3), letterSpacing: '-0.04em' }}>{n}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SECTION 7: Feedback (Kanban-inspired) ───────────────────────────────────────

const FB_STATUSES = [
  { key: 'new',                  label: 'Ny',                 emoji: '🆕', bg: PAPER3,    color: INK3,      border: 'transparent' },
  { key: 'in_progress',         label: 'Arbejdes på',        emoji: '🔨', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  { key: 'awaiting_institution', label: 'Afventer institution', emoji: '⏳', bg: '#FEF9C3', color: '#92400E', border: '#FDE68A' },
  { key: 'fixed',               label: 'Løst',               emoji: '✅', bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' },
  { key: 'wont_fix',            label: 'Ikke relevant',      emoji: '❌', bg: '#FEF2F2', color: '#DC2626', border: '#FCA5A5' },
];
const FB_CAT = { bug: { emoji: '🐛', label: 'Fejl' }, suggestion: { emoji: '💡', label: 'Forslag' }, general: { emoji: '⭐', label: 'Generel' } };

function FeedbackTab({ isMobile, onNewCountChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [noteDraft, setNoteDraft] = useState({});
  const [savingNote, setSavingNote] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    db.from('feedback').select('*').order('created_at', { ascending: false }).limit(300).then(({ data }) => {
      setItems(data || []);
      setLoading(false);
    });
  }, []);

  const statusCfg = Object.fromEntries(FB_STATUSES.map(s => [s.key, s]));

  function recountNew(next) {
    onNewCountChange?.(next.filter(i => (i.status || 'new') === 'new').length);
  }

  async function setStatus(id, status) {
    await db.from('feedback').update({ status }).eq('id', id);
    setItems(prev => { const next = prev.map(i => i.id === id ? { ...i, status } : i); recountNew(next); return next; });
  }

  async function saveNote(id) {
    setSavingNote(id);
    const admin_notes = noteDraft[id] ?? '';
    await db.from('feedback').update({ admin_notes }).eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, admin_notes } : i));
    setSavingNote(null);
  }

  async function bulkNewToProgress() {
    const ids = items.filter(i => (i.status || 'new') === 'new').map(i => i.id);
    if (!ids.length) return;
    setBulkBusy(true);
    await db.from('feedback').update({ status: 'in_progress' }).in('id', ids);
    setItems(prev => { const next = prev.map(i => ids.includes(i.id) ? { ...i, status: 'in_progress' } : i); recountNew(next); return next; });
    setBulkBusy(false);
  }

  const counts = Object.fromEntries(FB_STATUSES.map(s => [s.key, items.filter(i => (i.status || 'new') === s.key).length]));
  const filtered = filter === 'all' ? items : items.filter(i => (i.status || 'new') === filter);

  return (
    <div>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          <img src={lightbox} alt="Screenshot" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12 }} onClick={e => e.stopPropagation()} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <button onClick={() => setFilter('all')} style={{ padding: '6px 14px', borderRadius: 99, border: `1.5px solid ${filter === 'all' ? PRIMARY : PAPER3}`, background: filter === 'all' ? GREEN_TINT : PAPER2, color: filter === 'all' ? PRIMARY : INK3, fontFamily: FONT, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Alle ({items.length})</button>
        {FB_STATUSES.map(s => (
          <button key={s.key} onClick={() => setFilter(s.key)} style={{ padding: '6px 14px', borderRadius: 99, border: `1.5px solid ${filter === s.key ? s.color : PAPER3}`, background: filter === s.key ? s.bg : PAPER2, color: filter === s.key ? s.color : INK3, fontFamily: FONT, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>{s.emoji}</span> {s.label} ({counts[s.key]})
          </button>
        ))}
      </div>

      {counts.new > 0 && (
        <button onClick={bulkNewToProgress} disabled={bulkBusy} style={{ marginBottom: 16, padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${PAPER3}`, background: PAPER2, color: INK2, fontFamily: FONT, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
          {bulkBusy ? 'Opdaterer…' : `Marker alle ${counts.new} "Ny" som "Arbejdes på"`}
        </button>
      )}

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: INK }}>Ingen feedback her</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(item => {
            const cat = FB_CAT[item.category] || FB_CAT.general;
            const sc = statusCfg[item.status || 'new'] || statusCfg.new;
            const isOpen = expanded === item.id;
            return (
              <div key={item.id} style={{ background: '#fff', border: `1.5px solid ${sc.border === 'transparent' ? 'rgba(22,34,28,0.08)' : sc.border}`, borderRadius: 14, overflow: 'hidden' }}>
                <div onClick={() => setExpanded(isOpen ? null : item.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{cat.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13, color: INK }}>{item.institution_name || item.user_email || 'Anonym'}</span>
                      {item.page && <span style={{ fontFamily: 'monospace', fontSize: 11, background: PAPER3, color: INK3, borderRadius: 6, padding: '1px 7px' }}>{item.page}</span>}
                      {item.screenshot_url && <span style={{ fontSize: 11 }}>📸</span>}
                    </div>
                    <div style={{ fontFamily: FONT, fontSize: 13, color: INK3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.message}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <Badge bg={sc.bg} color={sc.color} border={sc.border === 'transparent' ? null : sc.border}>{sc.emoji} {sc.label}</Badge>
                    <span style={{ fontFamily: FONT, fontSize: 11, color: INK3 }}>{fmtDate(item.created_at)}</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: `1px solid ${PAPER3}`, padding: '16px 18px', background: '#fafaf9' }}>
                    <div style={{ fontFamily: FONT, fontSize: 14, color: INK, lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 14 }}>{item.message}</div>

                    {item.screenshot_url && (
                      <img src={item.screenshot_url} alt="Screenshot" onClick={() => setLightbox(item.screenshot_url)} style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10, border: `1px solid ${PAPER3}`, cursor: 'zoom-in', display: 'block', marginBottom: 16 }} />
                    )}

                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: INK3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Status</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {FB_STATUSES.map(s => {
                          const active = (item.status || 'new') === s.key;
                          return (
                            <button key={s.key} onClick={() => setStatus(item.id, s.key)} style={{ padding: '5px 12px', borderRadius: 99, border: `1.5px solid ${active ? s.color : PAPER3}`, background: active ? s.bg : '#fff', color: active ? s.color : INK3, fontFamily: FONT, fontWeight: active ? 700 : 500, fontSize: 12, cursor: 'pointer' }}>
                              {s.emoji} {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: INK3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Admin-noter</div>
                      <textarea value={noteDraft[item.id] ?? item.admin_notes ?? ''} onChange={e => setNoteDraft(d => ({ ...d, [item.id]: e.target.value }))} rows={3} placeholder="Interne noter…"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${PAPER3}`, fontSize: 13, fontFamily: FONT, resize: 'vertical', outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
                      <button onClick={() => saveNote(item.id)} disabled={savingNote === item.id} style={{ marginTop: 8, padding: '7px 16px', borderRadius: 10, border: 'none', background: PRIMARY, color: '#fff', fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        {savingNote === item.id ? 'Gemmer…' : 'Gem note'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: `1px solid ${PAPER3}`, paddingTop: 12 }}>
                      <InfoItem label="Kategori" value={`${cat.emoji} ${cat.label}`} />
                      {item.institution_name && <InfoItem label="Institution" value={item.institution_name} />}
                      {item.user_email && <InfoItem label="E-mail" value={item.user_email} />}
                      <InfoItem label="Tidspunkt" value={fmtDate(item.created_at, true)} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SECTION 8: Users ────────────────────────────────────────────────────────────

function UsersTab({ isMobile }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/users', { headers: await authHeaders() });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Fejl');
        setUsers(j.users || []);
      } catch (e) { setError(e.message); }
      setLoading(false);
    }
    load();
  }, []);

  async function resetPassword(email) {
    setBusy(email);
    try {
      const res = await fetch('/api/admin/reset-password', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ email }) });
      const j = await res.json();
      setMsg({ email, text: res.ok ? 'Mail sendt' : (j.error || 'Fejl'), err: !res.ok });
    } catch (e) { setMsg({ email, text: e.message, err: true }); }
    setBusy(null);
  }

  const filtered = users.filter(u => !query || u.email?.toLowerCase().includes(query.toLowerCase()) || u.institution_name?.toLowerCase().includes(query.toLowerCase()));

  if (loading) return <Spinner />;
  if (error) return <Empty text={`Kunne ikke hente brugere: ${error}`} />;

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Søg på e-mail…" style={{ width: '100%', maxWidth: 400, padding: '10px 14px', border: `1.5px solid ${PAPER3}`, borderRadius: 10, fontFamily: FONT, fontSize: 14, background: PAPER2, color: INK, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
      <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginBottom: 12 }}>{filtered.length} brugere</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 ? <Empty text="Ingen brugere fundet" /> : filtered.map(u => (
          <div key={u.id} style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.08)`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>
                {u.institution_name ? `🏫 ${u.institution_name}` : 'Ingen institution'} · Oprettet {fmtDate(u.created_at)}
              </div>
              <div style={{ fontFamily: FONT, fontSize: 11, color: INK3 }}>
                Sidst logget ind: {u.last_sign_in_at ? fmtDate(u.last_sign_in_at, true) : 'aldrig'}{!u.email_confirmed_at && ' · ⚠️ ikke bekræftet'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <button onClick={() => resetPassword(u.email)} disabled={busy === u.email} style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${PAPER3}`, background: '#fff', color: INK, fontFamily: FONT, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                {busy === u.email ? 'Sender…' : '🔑 Nulstil adgangskode'}
              </button>
              {msg?.email === u.email && <span style={{ fontFamily: FONT, fontSize: 11, color: msg.err ? CORAL : PRIMARY }}>{msg.text}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SECTION 9: Economy ──────────────────────────────────────────────────────────

function EconomyTab({ isMobile }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    db.from('shipping_invoices').select('*, institutions(name, email)').order('created_at', { ascending: false }).limit(100).then(({ data }) => {
      setInvoices(data || []);
      setLoading(false);
    });
  }, []);

  const filtered = invoices.filter(inv => !filter || inv.status === filter);
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_amount_dkk || 0), 0);
  const outstanding = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.total_amount_dkk || 0), 0);

  function exportCsv() {
    const rows = [['Institution', 'Fakturanr', 'Periode start', 'Periode slut', 'Beløb (DKK)', 'Status', 'Forfald']];
    filtered.forEach(inv => {
      rows.push([
        (inv.institutions?.name || ''),
        inv.invoice_number || '',
        inv.period_start || '',
        inv.period_end || '',
        inv.total_amount_dkk ?? '',
        inv.status || '',
        inv.due_date || '',
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fakturaer_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <Stat label="Betalt omsætning" value={fmtKr(totalRevenue)} color={PRIMARY} />
        <Stat label="Udestående" value={fmtKr(outstanding)} color={CORAL} />
        <Stat label="Fakturaer" value={invoices.length} color={INK2} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '10px 12px', border: `1.5px solid ${PAPER3}`, borderRadius: 10, fontFamily: FONT, fontSize: 13, background: PAPER2, color: INK, cursor: 'pointer' }}>
          <option value="">Alle</option>
          {Object.entries(INVOICE_STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={exportCsv} style={{ padding: '9px 16px', borderRadius: 10, border: `1.5px solid ${PAPER3}`, background: '#fff', color: INK, fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>⬇ Eksporter CSV</button>
        <span style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{filtered.length} fakturaer</span>
      </div>

      {filtered.length === 0 ? <Empty text="Ingen fakturaer" /> : (
        <div style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.08)`, borderRadius: 16, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontSize: 13, minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${PAPER3}` }}>
                {['Institution', 'Fakturanr', 'Periode', 'Beløb', 'Status', 'Forfald'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: INK3, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, i) => {
                const c = INVOICE_STATUS_CFG[inv.status] || { bg: PAPER3, color: INK3, label: inv.status };
                return (
                  <tr key={inv.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${PAPER3}` : 'none' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: INK }}>{inv.institutions?.name || '—'}</td>
                    <td style={{ padding: '12px 16px', color: INK2, fontFamily: 'monospace', fontSize: 12 }}>{inv.invoice_number || '—'}</td>
                    <td style={{ padding: '12px 16px', color: INK3, whiteSpace: 'nowrap' }}>{inv.period_start ? fmtDate(inv.period_start) : '—'} – {inv.period_end ? fmtDate(inv.period_end) : '—'}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: INK }}>{fmtKr(inv.total_amount_dkk)}</td>
                    <td style={{ padding: '12px 16px' }}><Badge bg={c.bg} color={c.color}>{c.label}</Badge></td>
                    <td style={{ padding: '12px 16px', color: INK3, whiteSpace: 'nowrap' }}>{inv.due_date ? fmtDate(inv.due_date) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── SECTION 10: Log ─────────────────────────────────────────────────────────────

function LogTab({ isMobile }) {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/audit-log', { headers: await authHeaders() });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Fejl');
        setLog(j.log || []);
      } catch (e) { setError(e.message); }
      setLoading(false);
    }
    load();
  }, []);

  const actions = Array.from(new Set(log.map(l => l.action))).filter(Boolean);
  const filtered = log.filter(l => {
    if (actionFilter && l.action !== actionFilter) return false;
    if (query && !l.target_name?.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  if (loading) return <Spinner />;
  if (error) return <Empty text={`Kunne ikke hente log: ${error}`} />;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Søg på mål…" style={{ flex: '1 1 200px', minWidth: 160, padding: '10px 14px', border: `1.5px solid ${PAPER3}`, borderRadius: 10, fontFamily: FONT, fontSize: 14, background: PAPER2, color: INK, outline: 'none', boxSizing: 'border-box' }} />
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ padding: '10px 12px', border: `1.5px solid ${PAPER3}`, borderRadius: 10, fontFamily: FONT, fontSize: 13, background: PAPER2, color: INK, cursor: 'pointer' }}>
          <option value="">Alle handlinger</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginBottom: 12 }}>{filtered.length} log-poster</div>

      {filtered.length === 0 ? <Empty text="Ingen log-poster" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(l => (
            <div key={l.id} style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.08)`, borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Badge bg={GREEN_TINT} color={PRIMARY}>{l.action}</Badge>
                  <span style={{ fontFamily: FONT, fontSize: 13, color: INK, fontWeight: 700 }}>{l.target_name || l.target_type || '—'}</span>
                  {l.target_type && <span style={{ fontFamily: 'monospace', fontSize: 11, color: INK3 }}>{l.target_type}</span>}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginTop: 4 }}>{l.admin_email}</div>
                {l.details && Object.keys(l.details).length > 0 && (
                  <pre style={{ fontFamily: 'monospace', fontSize: 11, color: INK2, background: '#fff', border: `1px solid ${PAPER3}`, borderRadius: 8, padding: 8, overflow: 'auto', margin: '6px 0 0', maxHeight: 120 }}>{JSON.stringify(l.details, null, 2)}</pre>
                )}
              </div>
              <span style={{ fontFamily: FONT, fontSize: 11, color: INK3, flexShrink: 0 }}>{fmtDate(l.created_at, true)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SECTION: Scan rejection logs ────────────────────────────────────────────────

function ScanRejectionLogsSection({ isMobile }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState({});
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    db.from('scan_rejection_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => { setLogs(data || []); setLoading(false); });
  }, []);

  async function deleteImage(log_id) {
    setDeleting(d => ({ ...d, [log_id]: true }));
    const headers = await authHeaders();
    await fetch('/api/admin/scan-rejection', {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'delete_image', log_id }),
    });
    setLogs(prev => prev.map(l => l.id === log_id ? { ...l, image_path: null, deleted_at: new Date().toISOString() } : l));
    setDeleting(d => ({ ...d, [log_id]: false }));
  }

  if (loading) return <Spinner />;
  if (!logs.length) return <Empty text="Ingen afviste billeder endnu" />;

  return (
    <>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 8px 48px rgba(0,0,0,0.6)', objectFit: 'contain' }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {logs.map(l => {
        const imgUrl = l.image_path && !l.deleted_at
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-images/${l.image_path}`
          : null;
        return (
          <div key={l.id} style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.08)`, borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            {imgUrl ? (
              <img src={imgUrl} alt="" onClick={() => setLightbox(imgUrl)} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, flexShrink: 0, border: `1px solid ${PAPER3}`, cursor: 'zoom-in' }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: 10, background: PAPER3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                {l.deleted_at ? '🗑️' : '📷'}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
                <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: INK3 }}>{fmtDate(l.created_at, true)}</span>
                {l.institution_name && <Badge bg={GREEN_TINT} color={PRIMARY}>{l.institution_name}</Badge>}
                {l.user_disputed && <Badge bg='#FEF3C7' color='#92400E'>AI tog fejl (bruger)</Badge>}
                {l.deleted_at && <Badge bg={PAPER3} color={INK3}>Billede slettet</Badge>}
              </div>
              <div style={{ fontFamily: FONT, fontSize: 13, color: INK, marginBottom: 8, lineHeight: 1.5 }}>
                <strong>AI begrundelse:</strong> {l.ai_reason || '—'}
              </div>
              {!l.deleted_at && l.image_path && (
                <button
                  onClick={() => deleteImage(l.id)}
                  disabled={!!deleting[l.id]}
                  style={{ background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, fontFamily: FONT, cursor: deleting[l.id] ? 'not-allowed' : 'pointer', opacity: deleting[l.id] ? 0.6 : 1 }}
                >
                  {deleting[l.id] ? 'Sletter…' : 'Slet billede permanent'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}

// ── SECTION: AI Bot ─────────────────────────────────────────────────────────────

function AiBotTab({ isMobile }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [scanTypeFilter, setScanTypeFilter] = useState('');
  const [showRejections, setShowRejections] = useState(false);

  useEffect(() => {
    async function load() {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await db
        .from('ai_scan_logs')
        .select('*')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(300);
      if (!data) { setLoading(false); return; }
      setLogs(data);

      const submitted = data.filter(r => r.submitted);
      const withPrice = submitted.filter(r => r.ai_price_suggested != null && r.final_price != null);
      const totalDeltas = withPrice.reduce((s, r) => s + Math.abs(r.price_delta || 0), 0);

      setStats({
        total: data.length,
        submitted: submitted.length,
        submitRate: data.length ? Math.round(submitted.length / data.length * 100) : 0,
        usedTitle: submitted.filter(r => r.used_title).length,
        usedDescription: submitted.filter(r => r.used_description).length,
        usedPrice: withPrice.filter(r => r.used_price).length,
        withPrice: withPrice.length,
        avgPriceDelta: withPrice.length ? Math.round(totalDeltas / withPrice.length) : null,
        byScanType: {
          'scan-toy': data.filter(r => r.scan_type === 'scan-toy').length,
          'fill-soges': data.filter(r => r.scan_type === 'fill-soges').length,
          'improve-listing': data.filter(r => r.scan_type === 'improve-listing').length,
        },
      });
      setLoading(false);
    }
    load();
  }, []);

  const filtered = scanTypeFilter ? logs.filter(l => l.scan_type === scanTypeFilter) : logs;
  const pct = (n, total) => total > 0 ? Math.round(n / total * 100) + '%' : '—';

  return (
    <div style={{ padding: isMobile ? '20px 0' : '24px 0', maxWidth: 1100 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => setShowRejections(false)} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: !showRejections ? PRIMARY : PAPER2, color: !showRejections ? '#fff' : INK, fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          AI-scans
        </button>
        <button onClick={() => setShowRejections(true)} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: showRejections ? PRIMARY : PAPER2, color: showRejections ? '#fff' : INK, fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Afviste billeder
        </button>
      </div>

      {showRejections ? (
        <>
          <SectionHead title="Afviste billeder — persondetektering" />
          <ScanRejectionLogsSection isMobile={isMobile} />
        </>
      ) : (
      <>
      <SectionHead title="AI Bot — seneste 30 dage" />

      {loading ? <Spinner /> : !stats ? <Empty text="Ingen data endnu" /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5,1fr)', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'Scans i alt', value: stats.total },
              { label: 'Submittet', value: `${stats.submitted} (${pct(stats.submitted, stats.total)})` },
              { label: 'Titel accepteret', value: pct(stats.usedTitle, stats.submitted) },
              { label: 'Beskrivelse accepteret', value: pct(stats.usedDescription, stats.submitted) },
              { label: 'Pris accepteret ±15%', value: pct(stats.usedPrice, stats.withPrice) },
            ].map((c, i) => (
              <div key={i} style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.08)`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, color: PRIMARY, letterSpacing: '-0.03em' }}>{c.value}</div>
                <div style={{ fontFamily: FONT, fontSize: 11, color: INK3, marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 28 }}>
            <div style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.08)`, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: INK3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Fordeling pr. scan-type</div>
              {Object.entries(stats.byScanType).map(([type, count]) => (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontFamily: FONT, fontSize: 13, color: INK }}>{type}</span>
                  <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: PRIMARY }}>{count}</span>
                </div>
              ))}
            </div>
            <div style={{ background: PAPER2, border: `1px solid rgba(22,34,28,0.08)`, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: INK3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Pris-præcision</div>
              <div style={{ fontFamily: FONT, fontSize: 13, color: INK, marginBottom: 6 }}>
                Gennemsnitlig afvigelse: <strong>{stats.avgPriceDelta != null ? `±${stats.avgPriceDelta} kr.` : '—'}</strong>
              </div>
              <div style={{ fontFamily: FONT, fontSize: 13, color: INK, marginBottom: 6 }}>
                Rækker med prisdata: <strong>{stats.withPrice}</strong>
              </div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, fontStyle: 'italic' }}>
                Rækker hvor used_price = false er fine-tuning-kandidater
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontFamily: FONT, fontSize: 12, color: INK3 }}>{filtered.length} rækker</div>
            <select value={scanTypeFilter} onChange={e => setScanTypeFilter(e.target.value)} style={{ padding: '8px 12px', border: `1.5px solid ${PAPER3}`, borderRadius: 10, fontFamily: FONT, fontSize: 13, background: PAPER2, color: INK, cursor: 'pointer' }}>
              <option value="">Alle scan-typer</option>
              <option value="scan-toy">scan-toy</option>
              <option value="fill-soges">fill-soges</option>
              <option value="improve-listing">improve-listing</option>
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontSize: 12 }}>
              <thead>
                <tr style={{ background: PAPER2, borderBottom: `2px solid ${PAPER3}` }}>
                  {['Tidspunkt','Type','Institution','AI pris','Final pris','Δ','Titel','Beskr.','Pris OK','Submit'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: INK3, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => (
                  <tr key={l.id} style={{ borderBottom: `1px solid ${PAPER3}`, background: i % 2 === 0 ? '#fff' : PAPER2 }}>
                    <td style={{ padding: '8px 10px', color: INK3, whiteSpace: 'nowrap' }}>{fmtDate(l.created_at, true)}</td>
                    <td style={{ padding: '8px 10px' }}><Badge bg={GREEN_TINT} color={PRIMARY}>{l.scan_type}</Badge></td>
                    <td style={{ padding: '8px 10px', color: INK, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.institution_name || '—'}</td>
                    <td style={{ padding: '8px 10px', color: INK, whiteSpace: 'nowrap' }}>{l.ai_price_suggested != null ? `${l.ai_price_suggested} kr.` : '—'}</td>
                    <td style={{ padding: '8px 10px', color: INK, whiteSpace: 'nowrap' }}>{l.final_price != null ? `${l.final_price} kr.` : '—'}</td>
                    <td style={{ padding: '8px 10px', color: l.price_delta != null ? (Math.abs(l.price_delta) > 50 ? '#DC2626' : PRIMARY) : INK3, whiteSpace: 'nowrap', fontWeight: 700 }}>
                      {l.price_delta != null ? `${l.price_delta > 0 ? '+' : ''}${l.price_delta}` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>{l.used_title == null ? '—' : l.used_title ? '✅' : '✏️'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>{l.used_description == null ? '—' : l.used_description ? '✅' : '✏️'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>{l.used_price == null ? '—' : l.used_price ? '✅' : '❌'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>{l.submitted ? '✅' : '⏳'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <Empty text="Ingen AI-scans i perioden" />}
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}
