'use client';
import { usePathname } from 'next/navigation';
import Footer from './Footer';

// Pages where the footer shouldn't show (full-screen app-like views)
const HIDDEN_ON = ['/beskeder'];

export default function FooterWrapper() {
  const pathname = usePathname();
  if (HIDDEN_ON.some(p => pathname?.startsWith(p))) return null;
  return <Footer />;
}
