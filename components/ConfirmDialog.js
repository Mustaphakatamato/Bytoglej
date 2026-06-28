'use client';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { PRIMARY, INK, FONT } from '@/lib/constants';

// Bekræftelses-dialog (fx før log ud) — Vinted-agtig: titel, primær handling, og en "fortryd"-knap.
export default function ConfirmDialog({
  open,
  title,
  confirmLabel = 'Bekræft',
  cancelLabel = 'Annuller',
  onConfirm,
  onCancel,
  danger = false,
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!mounted || !open) return null;

  const accent = danger ? '#e11d48' : PRIMARY;

  return createPortal(
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(22,34,28,0.45)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          background: '#fff', borderRadius: 22, padding: '28px 24px 18px',
          width: 'min(380px, 100%)', boxShadow: '0 12px 48px rgba(0,0,0,0.22)',
          fontFamily: FONT, textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 19, fontWeight: 800, color: INK, marginBottom: 22, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
          {title}
        </div>
        <button
          onClick={onConfirm}
          style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
            background: accent, color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 15,
            cursor: 'pointer', marginBottom: 6,
          }}
        >
          {confirmLabel}
        </button>
        <button
          onClick={onCancel}
          style={{
            width: '100%', padding: '12px', borderRadius: 14, border: 'none',
            background: 'none', color: accent, fontFamily: FONT, fontWeight: 700, fontSize: 15,
            cursor: 'pointer',
          }}
        >
          {cancelLabel}
        </button>
      </div>
    </div>,
    document.body
  );
}
