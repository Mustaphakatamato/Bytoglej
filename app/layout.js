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
    <html lang="da" style={{ background: '#F6F2EA' }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        {/* Inline splash CSS — paper bg matches browser default so no white flash, slide-up exit */}
        <style dangerouslySetInnerHTML={{ __html: `
          #__splash{position:fixed;inset:0;z-index:9999;background:#F6F2EA;display:flex;align-items:center;justify-content:center;animation:splashExit 0.5s cubic-bezier(0.4,0,0.2,1) 0.85s forwards}
          @keyframes splashExit{from{transform:translateY(0)}to{transform:translateY(-100%);visibility:hidden}}
          #__sl{display:flex;align-items:center;gap:14px;animation:logoIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.05s both}
          @keyframes logoIn{from{opacity:0;transform:scale(0.72) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}}
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
        {/* Splash — paper bg = invisible transition from browser default, logo springs in, splash slides up */}
        <div id="__splash" aria-hidden="true">
          <div id="__sl">
            <svg width="58" height="58" viewBox="0 0 64 64">
              <rect width="64" height="64" rx="11" fill="#2A7D4F" />
              <text x="32" y="27" textAnchor="middle" fontFamily="'Sora',Arial,sans-serif" fontWeight="800" fontSize="21" letterSpacing="-0.06em" fill="#F6F2EA">byt</text>
              <text x="32" y="49" textAnchor="middle" fontFamily="'Sora',Arial,sans-serif" fontWeight="800" fontSize="21" letterSpacing="-0.06em" fill="#F6F2EA">&amp;leg.</text>
            </svg>
            <div style={{ fontFamily: "'Sora',Arial,sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: '-0.04em', lineHeight: 1.1 }}>
              <div style={{ color: '#16221C' }}>byt</div>
              <div><span style={{ color: '#2A7D4F' }}>&amp;</span><span style={{ color: '#16221C' }}>leg</span><span style={{ color: '#2A7D4F' }}>.</span></div>
            </div>
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
