import Link from 'next/link';
import { PRIMARY, GREEN_DEEP, PAPER, PAPER2, PAPER3, INK, INK2, INK3, FONT } from '@/lib/constants';

export const metadata = { title: 'Vilkår og betingelser | byt&leg', description: 'Læs byt&legs vilkår og betingelser for brug af platformen.' };

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
            <li style={{ marginBottom: 6 }}>AI-genererede beskrivelser er vejledende. Du er selv ansvarlig for at kontrollere og godkende indholdet.</li>
          </ul>
        </Section>

        <Section title="4. Handel og ansvar">
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>Ved køb og salg gennem byt&amp;leg optræder byt&amp;leg ApS som <strong>mellemhandler</strong>: byt&amp;leg køber varen af sælgerinstitutionen og videresælger den til køberinstitutionen. byt&amp;leg står dermed som modpart i begge led og udsteder alle bilag i handlen i sit eget fortløbende nummersystem.</li>
            <li style={{ marginBottom: 6 }}>Rent bytte (vare-for-vare uden penge) sker direkte mellem institutionerne og er uden moms.</li>
            <li style={{ marginBottom: 6 }}>Betalinger gennemføres sikkert på platformen via vores betalingspartner Stripe. Sælgers provenu indsættes på institutionens byt&amp;leg-konto ved leveringsbekræftelse og kan udbetales til registreret bankkonto.</li>
            <li style={{ marginBottom: 6 }}>byt&amp;leg påtager sig intet ansvar for kvaliteten, tilstanden eller lovligheden af de varer der handles. Sælger indestår for, at varen er som beskrevet.</li>
            <li style={{ marginBottom: 6 }}>Tvister om en vares stand søges løst mellem parterne; byt&amp;leg kan bistå gennem købsbeskyttelsen.</li>
          </ul>
        </Section>

        <Section title="5. Priser, gebyrer og moms">
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>Den pris sælger angiver på et opslag er det beløb, sælger får krediteret (uden moms, da langt de fleste sælgende institutioner ikke er momsregistrerede).</li>
            <li style={{ marginBottom: 6 }}>byt&amp;leg opkræver et servicegebyr ("købsbeskyttelse") på 5 % af varebeløbet + 5 kr. (inkl. moms). Gebyret og fragt tillægges 25 % moms og fremgår som selvstændige linjer på køberfakturaen.</li>
            <li style={{ marginBottom: 6 }}>byt&amp;leg står som sælger over for køber og udsteder salgsfaktura efter <strong>fortjenstmargenordningen for brugte varer</strong> (brugtmoms). Der anføres derfor ikke moms på selve varelinjen, og køber har ikke fradrag for moms af varen.</li>
            <li style={{ marginBottom: 6 }}>Alle priser er i danske kroner (DKK).</li>
          </ul>
        </Section>

        <Section title="5a. Levering og fragt">
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>byt&amp;leg tilbyder en integreret pakkeleveringstjeneste via Shipmondo. Tjenesten er valgfri — institutioner kan altid vælge afhentning eller egen leveringsaftale.</li>
            <li style={{ marginBottom: 6 }}>Vælges pakkelevering, <strong>forudbetales fragten af køber ved checkout</strong>. Fragtprisen fremgår før betaling.</li>
            <li style={{ marginBottom: 6 }}>byt&amp;leg formidler transportaftalen og er ikke part i transportkontrakten mellem afsender og transportør (PostNord, DAO eller GLS).</li>
            <li style={{ marginBottom: 6 }}>byt&amp;leg hæfter ikke for forsinkelser, beskadigelse eller tab af pakker under transport. Reklamationer håndteres direkte med den pågældende transportør.</li>
          </ul>
        </Section>

        <Section title="5b. Selvfakturering (afregningsbilag)">
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>Ved oprettelse som sælger accepterer institutionen, at byt&amp;leg ApS udsteder afregningsbilag (selvfakturering) på institutionens vegne for hvert salg, jf. momsloven § 52 a. Institutionen udsteder ikke selv faktura for salg gennemført via byt&amp;leg.</li>
            <li style={{ marginBottom: 6 }}>For hvert salg modtager institutionen et afregningsbilag mærket "selvfakturering". Bilaget anses for godkendt, medmindre institutionen gør indsigelse via platformen inden 8 dage.</li>
            <li style={{ marginBottom: 6 }}>Da sælgende institutioner typisk ikke er momsregistrerede, sker leverancen uden moms, og der anføres ikke momsbeløb på afregningsbilaget.</li>
          </ul>
        </Section>

        <Section title="5c. Bilag og opbevaring">
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li style={{ marginBottom: 6 }}>Køber og sælger kan til enhver tid downloade alle egne bilag (købsfakturaer, afregningsbilag og udbetalingsbilag) under Min konto → Bilag.</li>
            <li style={{ marginBottom: 6 }}>byt&amp;leg opbevarer alle bilag digitalt i mindst 5 år efter udgangen af det pågældende regnskabsår, jf. bogføringsloven.</li>
          </ul>
        </Section>

        <Section title="6. Immaterielle rettigheder">
          <p>Alt indhold på platformen, herunder design, tekst og funktionalitet, tilhører byt&amp;leg. Du beholder rettighederne til det indhold (billeder, tekster) du selv uploader, men giver byt&amp;leg en ikke-eksklusiv licens til at vise det på platformen.</p>
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
