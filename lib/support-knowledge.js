// Delt videnskilde for support-AI'en. Bruges af BÅDE kundebotten
// (app/api/support-chat) OG admin-svarassistenten (app/api/support-chat/assist),
// så de aldrig kommer ud af sync. Hold dette i sync med lib/pricing.js.

export const SUPPORT_FACTS = `VERIFICEREDE FAKTA OM BYTOGLEG:

HVAD ER BYTOGLEG:
- En dansk B2B-markedsplads hvor institutioner køber, sælger og bytter brugt legetøj
- Formålet er at fremme bæredygtig genbrug af legetøj i institutionssektoren
- Platformen er en hjemmeside og en app (PWA man kan installere på telefonen)

HVEM KAN BRUGE PLATFORMEN:
- Kun CVR-registrerede institutioner i Danmark
- Inkl. vuggestuer, børnehaver, SFO'er, folkeskoler, fritidsklubber og lignende institutioner
- Private enkeltpersoner kan ikke oprette konto
- Alt legetøj skal tilhøre institutionen og bruges i institutionsmæssig sammenhæng

PRIS, ABONNEMENT OG GEBYRER (VIGTIGT — VÆR PRÆCIS HER):
- Det er GRATIS at oprette konto, tilmelde sig og lægge opslag op
- Der er INTET abonnement og INGEN kommission til sælger
- MEN ved KØB betaler køber en køberbeskyttelse: 5% af varebeløbet + 5 kr.
- Ved BYTTE betaler hver part en byttebeskyttelse på 10 kr. pr. part
- Forsendelse betales separat (se forsendelse nedenfor)
- Sig ALDRIG at det er "helt gratis at handle" — der er køber-/byttebeskyttelse

KØBERBESKYTTELSE (5% + 5 kr.):
- Gælder på alle køb og bud
- Hvis varen ikke ankommer, eller slet ikke passer med opslaget, får køber pengene tilbage
- byt&leg holder betalingen sikkert (escrow), indtil køber har bekræftet modtagelse
- Når levering er bekræftet, frigives varebeløbet til sælger

BYTTEBESKYTTELSE (10 kr. pr. part):
- Ved byttehandel er begge parter dækket
- Begge parter betaler deres andel (forsendelse + beskyttelse) inden for 48 timer efter byttet er godkendt
- Hvis en part ikke betaler i tide, annulleres handlen automatisk og betalte beløb refunderes
- byt&leg holder handlen i balance, til begge pakker er sendt

GODKENDELSE AF INSTITUTION:
- CVR-nummer slås automatisk op i Erhvervsstyrelsens register
- Godkendelse tager typisk 1-2 hverdage
- I modtager en e-mail når I er godkendt

DE FIRE HANDELSTYPER:
- Køb (fastpris): se prisen og køb med det samme, læg i kurv og betal. Ingen forhandling.
- Byd (forhandl): send et bud under prisen, forhandl via chat med modbud. Et accepteret bud reserveres til køber i 24 timer.
- Byt (bytehandel): tilbyd et af jeres egne opslag som betaling, bundt for bundt, uden penge imellem (ud over evt. kontant mellemlag)
- Søges: efterlys specifikt legetøj I mangler

OPRET ET OPSLAG (AI-hjælp):
- Tag ét billede af legetøjet med telefonen
- AI foreslår automatisk titel, kategori, aldersgruppe, stand og beskrivelse
- Vælg køb, byd eller byt og sæt evt. pris
- Publicér — opslaget er straks synligt for alle verificerede institutioner i hele landet
- AI tjekker automatisk billeder og afviser opslag hvis der er mennesker/børn på (GDPR/privatliv)

FORSENDELSE:
- Platformen samarbejder med fragtfirmaer: PostNord, GLS og DAO (pakkeshop, og DAO også hjemmelevering)
- Prisen afhænger af pakkens vægt — den billigste pris findes automatisk
- Forsendelse er valgfrit — man kan også aftale afhentning direkte med sælger
- Den endelige forsendelsespris vises ved checkout

BETALING:
- Betaling sker via platformen med betalingskort (gennem Stripe) eller MobilePay
- Betalingen holdes sikkert af byt&leg indtil levering er bekræftet

CO2 OG BÆREDYGTIGHED:
- Platformen beregner automatisk CO2-besparelsen ved hver handel
- Besparelsen afhænger af produkttype og afstand
- Hver gang legetøj genbruges i stedet for nyt, spares CO2

SLET KONTO / GDPR:
- Kontakt support — vi sletter alle data i overensstemmelse med GDPR
- Handler og beskeder anonymiseres og opbevares i op til 30 dage

BESKEDER MELLEM INSTITUTIONER:
- Institutioner kan skrive sammen direkte via besked-funktionen (chat-boblen / "Beskeder")
- Den bruges til at aftale handler, stille spørgsmål om opslag og forhandle bud

SIDER OG LINKS PÅ PLATFORMEN (du MÅ gerne henvise til disse — skriv linket som en relativ sti der starter med /):
- Tilmeld institution / opret konto: /signup
- Log ind: /login
- Glemt adgangskode: /glemt-adgangskode
- Se alle opslag (legetøj til salg/byt): /opslag
- Opret et nyt opslag: /opret-opslag
- Sådan fungerer det (guide): /hvordan
- Om byt&leg: /om-os
- Kontakt / FAQ: /kontakt
- Bæredygtighed og CO2: /baeredygtighed
- Mine opslag: /mine-opslag
- Mine ordrer/handler: /mine-ordrer
- Beskeder: /beskeder
- Favoritter: /favoritter
- Min profil: /profil
- Notifikationer: /notifikationer
- Handelsbetingelser/vilkår: /vilkaar
- Privatlivspolitik: /privatlivspolitik
- Inviter/tilføj medarbejdere: /medarbejdere
- Henvis ALTID med en relativ sti (fx "Du kan tilmelde dig her: /signup"). Brug ALDRIG en sti der ikke står på listen — gæt aldrig en URL.

KONTAKT SUPPORT:
- Skriv i chat-boblen — supportteamet svarer inden for 1-2 hverdage
- Support-mail: support@bytogleg.dk

TING DER IKKE ER TILGÆNGELIGE ENDNU (lov det ALDRIG):
- EAN-fakturering / NemHandel er IKKE tilgængeligt endnu
- Automatisk udbetaling til sælgers bankkonto er ikke fuldt på plads endnu`;
