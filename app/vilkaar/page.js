import Link from 'next/link';
import { PRIMARY, GREEN_DEEP, PAPER, PAPER2, PAPER3, INK, INK2, INK3 } from '@/lib/constants';

const FONT = "'Sora', sans-serif";

export const metadata = { title: 'Vilkår og betingelser — byt&leg', description: 'Læs byt&legs vilkår og betingelser for brug af platformen.' };

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 20, color: INK, marginBottom: 12, letterSpacing: '-0.03em' }}>{title}</h2>
      <div style={{ fontSize: 15, color: INK2, lineHeight: 1.75 }}>{children}</div>
    </div>
  );
}

export default function VilkaarPage() {
  return (
    <div style={{ minHeight: '100vh', background: PAPER }}>
      <div style={{ background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`, paddingTop: 100, paddingBottom: 48 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, fontFamily: FONT, textDecoration: 'none' }}>← Forside</Link>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: 38, color: '#fff', letterSpacing: '-0.04em', marginTop: 16, marginBottom: 8 }}>Vilkår og betingelser</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', fontFamily: FONT }}>Sidst opdateret: juni 2025</p>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ background: PAPER2, border: `1px solid ${PAPER3}`, borderRadius: 16, padding: '16px 24px', marginBottom: 40, fontSize: 14, color: INK2, fontFamily: FONT, lineHeight: 1.65 }}>
          Ved at oprette en konto og bruge byt&amp;leg accepterer du disse vilkår. Platformen er forbeholdt registrerede danske daginstitutioner, skoler og vuggestuer.
        </div>

        <Section title="1. Om platformen">
          <p>byt&amp;leg er en digital markedsplads der gør det muligt for institutioner at bytte, købe og sælge legetøj og udstyr bæredygtigt. Platformen drives af byt&amp;leg og er udelukkende til institutionsbrug.</p>
        </Section>

        <Section title="2. Adgang og konto">
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>Kun registrerede institutioner med gyldigt CVR- eller P-nummer kan oprette konto.</li>
            <li style={{ marginBottom: 6 }}>Du er ansvarlig for at holde dine loginoplysninger fortrolige.</li>
            <li style={{ marginBottom: 6 }}>Du må ikke oprette konto på vegne af en institution, du ikke repræsenterer.</li>
            <li style={{ marginBottom: 6 }}>byt&amp;leg forbeholder sig ret til at suspendere eller slette konti der misbruger platformen.</li>
          </ul>
        </Section>

        <Section title="3. Opslag og indhold">
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>Du er ansvarlig for at opslag er korrekte, lovlige og ikke krænker tredjeparts rettigheder.</li>
            <li style={{ marginBottom: 6 }}>Det er ikke tilladt at sælge farlige, beskadigede eller tilbagekaldte produkter.</li>
            <li style={{ marginBottom: 6 }}>byt&amp;leg kan til enhver tid fjerne opslag der vurderes at være i strid med disse vilkår.</li>
            <li style={{ marginBottom: 6 }}>AI-genererede beskrivelser er vejledende — du er selv ansvarlig for at kontrollere og godkende indholdet.</li>
          </ul>
        </Section>

        <Section title="4. Handel og ansvar">
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>byt&amp;leg er en formidlingsplatform og er ikke part i handler mellem institutioner.</li>
            <li style={{ marginBottom: 6 }}>byt&amp;leg påtager sig intet ansvar for kvaliteten, tilstanden eller lovligheden af de varer der handles.</li>
            <li style={{ marginBottom: 6 }}>Tvister mellem institutioner skal løses direkte mellem de involverede parter.</li>
            <li style={{ marginBottom: 6 }}>Betalinger foregår uden om platformen og er udelukkende et anliggende mellem køber og sælger.</li>
          </ul>
        </Section>

        <Section title="5. Priser og gebyrer">
          <p>byt&amp;leg er i øjeblikket gratis at bruge. Vi forbeholder os retten til at indføre gebyrer i fremtiden med mindst 30 dages varsel til eksisterende brugere.</p>
        </Section>

        <Section title="6. Immaterielle rettigheder">
          <p>Alt indhold på platformen — herunder design, tekst og funktionalitet — tilhører byt&amp;leg. Du beholder rettighederne til det indhold (billeder, tekster) du selv uploader, men giver byt&amp;leg en ikke-eksklusiv licens til at vise det på platformen.</p>
        </Section>

        <Section title="7. Ansvarsfraskrivelse">
          <p>Platformen stilles til rådighed "som den er og forefindes". byt&amp;leg garanterer ikke uafbrudt adgang og fraskriver sig ansvar for tab der opstår i forbindelse med brug af platformen, herunder tab af data eller indtægt.</p>
        </Section>

        <Section title="8. Ændringer">
          <p>Vi kan opdatere disse vilkår. Væsentlige ændringer meddeles via e-mail til registrerede brugere med mindst 14 dages varsel. Fortsat brug af platformen efter varslet udgør accept af de nye vilkår.</p>
        </Section>

        <Section title="9. Lovvalg">
          <p>Disse vilkår er underlagt dansk ret. Eventuelle tvister behandles ved de danske domstole.</p>
        </Section>

        <Section title="10. Kontakt">
          <p>Spørgsmål til disse vilkår kan rettes til <a href="mailto:kontakt@bytogleg.dk" style={{ color: PRIMARY }}>kontakt@bytogleg.dk</a>.</p>
        </Section>

        <div style={{ borderTop: `1px solid ${PAPER3}`, paddingTop: 24, fontSize: 13, color: INK3, fontFamily: FONT }}>
          Spørgsmål? Skriv til <a href="mailto:kontakt@bytogleg.dk" style={{ color: PRIMARY }}>kontakt@bytogleg.dk</a>
        </div>
      </div>
    </div>
  );
}
