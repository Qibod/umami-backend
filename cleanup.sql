-- Cleanup script - Run this FIRST to remove any existing tables
-- This ensures a clean slate before running schema-no-auth.sql

-- Drop all tables (in correct order due to foreign key constraints)
DROP TABLE IF EXISTS sake_food_pairings CASCADE;
DROP TABLE IF EXISTS user_collections CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS food_pairings CASCADE;
DROP TABLE IF EXISTS sake CASCADE;
DROP TABLE IF EXISTS breweries CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop any existing functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_sake_rating() CASCADE;

-- Note: This will delete ALL data in these tables!
-- Only run this if you're okay starting fresh.
