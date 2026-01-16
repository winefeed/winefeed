-- WINEFEED DATABASE SCHEMA
-- Kör detta i Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- TABELL 1: Restauranger (Supabase Auth hanterar users-tabellen, detta är metadata)
CREATE TABLE restaurants (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELL 2: Viner
CREATE TABLE wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namn TEXT NOT NULL,
  producent TEXT NOT NULL,
  land TEXT NOT NULL,
  region TEXT,
  pris_sek INTEGER NOT NULL, -- heltal för att undvika float-problem
  beskrivning TEXT NOT NULL,
  druva TEXT,
  ekologisk BOOLEAN DEFAULT FALSE,
  lagerstatus TEXT DEFAULT 'tillgänglig' CHECK (lagerstatus IN ('tillgänglig', 'få kvar', 'slut')),
  systembolaget_id TEXT UNIQUE, -- om data kommer från Systembolaget
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index för snabbare filtrering
CREATE INDEX idx_wines_pris ON wines(pris_sek);
CREATE INDEX idx_wines_land ON wines(land);
CREATE INDEX idx_wines_lagerstatus ON wines(lagerstatus);

-- TABELL 3: Leverantörer
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namn TEXT NOT NULL,
  kontakt_email TEXT NOT NULL,
  telefon TEXT,
  hemsida TEXT,
  normalleveranstid_dagar INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELL 4: Koppling vin ↔ leverantör (många-till-många)
CREATE TABLE wine_suppliers (
  wine_id UUID REFERENCES wines(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  PRIMARY KEY (wine_id, supplier_id)
);

-- TABELL 5: Förfrågningar (sparar vad restaurangen frågade efter)
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  fritext TEXT NOT NULL,
  budget_per_flaska INTEGER,
  antal_flaskor INTEGER,
  leverans_senast DATE,
  specialkrav TEXT[], -- array av krav: ["ekologiskt", "veganskt"]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELL 6: Genererade förslag (sparar vad AI:n föreslog)
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  wine_id UUID REFERENCES wines(id) ON DELETE SET NULL,
  motivering TEXT NOT NULL, -- AI-genererad text
  ranking_score DECIMAL(3,2), -- 0.00-1.00
  accepted BOOLEAN DEFAULT FALSE, -- true om restaurang klickade "inkludera i offert"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELL 7: Skickade offerter (tracking)
CREATE TABLE offers_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  wine_ids UUID[], -- array av vin-ID:n som skickades
  email_sent_at TIMESTAMPTZ DEFAULT NOW(),
  supplier_responded BOOLEAN DEFAULT FALSE,
  response_received_at TIMESTAMPTZ
);

-- RLS (Row Level Security) – restauranger ser bara sin egen data
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restauranger ser bara egna requests"
  ON requests FOR ALL
  USING (auth.uid() = restaurant_id);

CREATE POLICY "Restauranger ser bara egna suggestions"
  ON suggestions FOR ALL
  USING (
    request_id IN (SELECT id FROM requests WHERE restaurant_id = auth.uid())
  );

-- Skapa en funktion för att automatiskt skapa restaurant-post vid signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.restaurants (id, name, contact_email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Ny restaurang'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger som körs när ny user skapas i auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
