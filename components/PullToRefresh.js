'use client';
import { useState, useRef, useEffect } from 'react';
import { PRIMARY, GREEN_TINT } from '@/lib/constants';

const THRESHOLD = 72; // px of pull before triggering refresh

export default function PullToRefresh({ onRefresh, children }) {
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startYRef = useRef(0);
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const activeRef = useRef(false); // true while a pull gesture is in progress

  useEffect(() => {
    function scrollTop() {
      return window.scrollY || document.documentElement.scrollTop;
    }

    function onTouchStart(e) {
      if (scrollTop() > 2) return;
      startYRef.current = e.touches[0].clientY;
      activeRef.current = true;
    }

    function onTouchMove(e) {
      if (!activeRef.current || refreshingRef.current) return;
      if (scrollTop() > 2) { activeRef.current = false; return; }

      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        distanceRef.current = 0;
        setDistance(0);
        return;
      }

      // Prevent the browser's own overscroll / bounce while we're pulling
      e.preventDefault();

      const clamped = Math.min(dy * 0.45, THRESHOLD * 1.5);
      distanceRef.current = clamped;
      setDistance(clamped);
    }

    async function onTouchEnd() {
      if (!activeRef.current) return;
      activeRef.current = false;

      if (distanceRef.current >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        try { navigator.vibrate?.(10); } catch {}
        try { await onRefresh?.(); } catch {}
        refreshingRef.current = false;
        setRefreshing(false);
      }
      distanceRef.current = 0;
      setDistance(0);
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove',  onTouchMove,  { passive: false });
    document.addEventListener('touchend',   onTouchEnd,   { passive: true });
    document.addEventListener('touchcancel',onTouchEnd,   { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove',  onTouchMove);
      document.removeEventListener('touchend',   onTouchEnd);
      document.removeEventListener('touchcancel',onTouchEnd);
    };
  }, [onRefresh]);

  const progress = Math.min(distance / THRESHOLD, 1);
  const indicatorY = Math.min(distance * 0.6, 52);
  const visible = distance > 6 || refreshing;

  return (
    <>
      {/* Floating pull indicator */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 500,
          pointerEvents: 'none',
          opacity: visible ? 1 : 0,
          transition: refreshing ? 'opacity 0.15s' : 'opacity 0.2s',
        }}
      >
        <div style={{
          marginTop: 8 + indicatorY,
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 10px rgba(22,34,28,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: refreshing ? 'margin-top 0.2s ease' : 'none',
        }}>
          {refreshing ? (
            <div style={{
              width: 18, height: 18,
              border: `2.5px solid ${GREEN_TINT}`,
              borderTopColor: PRIMARY,
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
          ) : (
            <svg
              width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke={PRIMARY} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: `rotate(${progress * 270}deg)`, transition: 'transform 0.05s linear' }}
            >
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
            </svg>
          )}
        </div>
      </div>

      {children}
    </>
  );
}
