-- Umami Sake Discovery App - Database Schema (No Auth - Simple Version)
-- This schema works without Supabase Auth for initial setup
-- We'll add auth integration later

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- BREWERIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS breweries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_japanese TEXT NOT NULL,
    name_english TEXT NOT NULL,
    prefecture TEXT NOT NULL,
    region TEXT,
    established INTEGER,
    description TEXT,
    image_url TEXT,
    hero_image_url TEXT,
    sake_count INTEGER DEFAULT 0,
    total_ratings INTEGER DEFAULT 0,
    website TEXT,
    email TEXT,
    phone TEXT,
    is_mock BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAKE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS sake (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_japanese TEXT NOT NULL,
    name_english TEXT NOT NULL,
    brewery_id UUID REFERENCES breweries(id) ON DELETE CASCADE,
    brewery_name TEXT NOT NULL,
    prefecture TEXT NOT NULL,
    classification TEXT NOT NULL,
    rice_variety TEXT,
    polish_ratio INTEGER,
    alcohol_content DECIMAL(4,2),

    -- Flavor profile (1-5 scale)
    sweetness INTEGER CHECK (sweetness BETWEEN 1 AND 5),
    acidity INTEGER CHECK (acidity BETWEEN 1 AND 5),
    body INTEGER CHECK (body BETWEEN 1 AND 5),
    umami INTEGER CHECK (umami BETWEEN 1 AND 5),
    aroma_intensity INTEGER CHECK (aroma_intensity BETWEEN 1 AND 5),

    -- Additional metadata
    smv TEXT,
    acidity_value DECIMAL(3,2),
    image_url TEXT,
    price DECIMAL(10,2),
    content TEXT,
    rating DECIMAL(3,2) DEFAULT 0.0,
    review_count INTEGER DEFAULT 0,
    description TEXT,
    serving_temperature TEXT[],
    availability TEXT DEFAULT 'In Stock',
    how_to_serve TEXT,

    is_mock BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FOOD PAIRINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS food_pairings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dish_name TEXT NOT NULL,
    dish_name_japanese TEXT,
    category TEXT NOT NULL,
    image_url TEXT,
    description TEXT,

    is_mock BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAKE-FOOD PAIRING JUNCTION TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS sake_food_pairings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sake_id UUID REFERENCES sake(id) ON DELETE CASCADE,
    food_pairing_id UUID REFERENCES food_pairings(id) ON DELETE CASCADE,

    pairing_score INTEGER CHECK (pairing_score BETWEEN 1 AND 5),
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(sake_id, food_pairing_id)
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sake_brewery ON sake(brewery_id);
CREATE INDEX IF NOT EXISTS idx_sake_prefecture ON sake(prefecture);
CREATE INDEX IF NOT EXISTS idx_sake_classification ON sake(classification);
CREATE INDEX IF NOT EXISTS idx_sake_rating ON sake(rating DESC);
CREATE INDEX IF NOT EXISTS idx_sake_price ON sake(price);
CREATE INDEX IF NOT EXISTS idx_sake_mock ON sake(is_mock);

CREATE INDEX IF NOT EXISTS idx_breweries_prefecture ON breweries(prefecture);
CREATE INDEX IF NOT EXISTS idx_breweries_mock ON breweries(is_mock);

-- Full-text search index for sake names and descriptions
CREATE INDEX IF NOT EXISTS idx_sake_search ON sake USING gin(
    to_tsvector('english', name_english || ' ' || name_japanese || ' ' || COALESCE(description, ''))
);

-- ============================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_breweries_updated_at BEFORE UPDATE ON breweries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sake_updated_at BEFORE UPDATE ON sake
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE breweries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sake ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sake_food_pairings ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables (for now)
CREATE POLICY "Public read access for breweries" ON breweries FOR SELECT USING (true);
CREATE POLICY "Public read access for sake" ON sake FOR SELECT USING (true);
CREATE POLICY "Public read access for food pairings" ON food_pairings FOR SELECT USING (true);
CREATE POLICY "Public read access for sake-food pairings" ON sake_food_pairings FOR SELECT USING (true);

-- Allow service role full access for seeding
CREATE POLICY "Service role can insert breweries" ON breweries FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update breweries" ON breweries FOR UPDATE USING (true);
CREATE POLICY "Service role can delete breweries" ON breweries FOR DELETE USING (true);

CREATE POLICY "Service role can insert sake" ON sake FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update sake" ON sake FOR UPDATE USING (true);
CREATE POLICY "Service role can delete sake" ON sake FOR DELETE USING (true);

CREATE POLICY "Service role can insert food pairings" ON food_pairings FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update food pairings" ON food_pairings FOR UPDATE USING (true);
CREATE POLICY "Service role can delete food pairings" ON food_pairings FOR DELETE USING (true);

CREATE POLICY "Service role can insert sake-food pairings" ON sake_food_pairings FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update sake-food pairings" ON sake_food_pairings FOR UPDATE USING (true);
CREATE POLICY "Service role can delete sake-food pairings" ON sake_food_pairings FOR DELETE USING (true);
