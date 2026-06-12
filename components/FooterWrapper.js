'use client';
import { usePathname } from 'next/navigation';
import Footer from './Footer';
import { useWindowWidth } from '@/lib/hooks';

const HIDDEN_ON = ['/beskeder', '/admin'];

export default function FooterWrapper() {
  const pathname = usePathname();
  const w = useWindowWidth();
  if (HIDDEN_ON.some(p => pathname?.startsWith(p))) return null;
  if (w > 0 && w < 768) return null;
  return <Footer />;
}
