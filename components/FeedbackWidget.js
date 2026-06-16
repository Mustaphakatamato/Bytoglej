'use client';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { PRIMARY, GREEN_TINT, GREEN_DEEP, PAPER, PAPER2, PAPER3, INK, INK3, FONT } from '@/lib/constants';
import { db } from '@/lib/supabase';

const CATEGORIES = [
  { key: 'bug',        label: 'Fejl / bug',  emoji: '🐛' },
  { key: 'suggestion', label: 'Forslag',      emoji: '💡' },
  { key: 'general',   label: 'Generelt',      emoji: '⭐' },
];

const FIRST_SHOWN_KEY = 'ltb_pilot_welcomed';

export default function FeedbackWidget({ loggedIn, institutionName, userEmail }) {
  const pathname = usePathname();
  const [open, setOpen]                   = useState(false);
  const [category, setCategory]           = useState('general');
  const [message, setMessage]             = useState('');
  const [sending, setSending]             = useState(false);
  const [sent, setSent]                   = useState(false);
  const [isFirst, setIsFirst]             = useState(false);
  const [error, setError]                 = useState(null);
  const [screenshot, setScreenshot]       = useState(null);   // Blob/File
  const [screenshotPreview, setScreenshotPreview] = useState(null); // object URL
  const [capturing, setCapturing]         = useState(false);
  const [hideForCapture, setHideForCapture] = useState(false);
  const fileInputRef                      = useRef(null);

  useEffect(() => {
    if (!loggedIn) return;
    try {
      if (!localStorage.getItem(FIRST_SHOWN_KEY)) {
        const t = setTimeout(() => {
          setIsFirst(true);
          setOpen(true);
          localStorage.setItem(FIRST_SHOWN_KEY, '1');
        }, 1500);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [loggedIn]);

  // Clean up object URLs
  useEffect(() => {
    return () => { if (screenshotPreview) URL.revokeObjectURL(screenshotPreview); };
  }, [screenshotPreview]);

  function attachBlob(blob) {
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
    setScreenshot(blob);
    setScreenshotPreview(URL.createObjectURL(blob));
  }

  function removeScreenshot() {
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
    setScreenshot(null);
    setScreenshotPreview(null);
  }

  async function captureScreen() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      fileInputRef.current?.click();
      return;
    }
    setCapturing(true);
    // Hide modal + backdrop so the screenshot shows the clean page
    setHideForCapture(true);
    await new Promise(r => setTimeout(r, 150));
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, preferCurrentTab: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      await new Promise(r => { video.onloadedmetadata = r; });
      video.play();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      canvas.toBlob(blob => { if (blob) attachBlob(blob); }, 'image/jpeg', 0.85);
    } catch {
      // User cancelled — do nothing, separate upload button handles file picker
    } finally {
      setHideForCapture(false);
      setCapturing(false);
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    attachBlob(file);
    e.target.value = '';
  }

  async function uploadScreenshot() {
    if (!screenshot) return null;
    try {
      const ext = screenshot.type === 'image/png' ? 'png' : 'jpg';
      const path = `feedback/${Date.now()}.${ext}`;
      const { error } = await db.storage
        .from('feedback-screenshots')
        .upload(path, screenshot, { contentType: screenshot.type || 'image/jpeg', upsert: false });
      if (error) { console.warn('[feedback] screenshot upload fejl:', error.message); return null; }
      const { data: { publicUrl } } = db.storage.from('feedback-screenshots').getPublicUrl(path);
      return publicUrl;
    } catch { return null; }
  }

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    try {
      const screenshotUrl = await uploadScreenshot();

      const { data: { session } } = await db.auth.getSession();
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ category, message, institutionName, userEmail, page: pathname, screenshotUrl }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || json.detail || 'Noget gik galt — prøv igen');
        setSending(false);
        return;
      }
      setError(null);
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
        setMessage('');
        setCategory('general');
        setIsFirst(false);
        removeScreenshot();
      }, 2200);
    } catch {
      setError('Kunne ikke sende — tjek din internetforbindelse');
    }
    setSending(false);
  }

  function handleClose() {
    setOpen(false);
    setSent(false);
    setMessage('');
    setIsFirst(false);
    removeScreenshot();
  }

  if (!loggedIn) return null;

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />

      {/* ── Floating button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Pilot-feedback"
        style={{
          position: 'fixed',
          bottom: 'calc(84px + env(safe-area-inset-bottom, 0px) + 14px)',
          left: 20,
          zIndex: 9990,
          width: 46, height: 46, borderRadius: '50%',
          background: open ? PRIMARY : PAPER,
          border: `1.5px solid ${open ? PRIMARY : PAPER3}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 12px rgba(22,34,28,0.14)',
          fontSize: 20,
          transition: 'all 0.15s',
        }}
      >
        🚀
      </button>

      {open && !hideForCapture && (
        <>
          <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(22,34,28,0.35)', zIndex: 9991, backdropFilter: 'blur(2px)' }} />

          <div style={{
            position: 'fixed',
            bottom: 'calc(84px + env(safe-area-inset-bottom, 0px) + 68px)',
            left: 20,
            zIndex: 9992,
            width: 'min(340px, calc(100vw - 40px))',
            background: PAPER, borderRadius: 20,
            boxShadow: '0 8px 40px rgba(22,34,28,0.18)',
            border: `1px solid ${PAPER3}`,
            fontFamily: FONT, overflow: 'hidden',
          }}>

            {/* Header */}
            <div style={{ background: `linear-gradient(135deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`, padding: '20px 20px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', letterSpacing: '-0.02em', marginBottom: 4 }}>
                    {isFirst ? 'Velkommen til pilotfasen! 🚀' : 'Giv os feedback'}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                    {isFirst
                      ? 'Vi er stadig i gang med at bygge byt&leg. Har du opdaget noget der ikke virker, eller et forslag til os?'
                      : 'Hjælp os med at gøre byt&leg bedre for alle institutioner.'}
                  </div>
                </div>
                <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>✕</button>
              </div>
            </div>

            {sent ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🙏</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: INK, marginBottom: 6 }}>Tak for din feedback!</div>
                <div style={{ fontSize: 13, color: INK3 }}>Vi kigger på det hurtigst muligt.</div>
              </div>
            ) : (
              <div style={{ padding: '16px 20px 20px' }}>
                {/* Category */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  {CATEGORIES.map(c => (
                    <button key={c.key} onClick={() => setCategory(c.key)} style={{
                      flex: 1, padding: '8px 4px', border: `1.5px solid ${category === c.key ? PRIMARY : PAPER3}`,
                      borderRadius: 12, background: category === c.key ? GREEN_TINT : '#fff',
                      cursor: 'pointer', fontFamily: FONT, fontSize: 11, fontWeight: 700,
                      color: category === c.key ? PRIMARY : INK3,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      transition: 'all 0.12s',
                    }}>
                      <span style={{ fontSize: 18 }}>{c.emoji}</span>
                      {c.label}
                    </button>
                  ))}
                </div>

                {/* Text area */}
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={
                    category === 'bug' ? 'Beskriv hvad der gik galt og hvad du forsøgte at gøre…'
                    : category === 'suggestion' ? 'Hvad ville gøre byt&leg bedre for jer?'
                    : 'Hvad tænker du om byt&leg indtil videre?'
                  }
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', border: `1.5px solid ${PAPER3}`,
                    borderRadius: 12, background: PAPER2, fontFamily: FONT, fontSize: 13,
                    color: INK, resize: 'none', outline: 'none', boxSizing: 'border-box',
                    lineHeight: 1.55,
                  }}
                  onFocus={e => { e.target.style.borderColor = PRIMARY; }}
                  onBlur={e => { e.target.style.borderColor = PAPER3; }}
                />

                {/* Screenshot section */}
                <div style={{ marginTop: 10 }}>
                  {screenshotPreview ? (
                    <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1.5px solid ${PAPER3}` }}>
                      <img src={screenshotPreview} alt="Screenshot" style={{ width: '100%', display: 'block', maxHeight: 120, objectFit: 'cover' }} />
                      <button onClick={removeScreenshot} style={{
                        position: 'absolute', top: 6, right: 6,
                        background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%',
                        width: 22, height: 22, color: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                      }}>✕</button>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.45)', padding: '4px 8px', fontSize: 11, color: '#fff', fontFamily: FONT }}>
                        Screenshot vedhæftet ✓
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={captureScreen} disabled={capturing} style={{
                        flex: 1, padding: '8px 6px', borderRadius: 10,
                        border: `1.5px dashed ${PAPER3}`, background: PAPER2,
                        fontFamily: FONT, fontSize: 11, fontWeight: 600, color: INK3,
                        cursor: capturing ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      }}>
                        <span style={{ fontSize: 14 }}>📸</span>
                        {capturing ? 'Vælg skærm…' : 'Tag screenshot'}
                      </button>
                      <button onClick={openFilePicker} disabled={capturing} style={{
                        flex: 1, padding: '8px 6px', borderRadius: 10,
                        border: `1.5px dashed ${PAPER3}`, background: PAPER2,
                        fontFamily: FONT, fontSize: 11, fontWeight: 600, color: INK3,
                        cursor: capturing ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      }}>
                        <span style={{ fontSize: 14 }}>📁</span>
                        Upload billede
                      </button>
                    </div>
                  )}
                </div>

                {institutionName && (
                  <div style={{ fontSize: 11, color: INK3, marginTop: 8 }}>
                    Sender som <strong style={{ color: INK }}>{institutionName}</strong>
                  </div>
                )}

                {/* Send */}
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || sending}
                  style={{
                    width: '100%', marginTop: 10, padding: '12px',
                    borderRadius: 12, border: 'none',
                    background: message.trim() && !sending ? PRIMARY : PAPER3,
                    color: message.trim() && !sending ? '#fff' : INK3,
                    fontFamily: FONT, fontWeight: 700, fontSize: 14,
                    cursor: message.trim() && !sending ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                  }}
                >
                  {sending ? 'Sender…' : 'Send feedback'}
                </button>
                {error && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: '#fee2e2', borderRadius: 10, fontSize: 12, color: '#dc2626', fontFamily: FONT }}>
                    ⚠️ {error}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
