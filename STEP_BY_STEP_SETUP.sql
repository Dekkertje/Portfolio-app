-- ============================================================================
-- STEP BY STEP SETUP - Run each section separately to see errors
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: CREATE PROFILES TABLE
-- Run this first, check for errors
-- ----------------------------------------------------------------------------

-- Drop if exists
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create table
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
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create trigger
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Backfill existing users
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'full_name', email),
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Verify
SELECT 'Step 1 Complete' as status, count(*) as profile_count FROM public.profiles;

-- ----------------------------------------------------------------------------
-- STEP 2: CREATE/FIX MANUAL POSITIONS TABLE
-- Run this after Step 1 succeeds
-- ----------------------------------------------------------------------------

-- First check if portfolios table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portfolios') THEN
    RAISE EXCEPTION 'portfolios table does not exist! Create it first.';
  END IF;
END $$;

-- Drop if exists
DROP TABLE IF EXISTS public.manual_positions CASCADE;

-- Create table
CREATE TABLE public.manual_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  yahoo_symbol TEXT NOT NULL,
  product_name TEXT NOT NULL,
  isin TEXT,
  exchange TEXT,
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

DROP POLICY IF EXISTS "manual_positions_select" ON public.manual_positions;
CREATE POLICY "manual_positions_select"
  ON public.manual_positions FOR SELECT
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "manual_positions_insert" ON public.manual_positions;
CREATE POLICY "manual_positions_insert"
  ON public.manual_positions FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "manual_positions_update" ON public.manual_positions;
CREATE POLICY "manual_positions_update"
  ON public.manual_positions FOR UPDATE
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "manual_positions_delete" ON public.manual_positions;
CREATE POLICY "manual_positions_delete"
  ON public.manual_positions FOR DELETE
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

-- Trigger
DROP TRIGGER IF EXISTS set_manual_positions_updated_at ON public.manual_positions;
CREATE TRIGGER set_manual_positions_updated_at
  BEFORE UPDATE ON public.manual_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Verify
SELECT 'Step 2 Complete' as status;

-- ----------------------------------------------------------------------------
-- STEP 3: CREATE CASH POSITIONS TABLE
-- Run this after Step 2 succeeds
-- ----------------------------------------------------------------------------

-- Drop if exists
DROP TABLE IF EXISTS public.cash_positions CASCADE;

-- Create table
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

DROP POLICY IF EXISTS "cash_positions_select" ON public.cash_positions;
CREATE POLICY "cash_positions_select"
  ON public.cash_positions FOR SELECT
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "cash_positions_insert" ON public.cash_positions;
CREATE POLICY "cash_positions_insert"
  ON public.cash_positions FOR INSERT
  WITH CHECK (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "cash_positions_update" ON public.cash_positions;
CREATE POLICY "cash_positions_update"
  ON public.cash_positions FOR UPDATE
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "cash_positions_delete" ON public.cash_positions;
CREATE POLICY "cash_positions_delete"
  ON public.cash_positions FOR DELETE
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

-- Trigger
DROP TRIGGER IF EXISTS set_cash_positions_updated_at ON public.cash_positions;
CREATE TRIGGER set_cash_positions_updated_at
  BEFORE UPDATE ON public.cash_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Verify
SELECT 'Step 3 Complete' as status;
