'use client';
import { useState, useEffect } from 'react';
import { FONT } from '@/lib/constants';

const PRIMARY = '#2A7D4F';
const PAPER2  = '#ECE6DA';
const INK     = '#16221C';
const INK3    = '#6B7570';

function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.MSStream);
}

function isInStandaloneMode() {
  return typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showAndroid,    setShowAndroid]    = useState(false);
  const [showIos,        setShowIos]        = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return; // already installed

    // Android / Chrome install prompt
    const handler = e => {
      e.preventDefault();
      if (sessionStorage.getItem('pwa-dismissed')) return;
      setDeferredPrompt(e);
      setShowAndroid(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS guidance — show once per device (localStorage persists)
    if (isIos() && !localStorage.getItem('ios-pwa-dismissed')) {
      setTimeout(() => setShowIos(true), 3000); // slight delay to not be intrusive
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismissAndroid() {
    sessionStorage.setItem('pwa-dismissed', '1');
    setShowAndroid(false);
  }

  function installAndroid() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(() => {
      setDeferredPrompt(null);
      setShowAndroid(false);
    });
  }

  function dismissIos() {
    localStorage.setItem('ios-pwa-dismissed', '1');
    setShowIos(false);
  }

  const bannerBase = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 8000,
    background: '#fff',
    borderTop: '1px solid rgba(22,34,28,0.10)',
    boxShadow: '0 -4px 24px rgba(22,34,28,0.12)',
    fontFamily: FONT,
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
  };

  if (showAndroid) return (
    <div style={bannerBase}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: INK, marginBottom: 2 }}>Installér Byt&amp;Leg</div>
        <div style={{ fontSize: 12, color: INK3, lineHeight: 1.4 }}>Hurtigt adgang direkte fra din hjemmeskærm</div>
      </div>
      <button onClick={installAndroid} style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 99, padding: '9px 18px', fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
        Installér
      </button>
      <button onClick={dismissAndroid} aria-label="Luk" style={{ background: PAPER2, border: 'none', borderRadius: 99, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: 16, color: INK3 }}>
        ✕
      </button>
    </div>
  );

  if (showIos) return (
    <div style={bannerBase}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: INK, marginBottom: 2 }}>Installér som app på iOS</div>
        <div style={{ fontSize: 12, color: INK3, lineHeight: 1.4 }}>
          Tryk på <strong style={{ color: INK }}>del-ikonet</strong> <span style={{ fontSize: 14 }}>⎙</span> og vælg <strong style={{ color: INK }}>"Føj til hjemmeskærm"</strong>
        </div>
      </div>
      <button onClick={dismissIos} aria-label="Luk" style={{ background: PAPER2, border: 'none', borderRadius: 99, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: 16, color: INK3 }}>
        ✕
      </button>
    </div>
  );

  return null;
}
