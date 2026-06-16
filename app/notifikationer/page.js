'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/supabase';
import { useActiveUser } from '@/providers/AppProvider';
import { PRIMARY, PAPER, PAPER2, PAPER3, INK, INK3, FONT } from '@/lib/constants';
import { Spinner } from '@/components/ui';

export default function NotifikationerPage() {
  const router = useRouter();
  const { institution } = useActiveUser();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!institution?.name) return;
    async function load() {
      const { data } = await db.from('notifications')
        .select('*')
        .eq('institution_name', institution.name)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) {
        setNotes(data);
        const unread = data.filter(n => !n.read).map(n => n.id);
        if (unread.length > 0) {
          await db.from('notifications').update({ read: true }).in('id', unread);
          setNotes(prev => prev.map(n => ({ ...n, read: true })));
        }
      }
      setLoading(false);
    }
    load();
  }, [institution?.name]);

  return (
    <div style={{ minHeight: '100vh', background: '#F6F2EA', paddingTop: 80, paddingBottom: 100 }}>
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '0 0' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px 16px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: INK3, display: 'flex', alignItems: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: INK }}>Notifikationer</span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>
        ) : notes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: INK3, fontFamily: FONT }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔔</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Ingen notifikationer endnu</div>
            <div style={{ fontSize: 14 }}>Vi sender dig besked når dine opslag er godkendt eller afvist.</div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 0, overflow: 'hidden' }}>
            {notes.map((n, i) => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '16px 20px',
                borderBottom: i < notes.length - 1 ? `1px solid ${PAPER2}` : 'none',
                background: n.read ? '#fff' : '#FFF7ED',
              }}>
                <span style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>
                  {n.type === 'listing_review_approved' ? '✅' : n.type === 'listing_review_rejected' ? '❌' : '📬'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONT, fontWeight: n.read ? 600 : 800, fontSize: 15, color: INK, marginBottom: 4 }}>{n.title}</div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: INK3, lineHeight: 1.55 }}>{n.body}</div>
                  <div style={{ fontFamily: FONT, fontSize: 11, color: INK3, marginTop: 6 }}>
                    {new Date(n.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {!n.read && <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#EF476F', flexShrink: 0, marginTop: 6 }} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
