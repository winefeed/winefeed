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

- "vi"-stil, aldrig "jag" — Winefeed är ett team
- Kort, peer-to-peer, ej säljig
- Konkreta siffror > vaga superlativ
- Inga emojis, inga klichéer ("revolutionerar", "AI-driven", "next-gen")
- Tredje person för Markus om han nämns

---

## Mall

```
Hej {{förnamn(en)}}!

{{ÖPPNING — 1–2 meningar personligt, visar att vi gjort hemläxan.
T.ex. "Vi har sett att ni nyligen tagit över X" / "Hörde att ni
precis flyttat till Y" / "Gratulerar till Z-utmärkelsen"}}

Vi startar upp Winefeed, en B2B-plattform där restauranger lägger en
förfrågan ("italienskt rödvin under 90 kr, 24 flaskor") och får offert
tillbaka från svenska importörer som har matchande viner. Tanken: ni
slipper ringa runt eller jaga prislistor när vinlistan byggs upp.

Vi har redan ett antal importörer ombord, och **fler och fler ansluter
sina vinkataloger kommande veckorna** — så urvalet växer snabbt. Förutom
det vanliga svenska sortimentet finns även en del europeiska producenter
som ni inte enkelt hittar hos vanliga distributörer, ofta med riktigt
konkurrenskraftiga priser.

{{VALFRITT — 2–3 producent-exempel som matchar deras profil. Skippa om
generiskt mejl. Standard-exempel för klassisk/Bordeaux-fit:}}

Ett par exempel:
- **Château Tour-Calon** (Castillon Côtes de Bordeaux) — 32 årgångar i
  lager, från 1958 till 2018. 2005 ligger på 309 kr ex moms → ni kan
  servera 20-årig Bordeaux som glasvin
- **Château Bonalgue Bel-Air** (Pomerol) — klassisk högerstrand, flera
  årgångar
- **Château Lateyron** — small-batch Bordeaux

**Vad det kostar er:** ingenting. Plattformen är gratis att använda för
restauranger — både att lista förfrågningar och att acceptera offerter.
Inga månadsavgifter, inga prenumerationer.

**Vid direktimport från europeiska producenter** sköter vi all
nödvändig pappersexercis åt er — tulldokument, alkoholskatte-anmälan,
5369, transportkoordinering. Ni bestämmer vinet, vi tar hand om
logistik och dokumentation hela vägen till källaren. Det är en av
sakerna vi byggt plattformen kring.

Vill ni testa? Vi kan skicka en länk så är ni igång på 10 minuter,
eller boka in en kort demo på telefon om det känns bättre.

Med vänlig hälsning,
Markus
winefeed.se
```

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

- **v1** (2026-05-04) — initial mall efter Sandra/N4 + Morbror Fabian-utkasten.
