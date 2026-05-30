'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp, useActiveUser } from '@/providers/AppProvider';
import { db } from '@/lib/supabase';
import { PRIMARY, GREEN_TINT, GREEN_SOFT, PAPER, PAPER2, PAPER3, INK, INK2, INK3, CORAL } from '@/lib/constants';
import { useWindowWidth } from '@/lib/hooks';
import { CATEGORIES } from '@/lib/categories';

const FONT = "'Sora', sans-serif";

export default function CartPage() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 768;
  const { cart, removeFromCart, clearCart, setSelectedConvId, showToast } = useApp();
  const { userId, institutionId, institution } = useActiveUser();
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  // Group by seller institution
  const groups = useMemo(() => {
    const map = {};
    for (const item of (cart || [])) {
      const key = item.ownerInstitutionName;
      if (!map[key]) map[key] = { ownerInstitutionName: key, ownerId: item.ownerId, items: [] };
      map[key].items.push(item);
    }
    return Object.values(map);
  }, [cart]);

  const totalItems = cart?.length || 0;
  const totalPrice = cart?.reduce((s, i) => s + (i.price || 0), 0) || 0;

  async function handleCheckout() {
    if (!userId) { router.push('/login'); return; }
    setSending(true);
    try {
      const senderName = institution?.name || 'Ukendt institution';
      const myInstId = institutionId || null;
      let lastConvId = null;

      for (const group of groups) {
        const { data: ownerInst } = await db.from('institutions')
          .select('id,email,name')
          .ilike('name', group.ownerInstitutionName)
          .maybeSingle();

        // Find or create conversation
        const orFilter = myInstId
          ? `initiator_institution_id.eq.${myInstId},initiator_id.eq.${userId}`
          : `initiator_id.eq.${userId}`;
        const firstItem = group.items[0];
        const { data: existing } = await db.from('conversations')
          .select('id,owner_unread')
          .eq('listing_id', firstItem.listingId)
          .or(orFilter)
          .maybeSingle();

        let convId, ownerUnread;
        if (existing) {
          convId = existing.id;
          ownerUnread = existing.owner_unread || 0;
        } else {
          const { data: conv } = await db.from('conversations').insert({
            listing_id: firstItem.listingId,
            listing_title: firstItem.listingTitle,
            listing_emoji: firstItem.listingEmoji || '🛒',
            listing_color: firstItem.listingColor,
            listing_image: firstItem.images?.[0] || null,
            initiator_id: userId,
            initiator_name: senderName,
            initiator_institution_id: myInstId,
            owner_id: group.ownerId,
            owner_name: group.ownerInstitutionName,
            owner_institution_id: ownerInst?.id || null,
          }).select().single();
          convId = conv?.id;
          ownerUnread = 0;

          if (conv && ownerInst?.email && ownerInst.email.toLowerCase() !== (institution?.email || '').toLowerCase()) {
            fetch('/api/notify-message', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ownerEmail: ownerInst.email, ownerName: ownerInst.name, senderName, listingTitle: firstItem.listingTitle, listingEmoji: firstItem.listingEmoji, convId }),
            }).catch(() => {});
          }
        }

        if (!convId) continue;

        // Build buy_request message
        const buyData = {
          items: group.items.map(i => ({ listingId: i.listingId, title: i.listingTitle, price: i.price, emoji: i.listingEmoji, category: i.category })),
          totalPrice: group.items.reduce((s, i) => s + (i.price || 0), 0),
          note: note.trim() || null,
          buyerName: senderName,
        };
        const msgText = `Købsforespørgsel: ${group.items.map(i => i.listingTitle).join(', ')} — ${buyData.totalPrice} kr.`;
        await db.from('chat_messages').insert({
          conversation_id: convId,
          sender_id: userId,
          sender_name: senderName,
          content: JSON.stringify(buyData),
          message_type: 'buy_request',
        });
        await db.from('conversations').update({
          last_message: msgText,
          last_message_at: new Date().toISOString(),
          owner_unread: ownerUnread + 1,
        }).eq('id', convId);
        lastConvId = convId;
      }

      clearCart();
      showToast('Forespørgsler sendt! 🎉');
      if (lastConvId) setSelectedConvId(lastConvId);
      router.push('/beskeder');
    } catch (err) {
      showToast('Noget gik galt — prøv igen', 'error');
    }
    setSending(false);
  }

  if (totalItems === 0) {
    return (
      <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>🛒</div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, color: INK, marginBottom: 8 }}>Din kurv er tom</div>
        <p style={{ fontFamily: FONT, fontSize: 14, color: INK3, marginBottom: 28, textAlign: 'center' }}>
          Find køb-opslag og tryk "Læg i kurv" for at samle dine indkøb.
        </p>
        <button onClick={() => router.push('/opslag')} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, padding: '12px 28px', fontFamily: FONT, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          Se opslag →
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: PAPER, paddingTop: 80, paddingBottom: 80 }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: isMobile ? '0 16px' : '0 24px' }}>

        <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 26 : 34, color: INK, letterSpacing: '-0.03em', marginBottom: 6 }}>
          Din indkøbsvogn
        </h1>
        <p style={{ fontFamily: FONT, fontSize: 14, color: INK3, marginBottom: 32 }}>
          {totalItems} vare{totalItems !== 1 ? 'r' : ''} fra {groups.length} sælger{groups.length !== 1 ? 'e' : ''}
        </p>

        {/* Groups */}
        {groups.map((group, gi) => {
          const groupTotal = group.items.reduce((s, i) => s + (i.price || 0), 0);
          return (
            <div key={gi} style={{ background: '#fff', borderRadius: 20, border: `1px solid ${GREEN_SOFT}`, marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${PAPER2}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, fontFamily: FONT, flexShrink: 0 }}>
                  {group.ownerInstitutionName?.charAt(0)?.toUpperCase()}
                </div>
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, flex: 1 }}>{group.ownerInstitutionName}</div>
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: PRIMARY }}>{groupTotal} kr.</div>
              </div>
              {group.items.map((item, ii) => {
                const cat = CATEGORIES.find(c => c.key === item.category);
                return (
                  <div key={ii} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: ii < group.items.length - 1 ? `1px solid ${PAPER2}` : 'none' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 12, background: item.images?.[0] ? '#ddd' : (item.listingColor || GREEN_TINT), overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                      {item.images?.[0]
                        ? <img src={item.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (item.listingEmoji || '🧸')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: INK, lineHeight: 1.3 }}>{item.listingTitle}</div>
                      {cat && <div style={{ fontFamily: FONT, fontSize: 12, color: INK3, marginTop: 2 }}>{cat.emoji} {cat.label}</div>}
                    </div>
                    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: item.price ? PRIMARY : INK3, flexShrink: 0 }}>
                      {item.price ? `${item.price} kr.` : '—'}
                    </div>
                    <button onClick={() => removeFromCart(item.listingId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: INK3, padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Note */}
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${GREEN_SOFT}`, padding: '16px 20px', marginBottom: 20 }}>
          <label style={{ display: 'block', fontFamily: FONT, fontWeight: 700, fontSize: 13, color: INK, marginBottom: 8 }}>
            Besked til sælger(e) (valgfri)
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Fx: Kan hente mandag-onsdag, kontakt os på tlf. 12345678"
            rows={3}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${PAPER3}`, fontFamily: FONT, fontSize: 14, resize: 'none', outline: 'none', background: PAPER2, boxSizing: 'border-box' }}
          />
        </div>

        {/* Summary + checkout */}
        <div style={{ background: GREEN_TINT, borderRadius: 16, border: `1px solid ${GREEN_SOFT}`, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontFamily: FONT, fontSize: 14, color: INK2 }}>Total ({totalItems} vare{totalItems !== 1 ? 'r' : ''})</span>
            <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: INK }}>{totalPrice} kr.</span>
          </div>
          <p style={{ fontFamily: FONT, fontSize: 12, color: INK3, margin: 0 }}>
            Der sendes én forespørgsel pr. sælger. Sælger bekræfter afhentning i chatten.
          </p>
        </div>

        <button onClick={handleCheckout} disabled={sending} style={{
          width: '100%', padding: '16px', borderRadius: 99,
          background: sending ? PAPER3 : PRIMARY, color: sending ? INK3 : '#fff',
          border: 'none', fontFamily: FONT, fontWeight: 700, fontSize: 16,
          cursor: sending ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
        }}>
          {sending ? 'Sender forespørgsler…' : `Send ${groups.length > 1 ? `${groups.length} forespørgsler` : 'forespørgsel'} →`}
        </button>

        <button onClick={() => router.back()} style={{ width: '100%', marginTop: 12, padding: '12px', borderRadius: 99, background: 'none', border: 'none', fontFamily: FONT, fontWeight: 600, fontSize: 14, color: INK3, cursor: 'pointer' }}>
          ← Fortsæt med at handle
        </button>
      </div>
    </div>
  );
}
