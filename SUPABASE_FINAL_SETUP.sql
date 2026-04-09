-- ============================================================================
-- FINAL COMPLETE SETUP - Run this to fix EVERYTHING
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DROP AND RECREATE PROFILES TABLE (clean slate)
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create trigger for updated_at
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'full_name', email),
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. CREATE MANUAL POSITIONS TABLE WITH SOURCE TRACKING
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS public.manual_positions CASCADE;

CREATE TABLE public.manual_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  yahoo_symbol TEXT NOT NULL,
  product_name TEXT NOT NULL,
  isin TEXT,
  exchange TEXT, -- NEW: Track exchange (NASDAQ, NYSE, AMS, etc)
  quantity DECIMAL(15, 4) NOT NULL,
  average_price DECIMAL(15, 4) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  purchase_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_manual_positions_portfolio ON public.manual_positions(portfolio_id);
CREATE INDEX idx_manual_positions_symbol ON public.manual_positions(yahoo_symbol);

-- RLS
ALTER TABLE public.manual_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manual_positions_select"
  ON public.manual_positions FOR SELECT
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY "manual_positions_insert"
  ON public.manual_positions FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY "manual_positions_update"
  ON public.manual_positions FOR UPDATE
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY "manual_positions_delete"
  ON public.manual_positions FOR DELETE
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

-- Trigger
CREATE TRIGGER set_manual_positions_updated_at
  BEFORE UPDATE ON public.manual_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 3. CREATE TICKER MAPPINGS TABLE (for import approval)
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS public.ticker_mappings CASCADE;

CREATE TABLE public.ticker_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  isin TEXT NOT NULL,
  product_name TEXT NOT NULL,
  exchange TEXT, -- Source exchange from import
  suggested_ticker TEXT NOT NULL, -- AI/fuzzy matched ticker
  yahoo_symbol TEXT NOT NULL, -- Full Yahoo symbol with exchange suffix
  confidence_score DECIMAL(3, 2), -- 0.00 to 1.00
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(isin, product_name)
);

-- RLS
ALTER TABLE public.ticker_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticker_mappings_select_all"
  ON public.ticker_mappings FOR SELECT
  USING (true); -- Everyone can see suggestions

CREATE POLICY "ticker_mappings_insert_own"
  ON public.ticker_mappings FOR INSERT
  WITH CHECK (true); -- Anyone can create mappings during import

CREATE POLICY "ticker_mappings_update_own"
  ON public.ticker_mappings FOR UPDATE
  USING (true); -- Users can approve/modify mappings

-- Index
CREATE INDEX idx_ticker_mappings_isin ON public.ticker_mappings(isin);
CREATE INDEX idx_ticker_mappings_approved ON public.ticker_mappings(is_approved);

COMMENT ON TABLE public.ticker_mappings IS 'Stores AI-suggested ticker mappings that require user approval';

-- ----------------------------------------------------------------------------
-- 4. CREATE CASH POSITIONS TABLE
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS public.cash_positions CASCADE;

CREATE TABLE public.cash_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'EUR',
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, currency)
);

-- Index
CREATE INDEX idx_cash_positions_portfolio ON public.cash_positions(portfolio_id);

-- RLS
ALTER TABLE public.cash_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_positions_select"
  ON public.cash_positions FOR SELECT
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY "cash_positions_insert"
  ON public.cash_positions FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY "cash_positions_update"
  ON public.cash_positions FOR UPDATE
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

CREATE POLICY "cash_positions_delete"
  ON public.cash_positions FOR DELETE
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

-- Trigger
CREATE TRIGGER set_cash_positions_updated_at
  BEFORE UPDATE ON public.cash_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 5. CREATE AVATARS STORAGE BUCKET
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies
DROP POLICY IF EXISTS "avatar_public_read" ON storage.objects;
DROP POLICY IF EXISTS "avatar_user_upload" ON storage.objects;
DROP POLICY IF EXISTS "avatar_user_update" ON storage.objects;
DROP POLICY IF EXISTS "avatar_user_delete" ON storage.objects;

-- Create storage policies
CREATE POLICY "avatar_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatar_user_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatar_user_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatar_user_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- 6. FIX PORTFOLIOS RLS
-- ----------------------------------------------------------------------------

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portfolios_select" ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_insert" ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_update" ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_delete" ON public.portfolios;

CREATE POLICY "portfolios_select"
  ON public.portfolios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "portfolios_insert"
  ON public.portfolios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "portfolios_update"
  ON public.portfolios FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "portfolios_delete"
  ON public.portfolios FOR DELETE
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 7. VERIFICATION
-- ----------------------------------------------------------------------------

-- Check tables
SELECT
  'Table Check' as check_type,
  table_name,
  (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'manual_positions', 'ticker_mappings', 'cash_positions', 'portfolios')
ORDER BY table_name;

-- Check RLS
SELECT
  'RLS Check' as check_type,
  tablename,
  rowsecurity as enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'manual_positions', 'ticker_mappings', 'cash_positions', 'portfolios')
ORDER BY tablename;

-- Check storage
SELECT
  'Storage Check' as check_type,
  id,
  name,
  public
FROM storage.buckets
WHERE id = 'avatars';
