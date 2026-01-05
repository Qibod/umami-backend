-- Umami Sake Discovery App - Database Schema (Supabase Compatible)
-- This schema is designed for Supabase (PostgreSQL)

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
-- USER PROFILES TABLE (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,

    -- Taste profile
    preferred_sweetness INTEGER CHECK (preferred_sweetness BETWEEN 1 AND 5),
    preferred_acidity INTEGER CHECK (preferred_acidity BETWEEN 1 AND 5),
    preferred_body INTEGER CHECK (preferred_body BETWEEN 1 AND 5),

    language_preference TEXT DEFAULT 'en',
    total_sake_rated INTEGER DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REVIEWS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sake_id UUID REFERENCES sake(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    rating DECIMAL(2,1) CHECK (rating BETWEEN 1.0 AND 5.0),
    review_text TEXT,
    language TEXT DEFAULT 'en',

    -- Review metadata
    tasting_location TEXT,
    serving_temperature TEXT,
    food_pairing_notes TEXT,
    photos TEXT[],
    date_tasted DATE,

    helpful_count INTEGER DEFAULT 0,
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
-- USER COLLECTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    sake_id UUID REFERENCES sake(id) ON DELETE CASCADE,
    collection_type TEXT NOT NULL,

    notes TEXT,
    added_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, sake_id, collection_type)
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

CREATE INDEX IF NOT EXISTS idx_reviews_sake ON reviews(sake_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_mock ON reviews(is_mock);

CREATE INDEX IF NOT EXISTS idx_user_collections_user ON user_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_sake ON user_collections(sake_id);

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

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update sake rating when reviews change
CREATE OR REPLACE FUNCTION update_sake_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sake
    SET
        rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE sake_id = COALESCE(NEW.sake_id, OLD.sake_id)),
        review_count = (SELECT COUNT(*) FROM reviews WHERE sake_id = COALESCE(NEW.sake_id, OLD.sake_id))
    WHERE id = COALESCE(NEW.sake_id, OLD.sake_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sake_rating_on_review_insert AFTER INSERT ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_sake_rating();

CREATE TRIGGER update_sake_rating_on_review_update AFTER UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_sake_rating();

CREATE TRIGGER update_sake_rating_on_review_delete AFTER DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_sake_rating();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE breweries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sake ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sake_food_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;

-- Public read access for breweries and sake
CREATE POLICY "Public read access for breweries" ON breweries FOR SELECT USING (true);
CREATE POLICY "Public read access for sake" ON sake FOR SELECT USING (true);
CREATE POLICY "Public read access for food pairings" ON food_pairings FOR SELECT USING (true);
CREATE POLICY "Public read access for sake-food pairings" ON sake_food_pairings FOR SELECT USING (true);

-- Public read access for reviews
CREATE POLICY "Public read access for reviews" ON reviews FOR SELECT USING (true);

-- Users can only read their own profile
CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can manage their own reviews
CREATE POLICY "Users can insert own reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON reviews FOR DELETE USING (auth.uid() = user_id);

-- Users can manage their own collections
CREATE POLICY "Users can read own collections" ON user_collections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own collections" ON user_collections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own collections" ON user_collections FOR DELETE USING (auth.uid() = user_id);

-- Allow service role to bypass RLS for seeding
ALTER TABLE breweries FORCE ROW LEVEL SECURITY;
ALTER TABLE sake FORCE ROW LEVEL SECURITY;
ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE food_pairings FORCE ROW LEVEL SECURITY;
ALTER TABLE sake_food_pairings FORCE ROW LEVEL SECURITY;
ALTER TABLE user_collections FORCE ROW LEVEL SECURITY;
