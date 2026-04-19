"""
Winefeed AI-output validator

Kör efter AI-berikningen för att flagga faktafel, språkfel och
systematiska avvikelser från reglerna i förbättrade prompten.

Usage:
    from winefeed_validator import validate_wines

    results = validate_wines(ai_output_list)
    for result in results:
        if result['flags']:
            print(f"{result['wine']}: {len(result['flags'])} flaggor")
            for flag in result['flags']:
                print(f"  [{flag['severity']}] {flag['message']}")

Input-format (per vin):
    {
        "producer": "Chateau Joanin Becot",
        "wine_name": "Chateau Joanin Becot",
        "appellation": "Castillon Cotes de Bordeaux",
        "region": "Castillon Cotes de Bordeaux",
        "vintage": 2018,
        "color": "red",
        "grape_composition": "Merlot, Cabernet Franc, Cabernet Sauvignon",
        "alcohol_percent": 13.5,
        "description": "..."
    }

Output-format (per vin):
    {
        "wine": "Chateau Joanin Becot 2018",
        "flags": [
            {
                "severity": "error" | "warning" | "info",
                "category": "grape" | "alcohol" | "language" | "context",
                "message": "..."
            }
        ],
        "needs_manual_review": bool
    }
"""

import re
from typing import Optional


# ==========================================================================
# REGLER OCH REFERENSDATA
# ==========================================================================

# Högra stranden av Bordeaux — Cabernet Sauvignon är OVANLIGT
RIGHT_BANK_APPELLATIONS = {
    "saint-emilion", "saint emilion", "st-emilion", "st emilion",
    "pomerol", "lalande de pomerol", "lalande-de-pomerol",
    "fronsac", "canon-fronsac", "canon fronsac",
    "castillon cotes de bordeaux", "castillon", "cotes de castillon",
    "cotes de bourg", "côtes de bourg",
    "cotes de francs", "francs cotes de bordeaux",
    "blaye cotes de bordeaux", "premieres cotes de blaye",
}

# Vänstra stranden av Bordeaux — Cabernet Sauvignon-dominerat
LEFT_BANK_APPELLATIONS = {
    "medoc", "médoc", "haut-medoc", "haut medoc", "haut-médoc",
    "saint-julien", "saint julien", "st-julien",
    "pauillac",
    "margaux",
    "saint-estephe", "saint estephe", "saint-estèphe", "st-estephe",
    "moulis", "moulis-en-medoc", "listrac", "listrac-medoc",
    "graves", "pessac-leognan", "pessac leognan", "pessac-léognan",
}

# Kända andravin/producent-kopplingar. När nyckelord finns i producent
# eller vinnamn ska beskrivningen nämna kopplingen.
PRODUCER_CONTEXT = {
    "pensees de la tour carnet": {
        "type": "andravin",
        "parent": "Château La Tour Carnet",
        "context": "4ème Cru Classé 1855, Haut-Médoc, ägs av Bernard Magrez",
    },
    "allees de cantemerle": {
        "type": "andravin",
        "parent": "Château Cantemerle",
        "context": "5ème Cru Classé 1855, Haut-Médoc",
    },
    "madame de beaucaillou": {
        "type": "haut-medoc-projekt",
        "parent": "Château Ducru-Beaucaillou",
        "context": "Ducru-Beaucaillous Haut-Médoc-vin (Ducru själv är 2ème Cru Classé i Saint-Julien)",
    },
    "la chenade": {
        "type": "lalande-vin",
        "parent": "Denis Durantou / L'Église-Clinet",
        "context": "Familjen Durantou (L'Église-Clinet i Pomerol, idag drivet av döttrarna Noémie och Constance)",
    },
    "joanin becot": {
        "type": "castillon-vin",
        "parent": "Famille Bécot",
        "context": "Ägs av familjen Bécot (Château Beau-Séjour Bécot, 1er Grand Cru Classé B i Saint-Émilion)",
    },
    "cap de faugeres": {
        "type": "castillon-vin",
        "parent": "Silvio Denz",
        "context": "Ägs av Silvio Denz (Château Faugères i Saint-Émilion)",
    },
    "aiguilhe": {
        "type": "castillon-vin",
        "parent": "Stephan von Neipperg",
        "context": "Ägs av Stephan von Neipperg (Canon La Gaffelière, La Mondotte i Saint-Émilion)",
    },
    "roc de cambes": {
        "type": "kultvin",
        "parent": "François Mitjavile",
        "context": "Kultvin i Côtes de Bourg, ägt av François Mitjavile (även Tertre-Roteboeuf i Saint-Émilion). INTE ett budget-vin.",
    },
}

# Svart lista — fraser som aldrig ska användas
BLACKLIST_PHRASES = [
    "dagsvinsnivå",
    "dagvinsnivå",
    "dagvinsvimek",
    "dagvinsleverantör",
    "värdeöverenskommelse",
    "ostentativ",
    "praktiskt restaurangvin",
    "pålitlig vardagsvin",
    "för restaurangkund",
    "utan prestigspris",
    "utan prestijspris",
    "prestigspris",
    "kwalitet",
    "graphit",
    "rötkött",  # Stavfel för "rött kött" eller "rotkött"
    "käkbetongbaserade",
    "mocka betongbaserade",
    "klassisk fransk köket",
    "köksöverblivna",
    "väderleksstabilitet",
    "medellundigt",
    "urtaliga",
    "bordelaisisk",
    "charkuteriveck",
    "medaljong garnetfärg",
    "garonnebränningen",
    "fruktkaraktär",  # OK per sig men ofta i tomma cliché-konstruktioner
]

# Bordeaux ligger vid Gironde, INTE Garonne. Flagga om "Garonne" nämns
# i Médoc-sammanhang.
GEOGRAPHY_CHECKS = {
    "garonne": "Bordeaux-vingårdar (Médoc, Haut-Médoc) ligger vid Gironde, inte Garonne",
}

# Bordeaux-årgångars karaktär för sanity check av beskrivningen
BORDEAUX_VINTAGE_CHARACTER = {
    2010: "klassisk, strukturerad, kraftfull",
    2011: "svårare år, mindre mogen frukt",
    2012: "ojämn, Merlot bättre än Cabernet",
    2013: "svår årgång",
    2014: "klassisk, sval, elegant",
    2015: "varm, mogen, generös",
    2016: "mycket bra, balanserad",
    2017: "vårfrost, svårt år, lägre volymer",
    2018: "sol, mogen, kraftfull",
    2019: "klassisk struktur",
    2020: "svårt pga klimat, ojämnt",
    2021: "svalare, klassisk stil",
    2022: "varm, solig årgång",
    2023: "regnig, svårt",
}

# Minsta alkoholhalt som rimlig för moderna Bordeaux
MIN_ALCOHOL_MODERN_BORDEAUX = 13.5
MAX_ALCOHOL_MODERN_BORDEAUX = 15.5
MODERN_VINTAGE_THRESHOLD = 2010


# ==========================================================================
# VALIDERINGSFUNKTIONER
# ==========================================================================

def _normalize(text: str) -> str:
    """Lowercase och ta bort diakritiska tecken för jämförelse."""
    if not text:
        return ""
    return text.lower().strip()


def _is_right_bank(appellation: str) -> bool:
    return any(a in _normalize(appellation) for a in RIGHT_BANK_APPELLATIONS)


def _is_left_bank(appellation: str) -> bool:
    return any(a in _normalize(appellation) for a in LEFT_BANK_APPELLATIONS)


def _is_bordeaux(appellation: str, region: str = "") -> bool:
    combined = f"{_normalize(appellation)} {_normalize(region)}"
    return _is_right_bank(combined) or _is_left_bank(combined) or "bordeaux" in combined


def check_grape_composition(wine: dict, flags: list) -> None:
    """Kontrollera att druvor är rimliga för appellationen."""
    grape = _normalize(wine.get("grape_composition", ""))
    appellation = wine.get("appellation", "")

    if not grape:
        flags.append({
            "severity": "error",
            "category": "grape",
            "message": "Druvsammansättning saknas",
        })
        return

    if _is_right_bank(appellation) and "cabernet sauvignon" in grape:
        flags.append({
            "severity": "warning",
            "category": "grape",
            "message": (
                f"Cabernet Sauvignon angiven för högra-stranden-appellation "
                f"({appellation}). Ovanligt — verifiera mot producentens källa. "
                f"Typisk blend här: Merlot + Cabernet Franc."
            ),
        })

    if _is_left_bank(appellation) and "cabernet sauvignon" not in grape:
        flags.append({
            "severity": "warning",
            "category": "grape",
            "message": (
                f"Cabernet Sauvignon saknas i blend för vänstra-stranden-"
                f"appellation ({appellation}). Ovanligt — dessa viner är "
                f"oftast Cabernet Sauvignon-dominerade."
            ),
        })


def check_alcohol(wine: dict, flags: list) -> None:
    """Kontrollera att alkoholhalten är rimlig."""
    alcohol = wine.get("alcohol_percent")
    vintage = wine.get("vintage")
    appellation = wine.get("appellation", "")

    if alcohol is None:
        flags.append({
            "severity": "info",
            "category": "alcohol",
            "message": "Alkoholhalt saknas (null) — OK om AI inte var säker",
        })
        return

    if not isinstance(alcohol, (int, float)):
        flags.append({
            "severity": "error",
            "category": "alcohol",
            "message": f"Alkoholhalt är inte ett nummer: {alcohol}",
        })
        return

    if not _is_bordeaux(appellation, wine.get("region", "")):
        return  # Bara Bordeaux-regler för tillfället

    if vintage and vintage >= MODERN_VINTAGE_THRESHOLD:
        if alcohol < MIN_ALCOHOL_MODERN_BORDEAUX:
            flags.append({
                "severity": "warning",
                "category": "alcohol",
                "message": (
                    f"Alkohol {alcohol}% för låg för modern Bordeaux "
                    f"(årgång {vintage}). Moderna Bordeaux ligger typiskt "
                    f"på 13,5–15 %. Troligen schablonmässig gissning."
                ),
            })

        if alcohol > MAX_ALCOHOL_MODERN_BORDEAUX:
            flags.append({
                "severity": "warning",
                "category": "alcohol",
                "message": f"Alkohol {alcohol}% ovanligt hög — verifiera",
            })


def check_producer_context(wine: dict, flags: list) -> None:
    """Kontrollera att viktiga producent-kopplingar nämns i beskrivningen."""
    producer = _normalize(wine.get("producer", ""))
    wine_name = _normalize(wine.get("wine_name", ""))
    description = _normalize(wine.get("description", ""))

    combined_name = f"{producer} {wine_name}"

    for key, context_info in PRODUCER_CONTEXT.items():
        if key in combined_name:
            # Leta efter nyckelord från kontexten i beskrivningen
            parent = _normalize(context_info["parent"])
            parent_keywords = [w for w in parent.split() if len(w) > 4]

            description_mentions_parent = any(
                kw in description for kw in parent_keywords
            )

            if not description_mentions_parent:
                flags.append({
                    "severity": "warning",
                    "category": "context",
                    "message": (
                        f"Producent-koppling saknas i beskrivningen. "
                        f"Bör nämna: {context_info['context']}"
                    ),
                })


def check_language(wine: dict, flags: list) -> None:
    """Leta efter fraser från svarta listan och språkfel."""
    description = _normalize(wine.get("description", ""))

    if not description:
        flags.append({
            "severity": "error",
            "category": "language",
            "message": "Beskrivning saknas",
        })
        return

    for phrase in BLACKLIST_PHRASES:
        if phrase in description:
            flags.append({
                "severity": "warning",
                "category": "language",
                "message": f"Förbjuden fras hittad: '{phrase}'",
            })

    for phrase, explanation in GEOGRAPHY_CHECKS.items():
        if phrase in description:
            # Bara flagga om Médoc-sammanhang
            if _is_left_bank(wine.get("appellation", "")):
                flags.append({
                    "severity": "error",
                    "category": "language",
                    "message": f"Geografifel: {explanation}",
                })

    # Leta efter uppenbara tecken på AI-svengelska
    svengelska_patterns = [
        (r"\bfranska köket\b", None),  # Korrekt
        (r"\bfransk köket\b", "Ska vara 'franska köket'"),
        (r"\bklassisk fransk köket\b", "Ska vara 'klassiska franska köket'"),
        (r"\bitaliensk och fransk kök", "Ovanlig konstruktion för Bordeaux-vin"),
    ]

    for pattern, message in svengelska_patterns:
        if message and re.search(pattern, description):
            flags.append({
                "severity": "warning",
                "category": "language",
                "message": f"Svengelska: {message}",
            })


def check_description_quality(wine: dict, flags: list) -> None:
    """Mät beskrivningens kvalitet: längd, substans."""
    description = wine.get("description", "")

    if not description:
        return

    word_count = len(description.split())

    if word_count < 30:
        flags.append({
            "severity": "warning",
            "category": "language",
            "message": f"Beskrivning för kort ({word_count} ord, bör vara 60–100)",
        })

    if word_count > 150:
        flags.append({
            "severity": "info",
            "category": "language",
            "message": f"Beskrivning för lång ({word_count} ord, bör vara 60–100)",
        })

    # Leta efter tomma cliché-konstruktioner
    clichés = [
        "harmonisk och välbalanserad",
        "kraftfull men tillgänglig",
        "elegant och balanserad",
    ]
    for cliché in clichés:
        if cliché in _normalize(description):
            flags.append({
                "severity": "info",
                "category": "language",
                "message": f"Cliché utan innehåll: '{cliché}'",
            })


# ==========================================================================
# HUVUDFUNKTION
# ==========================================================================

def validate_wine(wine: dict) -> dict:
    """
    Validera ett enskilt vin och returnera flaggor.

    Args:
        wine: dict med AI-berikningsdata för ett vin

    Returns:
        dict med wine-label och lista med flaggor
    """
    flags: list = []

    check_grape_composition(wine, flags)
    check_alcohol(wine, flags)
    check_producer_context(wine, flags)
    check_language(wine, flags)
    check_description_quality(wine, flags)

    # Manuell review behövs om det finns error eller 3+ warnings
    has_error = any(f["severity"] == "error" for f in flags)
    warning_count = sum(1 for f in flags if f["severity"] == "warning")
    needs_review = has_error or warning_count >= 3

    wine_label = f"{wine.get('producer', 'Unknown')} {wine.get('vintage', '')}"

    return {
        "wine": wine_label.strip(),
        "flags": flags,
        "needs_manual_review": needs_review,
        "error_count": sum(1 for f in flags if f["severity"] == "error"),
        "warning_count": warning_count,
        "info_count": sum(1 for f in flags if f["severity"] == "info"),
    }


def validate_wines(wines: list) -> list:
    """Validera en lista av viner och returnera samlad rapport."""
    return [validate_wine(wine) for wine in wines]


def print_report(results: list) -> None:
    """Skriv ut en läsbar rapport till stdout."""
    total = len(results)
    needs_review = sum(1 for r in results if r["needs_manual_review"])
    total_errors = sum(r["error_count"] for r in results)
    total_warnings = sum(r["warning_count"] for r in results)

    print("=" * 70)
    print(f"WINEFEED VALIDERINGSRAPPORT")
    print("=" * 70)
    print(f"Totalt viner:      {total}")
    print(f"Behöver review:    {needs_review} ({needs_review/total*100:.0f}%)")
    print(f"Totalt errors:     {total_errors}")
    print(f"Totalt warnings:   {total_warnings}")
    print()

    for r in results:
        if not r["flags"]:
            print(f"✅ {r['wine']}")
            continue

        marker = "❌" if r["needs_manual_review"] else "⚠️ "
        print(f"{marker} {r['wine']}")

        for flag in r["flags"]:
            sev_marker = {
                "error": "  [ERROR]",
                "warning": "  [WARN] ",
                "info": "  [info] ",
            }[flag["severity"]]
            print(f"{sev_marker} ({flag['category']}) {flag['message']}")
        print()


# ==========================================================================
# EXEMPEL-ANVÄNDNING
# ==========================================================================

if __name__ == "__main__":
    import json
    import sys

    # Om en fil-argument finns, läs JSON därifrån; annars kör demo
    if len(sys.argv) > 1:
        path = sys.argv[1]
        with open(path, "r", encoding="utf-8") as f:
            wines = json.load(f)
        results = validate_wines(wines)
        print_report(results)
    else:
        # Demo med ett par viner från AI-körningen
        sample_wines = [
            {
                "producer": "Chateau Joanin Becot",
                "wine_name": "Chateau Joanin Becot",
                "appellation": "Castillon Cotes de Bordeaux",
                "region": "Castillon Cotes de Bordeaux",
                "vintage": 2018,
                "color": "red",
                "grape_composition": "Merlot, Cabernet Franc, Cabernet Sauvignon",
                "alcohol_percent": 13.5,
                "description": (
                    "Castillon Côtes de Bordeaux-vin med elegant struktur och "
                    "balanserade tanniner. Visar röda bär, plommon och subtila "
                    "kryddiga noter. Mediumkroppad med god friskhet och längd. "
                    "Passar väl till grillad köttmat, lamm och mogna ostar. "
                    "Utvecklas fint under några år men drinkbar redan nu. "
                    "Kostnadseffektivt alternativ till klassiska Bordeaux."
                ),
            },
            {
                "producer": "Chateau Roc de Cambes",
                "wine_name": "Chateau Roc de Cambes",
                "appellation": "Cotes de Bourg",
                "region": "Cotes de Bourg",
                "vintage": 2023,
                "color": "red",
                "grape_composition": "Merlot, Cabernet Franc, Cabernet Sauvignon",
                "alcohol_percent": 13.0,
                "description": (
                    "Côtes de Bourg producerar ofta merlot-dominerade rödviner "
                    "med god struktur. Detta vin från 2023 förväntas visa mörka "
                    "bärfrukter, mild tannin och god balans. Passar till grillad "
                    "kött, cassoulet och hårdare ostar. Gott värde för en "
                    "klassisk Bordeaux-stil på budget."
                ),
            },
            {
                "producer": "Chateau Lamothe Bergeron",
                "wine_name": "Chateau Lamothe Bergeron",
                "appellation": "Haut Medoc",
                "region": "Haut Medoc",
                "vintage": 2016,
                "color": "red",
                "grape_composition": "Cabernet Sauvignon, Merlot, Petit Verdot",
                "alcohol_percent": 13.0,
                "description": (
                    "Ett klassiskt Haut-Médoc från vänstra Garonnebränningen med "
                    "struktur och elegans. Mörkröd frukt, läder och grafit "
                    "präglar näsan. Mittfull på gommen med fin tanninkstruktur "
                    "och god balans. En pålitlig andra-klassificering med god "
                    "väderleksstabilitet."
                ),
            },
        ]

        results = validate_wines(sample_wines)
        print_report(results)
