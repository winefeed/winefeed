#!/usr/bin/env python3
"""
Importerar vindata från Systembolagets öppna API.
Kör: python3 scripts/import-systembolaget.py

Requirements:
    pip install requests python-dotenv
"""

import requests
import json
import os
from typing import List, Dict
from dotenv import load_dotenv

# Ladda environment variables
load_dotenv('.env.local')

SYSTEMBOLAGET_API = "https://api-extern.systembolaget.se/product/v1/product"
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

def fetch_wines_from_systembolaget(limit: int = 200) -> List[Dict]:
    """Hämta viner från Systembolagets API."""
    print(f"Hämtar {limit} viner från Systembolaget...")

    params = {
        'productType': 'wine',
        'limit': limit,
        'offset': 0,
        'orderBy': 'salesVolume',  # Mest sålda viner först
    }

    headers = {
        'Ocp-Apim-Subscription-Key': os.getenv('SYSTEMBOLAGET_API_KEY', ''),
    }

    try:
        response = requests.get(SYSTEMBOLAGET_API, params=params, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        return data.get('products', [])
    except requests.exceptions.RequestException as e:
        print(f"❌ Fel vid hämtning från Systembolaget: {e}")
        print("💡 Tips: Om du saknar API-nyckel, använd mock-data istället (se nedan)")
        return []

def create_mock_wines() -> List[Dict]:
    """Skapa mock-data om API:et inte fungerar."""
    print("📝 Skapar mock-data (200 viner)...")

    wines = [
        {
            "name": "Barolo DOCG",
            "producer": "Marchesi di Barolo",
            "country": "Italien",
            "region": "Piemonte",
            "price": 385,
            "description": "Kraftfull Nebbiolo med toner av körsbär, tryffel och läder. Passar vilt, ostklass och röda köttgryter. Lång lagringsförmåga.",
            "grape": "Nebbiolo",
            "organic": False,
        },
        {
            "name": "Chianti Classico Riserva DOCG",
            "producer": "Castello di Ama",
            "country": "Italien",
            "region": "Toscana",
            "price": 215,
            "description": "Elegant Sangiovese med toner av körsbär, violer och läder. Perfekt till pasta med tomatsås och grillat kött.",
            "grape": "Sangiovese",
            "organic": False,
        },
        {
            "name": "Chablis Premier Cru",
            "producer": "William Fèvre",
            "country": "Frankrike",
            "region": "Bourgogne",
            "price": 265,
            "description": "Mineralisk Chardonnay med toner av citrus och vit persika. Utmärkt till skaldjur och vit fisk.",
            "grape": "Chardonnay",
            "organic": False,
        },
        {
            "name": "Rioja Reserva DOCa",
            "producer": "Marqués de Riscal",
            "country": "Spanien",
            "region": "Rioja",
            "price": 185,
            "description": "Balanserad Tempranillo med toner av röda bär, vanilj och ek. Passar lamm och tapas.",
            "grape": "Tempranillo",
            "organic": False,
        },
        {
            "name": "Pouilly-Fumé",
            "producer": "Domaine Didier Dagueneau",
            "country": "Frankrike",
            "region": "Loire",
            "price": 345,
            "description": "Aromatisk Sauvignon Blanc med toner av färsk frukt och mineraler. Perfekt till getost och skaldjur.",
            "grape": "Sauvignon Blanc",
            "organic": True,
        },
        {
            "name": "Amarone della Valpolicella DOCG",
            "producer": "Tommasi",
            "country": "Italien",
            "region": "Veneto",
            "price": 425,
            "description": "Kraftfull och komplex med toner av mörka bär, choklad och kryddor. Passar ostklass och vilt.",
            "grape": "Corvina, Rondinella",
            "organic": False,
        },
        {
            "name": "Châteauneuf-du-Pape",
            "producer": "Domaine du Vieux Télégraphe",
            "country": "Frankrike",
            "region": "Rhône",
            "price": 395,
            "description": "Komplex blend med toner av mörka bär, örter och kryddor. Perfekt till grillat kött.",
            "grape": "Grenache, Syrah, Mourvèdre",
            "organic": False,
        },
        {
            "name": "Sancerre",
            "producer": "Pascal Jolivet",
            "country": "Frankrike",
            "region": "Loire",
            "price": 195,
            "description": "Fräsch Sauvignon Blanc med toner av citrus och gröna äpplen. Perfekt till getost.",
            "grape": "Sauvignon Blanc",
            "organic": False,
        },
    ]

    # Duplicera för att nå 200 viner (i verkligheten skulle detta vara unika viner)
    result = []
    for i in range(25):
        for wine in wines:
            result.append({
                **wine,
                "name": f"{wine['name']} {2015 + (i % 8)}",  # Lägg till årgång
                "price": wine["price"] + (i * 10 % 100),  # Variera pris lite
            })

    return result[:200]

def transform_systembolaget_to_winefeed(product: Dict) -> Dict:
    """Transformera Systembolagets format till Winefeed-format."""
    return {
        "namn": product.get('productNameBold', product.get('name', 'Okänt vin')),
        "producent": product.get('producerName', product.get('producer', 'Okänd')),
        "land": product.get('country', 'Okänt'),
        "region": product.get('region', None),
        "pris_sek": int(product.get('price', product.get('priceInclVat', 0))),
        "beskrivning": product.get('taste', product.get('description', 'Ingen beskrivning tillgänglig')),
        "druva": product.get('grapes', product.get('grape', None)),
        "ekologisk": product.get('isOrganic', product.get('organic', False)),
        "lagerstatus": 'tillgänglig',
        "systembolaget_id": str(product.get('productNumber', product.get('productId', ''))),
    }

def save_to_json(wines: List[Dict], filename: str = 'wines-import.json'):
    """Spara viner till JSON-fil."""
    output_path = f'scripts/{filename}'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(wines, f, ensure_ascii=False, indent=2)
    print(f"✅ Sparade {len(wines)} viner till {output_path}")

def upload_to_supabase(wines: List[Dict]):
    """Ladda upp viner till Supabase."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("⚠️  Supabase credentials saknas. Hoppar över upload.")
        print("💡 Kör: cp .env.example .env.local och fyll i dina nycklar")
        return

    print(f"📤 Laddar upp {len(wines)} viner till Supabase...")

    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    }

    # Ladda upp i batchar om 50 viner
    batch_size = 50
    for i in range(0, len(wines), batch_size):
        batch = wines[i:i+batch_size]
        try:
            response = requests.post(
                f'{SUPABASE_URL}/rest/v1/wines',
                headers=headers,
                json=batch,
                timeout=30
            )
            response.raise_for_status()
            print(f"  ✓ Uppladdade {i+len(batch)}/{len(wines)} viner")
        except requests.exceptions.RequestException as e:
            print(f"  ❌ Fel vid uppladdning av batch {i//batch_size + 1}: {e}")
            if hasattr(e.response, 'text'):
                print(f"     Response: {e.response.text}")

    print("✅ Uppladdning klar!")

def main():
    print("🍷 WINEFEED - Vindata Import\n")

    # Försök hämta från Systembolaget, annars använd mock-data
    products = fetch_wines_from_systembolaget(limit=200)

    if not products:
        print("\n⚠️  Kunde inte hämta från Systembolaget, använder mock-data istället")
        products = create_mock_wines()

    # Transformera till Winefeed-format
    wines = [transform_systembolaget_to_winefeed(p) for p in products]

    print(f"\n📊 Bearbetade {len(wines)} viner")

    # Spara till JSON
    save_to_json(wines)

    # Fråga om upload till Supabase
    answer = input("\n📤 Vill du ladda upp till Supabase? (y/N): ").strip().lower()
    if answer == 'y':
        upload_to_supabase(wines)
    else:
        print("💡 Du kan importera manuellt senare från wines-import.json")

    print("\n✨ Klart!")

if __name__ == '__main__':
    main()
