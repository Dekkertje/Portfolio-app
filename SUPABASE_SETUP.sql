-- ============================================================================
-- COMPLETE SUPABASE SETUP SCRIPT
-- Run this ONCE in Supabase SQL Editor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CREATE MANUAL POSITIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manual_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL,
  yahoo_symbol TEXT NOT NULL,
  product_name TEXT NOT NULL,
  isin TEXT,
  quantity DECIMAL(15, 4) NOT NULL,
  average_price DECIMAL(15, 4) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  purchase_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_manual_positions_portfolio_id ON manual_positions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_manual_positions_yahoo_symbol ON manual_positions(yahoo_symbol);

-- Create trigger
DROP TRIGGER IF EXISTS update_manual_positions_updated_at ON manual_positions;
CREATE TRIGGER update_manual_positions_updated_at
  BEFORE UPDATE ON manual_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE manual_positions IS 'Manually added stock positions (not imported from DEGIRO)';

-- ----------------------------------------------------------------------------
-- 2. CREATE CASH POSITIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, currency)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cash_positions_portfolio_id ON cash_positions(portfolio_id);

-- Create trigger
DROP TRIGGER IF EXISTS update_cash_positions_updated_at ON cash_positions;
CREATE TRIGGER update_cash_positions_updated_at
  BEFORE UPDATE ON cash_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE cash_positions IS 'Cash holdings per currency';

-- ----------------------------------------------------------------------------
-- 3. CREATE AVATARS STORAGE BUCKET
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. SETUP STORAGE RLS POLICIES
-- ----------------------------------------------------------------------------

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- Public read access
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- User can upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- User can update their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- User can delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ----------------------------------------------------------------------------
-- 5. CREATE PROFILES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  full_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 6. FIX ALL RLS POLICIES
-- ----------------------------------------------------------------------------

-- PORTFOLIOS
DROP POLICY IF EXISTS "Users can view their own portfolios" ON portfolios;
DROP POLICY IF EXISTS "Users can create their own portfolio" ON portfolios;
DROP POLICY IF EXISTS "Users can update their own portfolio" ON portfolios;
DROP POLICY IF EXISTS "Users can delete their own portfolio" ON portfolios;

CREATE POLICY "Users can view their own portfolios"
  ON portfolios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own portfolio"
  ON portfolios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own portfolio"
  ON portfolios FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own portfolio"
  ON portfolios FOR DELETE
  USING (auth.uid() = user_id);

-- MANUAL POSITIONS
DROP POLICY IF EXISTS "Users can view manual positions" ON manual_positions;
DROP POLICY IF EXISTS "Users can insert manual positions" ON manual_positions;
DROP POLICY IF EXISTS "Users can update manual positions" ON manual_positions;
DROP POLICY IF EXISTS "Users can delete manual positions" ON manual_positions;

CREATE POLICY "Users can view manual positions"
  ON manual_positions FOR SELECT
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert manual positions"
  ON manual_positions FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can update manual positions"
  ON manual_positions FOR UPDATE
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete manual positions"
  ON manual_positions FOR DELETE
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

-- CASH POSITIONS
DROP POLICY IF EXISTS "Users can view cash positions" ON cash_positions;
DROP POLICY IF EXISTS "Users can insert cash positions" ON cash_positions;
DROP POLICY IF EXISTS "Users can update cash positions" ON cash_positions;
DROP POLICY IF EXISTS "Users can delete cash positions" ON cash_positions;

CREATE POLICY "Users can view cash positions"
  ON cash_positions FOR SELECT
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert cash positions"
  ON cash_positions FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can update cash positions"
  ON cash_positions FOR UPDATE
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete cash positions"
  ON cash_positions FOR DELETE
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 7. VERIFY SETUP
-- ----------------------------------------------------------------------------
SELECT
  'manual_positions' as table_name,
  EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'manual_positions') as exists
UNION ALL
SELECT
  'cash_positions',
  EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cash_positions')
UNION ALL
SELECT
  'profiles',
  EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles')
UNION ALL
SELECT
  'avatars_bucket',
  EXISTS (SELECT FROM storage.buckets WHERE id = 'avatars');
