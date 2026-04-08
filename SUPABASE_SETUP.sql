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
-- 5. VERIFY SETUP
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
  'avatars_bucket',
  EXISTS (SELECT FROM storage.buckets WHERE id = 'avatars');
