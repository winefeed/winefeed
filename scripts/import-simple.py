#!/usr/bin/env python3
"""
Enkel vindata-import utan externa dependencies.
Använder mock-data och standard-bibliotek.
"""

import json
import os
import sys

# Mock-data: 8 olika viner som dupliceras till 200
BASE_WINES = [
    {
        "namn": "Barolo DOCG 2019",
        "producent": "Marchesi di Barolo",
        "land": "Italien",
        "region": "Piemonte",
        "pris_sek": 385,
        "beskrivning": "Kraftfull Nebbiolo med toner av körsbär, tryffel och läder. Passar vilt, ostklass och röda köttgryter. Lång lagringsförmåga.",
        "druva": "Nebbiolo",
        "ekologisk": False,
        "lagerstatus": "tillgänglig"
    },
    {
        "namn": "Chianti Classico Riserva DOCG 2020",
        "producent": "Castello di Ama",
        "land": "Italien",
        "region": "Toscana",
        "pris_sek": 215,
        "beskrivning": "Elegant Sangiovese med toner av körsbär, violer och läder. Perfekt till pasta med tomatsås och grillat kött.",
        "druva": "Sangiovese",
        "ekologisk": False,
        "lagerstatus": "tillgänglig"
    },
    {
        "namn": "Chablis Premier Cru 2021",
        "producent": "William Fèvre",
        "land": "Frankrike",
        "region": "Bourgogne",
        "pris_sek": 265,
        "beskrivning": "Mineralisk Chardonnay med toner av citrus och vit persika. Utmärkt till skaldjur och vit fisk.",
        "druva": "Chardonnay",
        "ekologisk": False,
        "lagerstatus": "tillgänglig"
    },
    {
        "namn": "Rioja Reserva DOCa 2018",
        "producent": "Marqués de Riscal",
        "land": "Spanien",
        "region": "Rioja",
        "pris_sek": 185,
        "beskrivning": "Balanserad Tempranillo med toner av röda bär, vanilj och ek. Passar lamm och tapas.",
        "druva": "Tempranillo",
        "ekologisk": False,
        "lagerstatus": "tillgänglig"
    },
    {
        "namn": "Pouilly-Fumé 2022",
        "producent": "Domaine Didier Dagueneau",
        "land": "Frankrike",
        "region": "Loire",
        "pris_sek": 345,
        "beskrivning": "Aromatisk Sauvignon Blanc med toner av färsk frukt och mineraler. Perfekt till getost och skaldjur.",
        "druva": "Sauvignon Blanc",
        "ekologisk": True,
        "lagerstatus": "tillgänglig"
    },
    {
        "namn": "Amarone della Valpolicella DOCG 2017",
        "producent": "Tommasi",
        "land": "Italien",
        "region": "Veneto",
        "pris_sek": 425,
        "beskrivning": "Kraftfull och komplex med toner av mörka bär, choklad och kryddor. Passar ostklass och vilt.",
        "druva": "Corvina, Rondinella",
        "ekologisk": False,
        "lagerstatus": "tillgänglig"
    },
    {
        "namn": "Châteauneuf-du-Pape 2019",
        "producent": "Domaine du Vieux Télégraphe",
        "land": "Frankrike",
        "region": "Rhône",
        "pris_sek": 395,
        "beskrivning": "Komplex blend med toner av mörka bär, örter och kryddor. Perfekt till grillat kött.",
        "druva": "Grenache, Syrah, Mourvèdre",
        "ekologisk": False,
        "lagerstatus": "tillgänglig"
    },
    {
        "namn": "Sancerre 2022",
        "producent": "Pascal Jolivet",
        "land": "Frankrike",
        "region": "Loire",
        "pris_sek": 195,
        "beskrivning": "Fräsch Sauvignon Blanc med toner av citrus och gröna äpplen. Perfekt till getost.",
        "druva": "Sauvignon Blanc",
        "ekologisk": False,
        "lagerstatus": "tillgänglig"
    },
]

def create_200_wines():
    """Skapa 200 viner genom att variera basviner."""
    wines = []
    for i in range(25):
        for base_wine in BASE_WINES:
            wine = base_wine.copy()
            # Variera årgång och pris lite
            year_suffix = 2015 + (i % 8)
            price_variation = (i * 10) % 100

            wine["namn"] = f"{wine['namn'].split()[0]} {year_suffix}"
            wine["pris_sek"] = wine["pris_sek"] + price_variation
            wines.append(wine)

    return wines[:200]

def save_to_json(wines, filename='wines-import.json'):
    """Spara viner till JSON."""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(wines, f, ensure_ascii=False, indent=2)
    print(f"✅ Sparade {len(wines)} viner till {filename}")

def main():
    print("🍷 WINEFEED - Vindata Import (Mock Data)\n")

    # Skapa 200 mock-viner
    wines = create_200_wines()
    print(f"📊 Skapade {len(wines)} mock-viner")

    # Spara till JSON
    save_to_json(wines)

    print("\n📤 Nu kan du importera dessa till Supabase:")
    print("1. Öppna Supabase → Table Editor → wines")
    print("2. Klicka 'Insert' → 'Insert row'")
    print("3. Eller använd SQL Editor för bulk-import från JSON")
    print("\n✨ Klart!")

if __name__ == '__main__':
    main()
