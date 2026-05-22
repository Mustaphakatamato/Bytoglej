import './globals.css';
import { AppProvider } from '@/providers/AppProvider';
import NavWrapper from '@/components/NavWrapper';
import Footer from '@/components/Footer';
import PwaInit from '@/components/PwaInit';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';

export const metadata = {
  title: 'byt&leg — Legetøjsmarkedsplads for institutioner',
  description: 'Den første markedsplads hvor børnehaver, skoler og SFO\'er kan handle legetøj og udstyr bæredygtigt.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="da" style={{ background: '#133F2B' }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        {/* Inline splash CSS — must be here so it applies before any external stylesheet loads */}
        <style dangerouslySetInnerHTML={{ __html: `
          #__splash{position:fixed;inset:0;z-index:9999;background:#133F2B;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;animation:splashHide 0.35s ease-out 0.9s forwards}
          @keyframes splashHide{from{opacity:1}to{opacity:0;visibility:hidden}}
        `}} />

        {/* PWA manifest & theme */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2A7D4F" />

        {/* iOS / Apple */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Byt&Leg" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />

        {/* Favicon */}
        <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />

        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        {/* PWA splash screen — visible from first HTML byte, CSS auto-hides it */}
        <div id="__splash" aria-hidden="true">
          <svg width="90" height="90" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="11" fill="rgba(255,255,255,0.13)" />
            <text x="32" y="27" textAnchor="middle" fontFamily="'Sora',Arial,sans-serif" fontWeight="800" fontSize="21" letterSpacing="-0.06em" fill="#F6F2EA">byt</text>
            <text x="32" y="49" textAnchor="middle" fontFamily="'Sora',Arial,sans-serif" fontWeight="800" fontSize="21" letterSpacing="-0.06em" fill="#F6F2EA">&amp;leg.</text>
          </svg>
          <div style={{ fontFamily: "'Sora',Arial,sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: '-0.04em', color: 'rgba(255,255,255,0.85)', lineHeight: 1.15, textAlign: 'center' }}>
            byt<br />
            <span style={{ color: '#CFE3D8' }}>&amp;</span>leg<span style={{ color: '#CFE3D8' }}>.</span>
          </div>
        </div>
        <AppProvider>
          <NavWrapper />
          {children}
          <Footer />
          <PwaInstallPrompt />
        </AppProvider>
        <PwaInit />
      </body>
    </html>
  );
}
