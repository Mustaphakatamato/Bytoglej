'use client';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }) {
  const pathname = usePathname();
  return (
    <div key={pathname} style={{ animation: 'pageIn 0.35s ease both', willChange: 'opacity, transform' }}>
      {children}
    </div>
  );
}
