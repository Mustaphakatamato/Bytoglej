'use client';
import { useRouter } from 'next/navigation';
import { useWindowWidth } from '@/lib/hooks';
import { PRIMARY, GREEN_DEEP, GREEN_SOFT, GREEN_TINT, PAPER, PAPER2, INK, INK2, INK3 } from '@/lib/constants';
import { EMISSION_FACTORS, METHODOLOGY_VERSION } from '@/lib/co2/emission-factors';

const FONT = "'Sora', sans-serif";

const SOURCES = [
  { id: 'S1', ref: 'Robertson, K. & Klimas, C. (2022). "A life cycle assessment of the environmental impact of children\'s toys." Sustainable Production and Consumption, ScienceDirect.', url: 'https://www.sciencedirect.com/science/article/abs/pii/S2352550922000550' },
  { id: 'S2', ref: 'McGrew, M. (2023). "Reducing the Carbon Footprint of Plastic Toys." Indiana University, Celebration of Student Writing.', url: 'https://iu.pressbooks.pub/celeb2023/chapter/28/' },
  { id: 'S3', ref: 'Ciechelska, A. et al. (2024). "Circular economy rebound effect in the context of second-hand clothing consumption." Economics and Environment.', url: 'https://ekonomiaisrodowisko.pl/journal/article/view/635' },
  { id: 'S4', ref: 'Pedersen et al. (2024). "Reuse of consumer products: Climate account and rebound effects potential." Sustainable Production and Consumption.', url: 'https://www.sciencedirect.com/science/article/pii/S2352550924003622' },
  { id: 'S5', ref: 'University of Michigan, Center for Sustainable Systems (2024). "Carbon Footprint Factsheet."', url: 'https://css.umich.edu/publications/factsheets/sustainability-indicators/carbon-footprint-factsheet' },
  { id: 'S6', ref: 'Depop (2022). "Displacement rate research."', url: 'https://news.depop.com/company-news/depop-displacement-rate-research/' },
  { id: 'S7', ref: 'Klooster et al. (2024). "Do we save the environment by buying second-hand clothes?" Journal of Circular Economy.', url: 'https://circulareconomyjournal.org/wp-content/uploads/2024/07/Klooster_et_al_Do-we-save-the-environment-by-buying-second-hand-clothes-The-environmental-impacts-of-second-hand-textile-fashion-and-the-influence-of-consumer-choices.pdf' },
  { id: 'S8', ref: 'European Environment Agency (2024). "CO₂ performance of new passenger cars in Europe."', url: 'https://www.eea.europa.eu/en/analysis/indicators/co2-performance-of-new-passenger' },
];

export default function MetodePage() {
  const router = useRouter();
  const w = useWindowWidth();
  const isMobile = w < 768;

  const prose = { fontFamily: FONT, fontSize: 15, color: INK2, lineHeight: 1.75 };
  const h2 = { fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 20 : 24, color: INK, marginTop: 40, marginBottom: 12, letterSpacing: '-0.02em' };
  const h3 = { fontFamily: FONT, fontWeight: 700, fontSize: 17, color: INK, marginTop: 24, marginBottom: 8 };

  return (
    <div style={{ minHeight: '100vh', background: PAPER }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${GREEN_DEEP} 0%, ${PRIMARY} 100%)`, paddingTop: 90, paddingBottom: 48 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 99, padding: '7px 16px', color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, marginBottom: 20 }}>← Tilbage</button>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 99, padding: '5px 14px', marginBottom: 16 }}>
            <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Metode v{METHODOLOGY_VERSION} · 2026-05-30</span>
          </div>
          <h1 style={{ fontFamily: FONT, fontWeight: 800, fontSize: isMobile ? 28 : 40, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 12 }}>
            Sådan beregner vi CO₂-besparelser på byt&amp;leg
          </h1>
          <p style={{ fontFamily: FONT, fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65 }}>
            byt&amp;leg vil ikke overdrive jeres miljøgevinster. Vi bruger konservative estimater baseret på publiceret livscyklusanalyse-litteratur (LCA), og vi er fuldt transparente om vores metode, antagelser og kilder.
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? '36px 20px 80px' : '52px 24px 100px' }}>

        {/* Formel */}
        <h2 style={h2}>Hovedformel</h2>
        <p style={prose}>For hver gennemført byttehandel beregner vi:</p>
        <div style={{ background: GREEN_TINT, border: `1px solid ${GREEN_SOFT}`, borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Courier New', monospace", fontSize: 14, color: PRIMARY, fontWeight: 700, lineHeight: 2 }}>
            Sparet CO₂e = (Produktions-CO₂ × displacement rate) − Transport-CO₂
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {[
            ['Produktions-CO₂', 'Det estimerede klimafodaftryk ved at producere et nyt tilsvarende produkt'],
            ['Displacement rate', 'Sandsynligheden for at en brugt vare faktisk erstatter et nyt køb (i stedet for blot at være ekstra forbrug)'],
            ['Transport-CO₂', 'Udledning fra at flytte legetøjet mellem institutionerne (tur/retur, inkl. 30% rute-buffer)'],
          ].map(([term, def]) => (
            <div key={term} style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: PRIMARY, minWidth: 160, flexShrink: 0 }}>{term}</span>
              <span style={{ ...prose, fontSize: 14 }}>{def}</span>
            </div>
          ))}
        </div>

        {/* Antagelser */}
        <h2 style={h2}>Antagelser i nuværende version (v{METHODOLOGY_VERSION})</h2>

        <h3 style={h3}>Produktions-CO₂ pr. kategori</h3>
        <p style={prose}>Vi har defineret 20 kategorier. Tallene er valgt i den <strong>konservative ende</strong> af publicerede LCA-ranges.</p>
        <div style={{ overflowX: 'auto', marginBottom: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT, fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${GREEN_SOFT}` }}>
                {['Kategori', 'kg CO₂e/enhed', 'Kilder'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, color: PRIMARY }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(EMISSION_FACTORS).map(([id, f], i) => (
                <tr key={id} style={{ borderBottom: `1px solid ${PAPER2}`, background: i % 2 === 0 ? '#fff' : PAPER }}>
                  <td style={{ padding: '8px 12px', color: INK }}>{f.nameDA}</td>
                  <td style={{ padding: '8px 12px', color: PRIMARY, fontWeight: 700 }}>{f.co2KgPerUnit}</td>
                  <td style={{ padding: '8px 12px', color: INK3 }}>{f.sources.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={h3}>Displacement rate: 0,6</h3>
        <p style={prose}>
          Akademisk litteratur for genbrugsmarkedspladser opererer typisk med displacement rates mellem 0,5 og 0,9 (S3, S6, S7). Vi har valgt 0,6 som konservativt estimat. Det betyder: vi antager at kun 60% af byttehandler reelt erstatter et nyt køb, mens 40% potentielt er ekstra forbrug (rebound-effekt). Denne værdi vil blive opdateret når vi har gennemført brugerundersøgelser.
        </p>

        <h3 style={h3}>Transport</h3>
        <p style={prose}>
          Vi antager personbil-transport med en gennemsnitlig real-world emission på 170 g CO₂e/km (EEA 2024, S8). Afstanden beregnes som fugleflugt-distance (Haversine) mellem institutionernes adresser, ganget med 1,3 som rute-buffer, og derefter fordoblet (tur/retur). Hvis geocoding fejler, bruges 25 km som standard-estimat.
        </p>
        <p style={prose}>
          Hvis legetøjet flyttes med ladcykel, elcykel eller som del af eksisterende bilkørsel, er den faktiske besparelse <em>højere</em> end vores estimat viser.
        </p>

        {/* Hvad vi ikke tæller */}
        <h2 style={h2}>Hvad vi IKKE tæller med</h2>
        <p style={prose}>For at holde modellen overskuelig og defensiv ser vi bort fra:</p>
        <ul style={{ ...prose, paddingLeft: 24 }}>
          {[
            ['Emballage', 'typisk under 5% af produktionsfodaftryk'],
            ['End-of-life behandling', 'kompliceret, ofte negligibel for produkter med høj levetid'],
            ['Rebound-effekt udover displacement rate', 'fx at sparede penge bruges på andet forbrug. Delvist dækket via lav displacement rate'],
            ['Vandforbrug, biodiversitet, kemikalier', 'vi rapporterer kun klima-fodaftryk (kg CO₂e)'],
          ].map(([term, note]) => (
            <li key={term} style={{ marginBottom: 8 }}><strong>{term}</strong> — {note}</li>
          ))}
        </ul>

        {/* Versionering */}
        <h2 style={h2}>Versionering</h2>
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
          <p style={{ ...prose, margin: 0, fontSize: 14 }}>
            <strong>Kritisk garanti:</strong> Historiske handler bevarer altid de tal, der blev beregnet på tidspunktet for handlen. Opdaterer vi metoden eller faktorerne, gælder ændringerne <em>kun</em> for fremtidige handler.
          </p>
        </div>
        <p style={prose}>Denne metode er <strong>version {METHODOLOGY_VERSION}</strong> og blev implementeret den 2026-05-30. Tidligere versioner: ingen.</p>

        {/* Sprogregler */}
        <h2 style={h2}>Sprogregler</h2>
        <p style={prose}>For at undgå greenwashing følger vi disse regler i alt UI-tekst:</p>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {[
            { do: true,  text: 'Brug altid "estimeret", "ca." eller "≈"' },
            { do: true,  text: 'Brug altid "kg CO₂e" (ikke bare "CO₂")' },
            { do: true,  text: 'Link altid til denne metode-side' },
            { do: false, text: '"din byttehandel reddede X kg CO₂"' },
            { do: false, text: 'Absolutte tal uden forbehold' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 10, background: r.do ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${r.do ? GREEN_SOFT : '#FECACA'}` }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{r.do ? '✓' : '✗'}</span>
              <span style={{ fontFamily: FONT, fontSize: 13, color: r.do ? '#166534' : '#991B1B' }}>{r.text}</span>
            </div>
          ))}
        </div>

        {/* Kilder */}
        <h2 style={h2}>Kilder</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SOURCES.map(s => (
            <div key={s.id} style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 13, color: PRIMARY, minWidth: 28, flexShrink: 0 }}>{s.id}</span>
              <span style={{ fontFamily: FONT, fontSize: 13, color: INK3, lineHeight: 1.6 }}>
                {s.ref}{' '}
                <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: PRIMARY, textDecoration: 'underline', wordBreak: 'break-all' }}>{s.url}</a>
              </span>
            </div>
          ))}
        </div>

        {/* Kontakt */}
        <div style={{ marginTop: 48, background: GREEN_TINT, borderRadius: 16, padding: '24px 28px', border: `1px solid ${GREEN_SOFT}` }}>
          <h3 style={{ ...h3, marginTop: 0 }}>Spørgsmål eller forslag?</h3>
          <p style={{ ...prose, margin: 0, fontSize: 14 }}>
            Hvis du er ekspert på området eller har bemærkninger til vores metode, hører vi meget gerne fra jer på{' '}
            <a href="mailto:hej@bytogleg.dk" style={{ color: PRIMARY, fontWeight: 700 }}>hej@bytogleg.dk</a>.
            Vi reviewer metoden løbende og er åbne for forbedringer.
          </p>
        </div>

      </div>
    </div>
  );
}
