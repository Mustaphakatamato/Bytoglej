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
    <html lang="da">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />

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
