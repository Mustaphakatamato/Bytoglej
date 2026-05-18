import './globals.css';
import { AppProvider } from '@/providers/AppProvider';
import NavWrapper from '@/components/NavWrapper';

export const metadata = {
  title: 'LegetøjsByt — Find og byt legetøj',
  description: 'Den første markedsplads hvor børnehaver, skoler og SFO\'er kan handle legetøj og udstyr bæredygtigt.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="da">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppProvider>
          <NavWrapper />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
