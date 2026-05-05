# Winefeed restaurang-outreach — MALL v1

Återanvändbar mejl-mall för kall outreach till restauranger som bygger eller bygger om vinlista. Personliga delar markeras med `{{...}}` — alla andra stycken är stabila och ska inte ändras utan kontext.

## Avsändare

- **Från:** `Markus på Winefeed <markus@winefeed.se>`
- **Reply-to:** `markus@winefeed.se`
- **UTM-suffix på alla länkar:** `?utm_source=outreach&utm_medium=email&utm_campaign=growth_pilot&utm_content={{restaurang_slug}}`

## Ämnesrad

Personlig hook med restaurangens specifika kontext. Exempel:
- "Bygger ni vinlistan från noll på {{adress}}?"
- "Hörde att ni precis tagit över {{lokal/restaurang}}"
- "Gratulerar till {{utmärkelse}} — fråga om sortimentet"

## Tonalitet

- "vi"-stil, aldrig "jag". Winefeed är ett team
- Kort, peer-to-peer, ej säljig
- Konkreta siffror > vaga superlativ
- Inga emojis, inga klichéer ("revolutionerar", "AI-driven", "next-gen")
- Tredje person för Markus om han nämns
- **Minimera em-dashar (—).** Använd punkt, komma eller kolon istället. Em-dashar förlorar effekt om de spammas. Max 1–2 per mejl, helst noll.
- **Använd recipientens egen vokabulär, inte generisk bransch-jargon.**
  - ✓ "VIB-listan" om det är Bistro Vinotekets egna term, "Coravin-rotation" om de har Coravin, "Winemaker Dinners" om de gör det, "tema-fredagar" om Bryggargatan kör det
  - ✗ Generic jargon som "by-the-glass-program", "stockkeeping-rotation", "logistisk bedrift", "vi har följt er". Låter säljigt.
  - Tumregel: om termen kommer från deras egen sajt/marknadsföring → använd den. Om vi hittar på den → byt ut.
- **Hook-stil: observerande, inte smörig.**
  - ✓ "47 länder och en VIB-lista är ovanligt brett för en svensk vinbar. Tänkte höra om Winefeed kan passa in."
  - ✗ "Vi har följt Bistro Vinoteket under tiden ni byggt upp 47 länder och VIB-listan. En lista som rör sig så snabbt är en logistisk bedrift för en sommelier-grupp på fem."
  - Direkt observation → varför det kan matter för dem. Inga superlativ, ingen "logistisk bedrift", inga "vi har följt".

---

## Mall

```
Hej {{förnamn(en)}}!

{{ÖPPNING (1–2 meningar). Personligt, visar att vi gjort hemläxan.
T.ex. "Vi har sett att ni nyligen tagit över X." / "Hörde att ni
precis flyttat till Y." / "Gratulerar till Z-utmärkelsen."}}

Vi startar upp Winefeed, en B2B-plattform där restauranger lägger en
förfrågan ("italienskt rödvin under 90 kr, 24 flaskor") och får offert
tillbaka från svenska importörer som har matchande viner. Tanken: ni
slipper ringa runt eller jaga prislistor när vinlistan byggs upp.

Vi har redan ett antal importörer ombord, och **fler och fler ansluter
sina vinkataloger kommande veckorna**, så urvalet växer snabbt. Förutom
det vanliga svenska sortimentet finns även en del europeiska producenter
som ni inte enkelt hittar hos vanliga distributörer, ofta med riktigt
konkurrenskraftiga priser.

{{VALFRITT (2–3 producent-exempel som matchar deras profil). Skippa om
generiskt mejl. Standard-exempel för klassisk/Bordeaux-fit:}}

Ett par exempel:
- **Château Tour-Calon** (Castillon Côtes de Bordeaux). 32 årgångar i
  lager, från 1958 till 2018. 2005 ligger på 309 kr ex moms, så ni kan
  servera 20-årig Bordeaux som glasvin
- **Château Bonalgue Bel-Air** (Pomerol). Klassisk högerstrand, flera
  årgångar
- **Château Lateyron**, small-batch Bordeaux

**Vad det kostar er:** ingenting. Plattformen är gratis att använda för
restauranger, både att lista förfrågningar och att acceptera offerter.
Inga månadsavgifter, inga prenumerationer.

**Vid direktimport från europeiska producenter** sköter vi all
nödvändig pappersexercis åt er: tulldokument, alkoholskatte-anmälan,
5369, transportkoordinering. Ni bestämmer vinet, vi tar hand om
logistik och dokumentation hela vägen till källaren. Det är en av
sakerna vi byggt plattformen kring.

Vill ni testa? Tre vägar:
1. Registrera direkt på winefeed.se/signup (tar 5 minuter, ni är
   igång samma kväll)
2. Svara på det här mejlet med orgnr + kontaktperson, så skapar
   vi inloggningen åt er och skickar tillbaka
3. 15 min på telefon om ni vill se plattformen live först

Med vänlig hälsning,
Markus
winefeed.se
```

### Tre-vägs-CTA — varför

Olika restauranger har olika friktion-tolerans. Att låsa in en CTA
gör att vi förlorar de som hade tagit en annan väg in:

| Väg | För vem | Vår input |
|-----|---------|-----------|
| Self-register på winefeed.se/signup | Tech-van, vill snabba upp | Ingen |
| Svara med orgnr | Busy sommelier, vill ha det gjort åt sig | 5 min för Markus |
| Demo-call | Vill se plattformen innan de förbinder sig | 15 min för Markus |

Bonus: spår 2 (svara-med-orgnr) ger oss en konversation även när de
inte är redo att handla. Låg-tröskel-engagemang.

---

## Mall-anteckningar

| Stycke | Ändras per restaurang? | Notering |
|---|---|---|
| Ämnesrad | Ja | Personlig, specifik. Inte generisk. |
| Hälsning | Ja | Förnamn, ej "Hej!" eller "Hej team" |
| Öppningshook | **Ja, alltid** | Visar att vi gjort hemläxan. Annars känns det som spam. |
| Winefeed-pitch | Nej | Stabil. Ändras bara om plattformsfunktion ändras. |
| Importör-momentum | Nej | Stabil tills vi lämnar tillväxtfas. |
| Producent-exempel | **Valfritt** | Skippa om generisk pitch. Använd när profilen matchar (klassisk, naturvin, italiensk osv.). |
| Kostnad-stycket | Nej | Stabil. |
| Import-supportstycket | Nej | Vår USP. Alltid med. |
| CTA | Nej | Tvådelad: länk (lågt motstånd) eller demo. |
| Signatur | Nej | "Markus / winefeed.se" |

## Producent-exempel per profil

| Restaurang-profil | Lämpliga exempel | Anteckning |
|---|---|---|
| Klassisk fine-dining, Bordeaux-historia | Tour-Calon, Bonalgue Bel-Air, Lateyron | Standard-exemplet ovan |
| Naturvin / lågintervention | TBD — fyll på när vi har sortimentet | |
| Italiensk-fokus | TBD | |
| Spansk / Portugal | TBD | |
| Världsbistro / blandad | Generisk pitch utan exempel räcker | "Brett sortiment + import-stöd" |

## Förbjudna fraser

- "Tusentals viner" (vi har 556)
- "Alla svenska importörer"
- "Sveriges största B2B-marknadsplats för vin"
- "Disrupterar", "revolutionerar", "AI-driven"
- "Next-gen", "game changer"

## Förbjudna fejk-importörer

Aldrig använd som exempel: Vino Italia AB, Europa Viner, Nordic Wine,
Domaine Direct, Bordeaux Trade Co. Använd faktiska importörer (Brasri,
AKO, Gårdshol, Vinagenterna, Wena) eller producent-namn direkt.

## Versionhistorik

- **v1** (2026-05-04). Initial mall efter Sandra/N4 + Morbror Fabian-utkasten.
- **v1.1** (2026-05-04). Minimerade em-dashar. Bytte till punkt/komma/kolon i mall-texten + lade till tonalitetsregel.
- **v1.2** (2026-05-05). Lade till outreach-fabriken (`scripts/outreach.mjs` + `lib/outreach/*`). Strukturändring i mall-texten: "Så funkar Winefeed"-stycke först (USP), inkluderar både svenska importörer + direktimport-spåret med pappersexercis. Tonalitetsregler: använd recipientens egen vokabulär (inte generisk jargon), hook-stil observerande (inte smörig).
- **v1.3** (2026-05-05). CTA bytt från enkel "skicka en länk"-formulering till tre vägar: (1) self-register på winefeed.se/signup, (2) svara med orgnr + kontaktperson så skapar vi konto åt dem, (3) demo-call. Sänker friktion + ger fler engagemangs-vägar.
