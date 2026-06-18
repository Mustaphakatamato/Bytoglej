'use client';
import { useEffect, useRef, useState } from 'react';

// Respekterer brugerens "reduceret bevægelse"-indstilling.
// Returnerer true hvis bevægelse SKAL slås fra.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const fn = e => setReduced(e.matches);
    mq.addEventListener?.('change', fn);
    return () => mq.removeEventListener?.('change', fn);
  }, []);
  return reduced;
}

const VARIANTS = {
  up:    'translateY(40px)',
  down:  'translateY(-40px)',
  left:  'translateX(-56px)',
  right: 'translateX(56px)',
  scale: 'scale(0.92)',
  none:  'none',
};

// Blød scroll-reveal. Toner + glider indhold ind når det kommer i syne.
// Falder elegant tilbage til "vis med det samme" ved prefers-reduced-motion.
export default function Reveal({
  children,
  variant = 'up',
  delay = 0,
  duration = 750,
  threshold = 0.15,
  once = true,
  as: Tag = 'div',
  style = {},
  ...rest
}) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (reduced) { setShown(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          if (once) io.disconnect();
        } else if (!once && entry.boundingClientRect.top > 0) {
          setShown(false);
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, threshold, once]);

  const hiddenTransform = VARIANTS[variant] || VARIANTS.up;

  return (
    <Tag
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0) translateX(0) scale(1)' : hiddenTransform,
        transition: reduced
          ? 'none'
          : `opacity ${duration}ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: 'opacity, transform',
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
