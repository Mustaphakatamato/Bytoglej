import Link from 'next/link';
import { PRIMARY, GREEN_DEEP, PAPER, PAPER2, PAPER3, INK, INK2, INK3 } from '@/lib/constants';

const FONT = "'Sora', sans-serif";

export const metadata = { title: 'Privatlivspolitik — byt&leg', description: 'Læs om hvordan byt&leg behandler dine data.' };

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: INK, marginBottom: 12, letterSpacing: '-0.03em' }}>{title}</h2>
      <div style={{ fontSize: 15, color: INK2, lineHeight: 1.75 }}>{children}</div>
    </div>
  );
}

export default function PrivatlivspolitikPage() {
  return (
    <div style={{ minHeight: '100vh', background: PAPER }}>
      <div style={{ background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`, paddingTop: 100, paddingBottom: 48, position: 'relative' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, fontFamily: FONT, textDecoration: 'none' }}>← Forside</Link>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 38, color: '#fff', letterSpacing: '-0.04em', marginTop: 16, marginBottom: 8 }}>Privatlivspolitik</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', fontFamily: FONT }}>Sidst opdateret: juni 2025</p>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ background: PAPER2, border: `1px solid ${PAPER3}`, borderRadius: 16, padding: '16px 24px', marginBottom: 40, fontSize: 14, color: INK2, fontFamily: FONT, lineHeight: 1.65 }}>
          byt&amp;leg er en markedsplads til danske daginstitutioner, skoler og vuggestuer. Vi tager dit privatliv alvorligt og behandler dine data i henhold til GDPR.
        </div>

        <Section title="1. Dataansvarlig">
          <p>Dataansvarlig for behandling af personoplysninger på byt&amp;leg er:</p>
          <p style={{ marginTop: 8 }}><strong>byt&amp;leg</strong><br />Email: <a href="mailto:kontakt@bytogleg.dk" style={{ color: PRIMARY }}>kontakt@bytogleg.dk</a></p>
        </Section>

        <Section title="2. Hvilke data indsamler vi?">
          <p>Vi indsamler og behandler følgende oplysninger:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}><strong>Kontaktoplysninger:</strong> Email-adresse og institutionsnavn ved oprettelse af konto</li>
            <li style={{ marginBottom: 6 }}><strong>Opslagsdata:</strong> Titler, beskrivelser, billeder og priser på opslag I opretter</li>
            <li style={{ marginBottom: 6 }}><strong>Kommunikation:</strong> Beskeder sendt mellem institutioner via platformen</li>
            <li style={{ marginBottom: 6 }}><strong>Tekniske data:</strong> IP-adresse, browsertype og besøgsdata via Supabase og serverlogfiler</li>
          </ul>
          <p style={{ marginTop: 8 }}>Vi indsamler <strong>ikke</strong> CPR-numre, betalingsoplysninger eller andre følsomme personoplysninger.</p>
        </Section>

        <Section title="3. Formål med behandlingen">
          <p>Vi behandler dine data for at:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>Oprette og administrere din institutionskonto</li>
            <li style={{ marginBottom: 6 }}>Vise dine opslag til andre brugere af platformen</li>
            <li style={{ marginBottom: 6 }}>Sende notifikationer om beskeder og nye matches</li>
            <li style={{ marginBottom: 6 }}>Forbedre platformen og løse tekniske fejl</li>
          </ul>
        </Section>

        <Section title="4. Retsgrundlag">
          <p>Behandlingen sker på grundlag af:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}><strong>Aftale (GDPR art. 6(1)(b)):</strong> For at opfylde brugeraftalen (oprettelse og brug af konto)</li>
            <li style={{ marginBottom: 6 }}><strong>Legitim interesse (GDPR art. 6(1)(f)):</strong> Drifts- og sikkerhedsformål</li>
          </ul>
        </Section>

        <Section title="5. Deling af data">
          <p>Vi deler dine data med:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}><strong>Supabase</strong> (databaseudbyder, EU-servere) — opbevaring af alle data</li>
            <li style={{ marginBottom: 6 }}><strong>Resend</strong> (email-udbyder) — udsendelse af notifikationer</li>
            <li style={{ marginBottom: 6 }}><strong>Groq / Google Gemini</strong> — AI-behandling af billedbeskrivelser og søgninger (ingen persondata sendes)</li>
          </ul>
          <p style={{ marginTop: 8 }}>Vi sælger <strong>aldrig</strong> dine data til tredjepart.</p>
        </Section>

        <Section title="6. Opbevaring">
          <p>Dine data opbevares så længe din konto er aktiv. Sletter du din konto, slettes dine personoplysninger inden for 30 dage. Opslag kan dog forblive i arkiveret form af hensyn til andre brugeres transaktionshistorik.</p>
        </Section>

        <Section title="7. Dine rettigheder">
          <p>Du har ret til at:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>Få indsigt i hvilke data vi behandler om dig</li>
            <li style={{ marginBottom: 6 }}>Få forkerte data rettet</li>
            <li style={{ marginBottom: 6 }}>Få dine data slettet ("retten til at blive glemt")</li>
            <li style={{ marginBottom: 6 }}>Gøre indsigelse mod behandlingen</li>
            <li style={{ marginBottom: 6 }}>Klage til Datatilsynet: <a href="https://www.datatilsynet.dk" target="_blank" rel="noopener noreferrer" style={{ color: PRIMARY }}>datatilsynet.dk</a></li>
          </ul>
          <p style={{ marginTop: 8 }}>Kontakt os på <a href="mailto:kontakt@bytogleg.dk" style={{ color: PRIMARY }}>kontakt@bytogleg.dk</a> for at udøve dine rettigheder.</p>
        </Section>

        <Section title="8. Cookies">
          <p>Vi bruger udelukkende nødvendige cookies til at holde dig logget ind (sessionsbaserede cookies via Supabase Auth). Vi benytter ikke tredjeparts-reklame-cookies.</p>
        </Section>

        <Section title="9. Ændringer">
          <p>Vi kan opdatere denne politik. Væsentlige ændringer vil blive kommunikeret via email til registrerede brugere.</p>
        </Section>

        <div style={{ borderTop: `1px solid ${PAPER3}`, paddingTop: 24, fontSize: 13, color: INK3, fontFamily: FONT }}>
          Spørgsmål? Skriv til <a href="mailto:kontakt@bytogleg.dk" style={{ color: PRIMARY }}>kontakt@bytogleg.dk</a>
        </div>
      </div>
    </div>
  );
}
