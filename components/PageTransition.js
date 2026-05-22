'use client';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

export default function PageTransition({ children }) {
  const pathname = usePathname();
  const [display, setDisplay] = useState(children);
  const [visible, setVisible] = useState(true);
  const isFirst = useRef(true);
  const timer = useRef(null);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    clearTimeout(timer.current);
    setVisible(false);
    timer.current = setTimeout(() => {
      setDisplay(children);
      setVisible(true);
    }, 200);
    return () => clearTimeout(timer.current);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(10px)',
        transition: visible
          ? 'opacity 0.32s ease, transform 0.32s ease'
          : 'opacity 0.18s ease, transform 0.18s ease',
        willChange: 'opacity, transform',
      }}
    >
      {display}
    </div>
  );
}
