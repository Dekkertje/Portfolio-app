-- ============================================================================
-- COMPLETE SUPABASE SETUP - RUN THIS ONCE
-- This creates all tables, buckets, and RLS policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CREATE PROFILES TABLE (if not exists)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  full_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create correct policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url')
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

-- Create profiles for existing users (one-time migration)
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT 
  id,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. CREATE MANUAL POSITIONS TABLE (if not exists)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.manual_positions (
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

-- Enable RLS
ALTER TABLE public.manual_positions ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_manual_positions_portfolio_id ON public.manual_positions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_manual_positions_yahoo_symbol ON public.manual_positions(yahoo_symbol);

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view manual positions" ON public.manual_positions;
DROP POLICY IF EXISTS "Users can insert manual positions" ON public.manual_positions;
DROP POLICY IF EXISTS "Users can update manual positions" ON public.manual_positions;
DROP POLICY IF EXISTS "Users can delete manual positions" ON public.manual_positions;

-- Create correct policies
CREATE POLICY "Users can view manual positions"
  ON public.manual_positions FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert manual positions"
  ON public.manual_positions FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update manual positions"
  ON public.manual_positions FOR UPDATE
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete manual positions"
  ON public.manual_positions FOR DELETE
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- Create trigger
DROP TRIGGER IF EXISTS update_manual_positions_updated_at ON public.manual_positions;
CREATE TRIGGER update_manual_positions_updated_at
  BEFORE UPDATE ON public.manual_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 3. CREATE CASH POSITIONS TABLE (if not exists)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cash_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, currency)
);

-- Enable RLS
ALTER TABLE public.cash_positions ENABLE ROW LEVEL SECURITY;

-- Create index
CREATE INDEX IF NOT EXISTS idx_cash_positions_portfolio_id ON public.cash_positions(portfolio_id);

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view cash positions" ON public.cash_positions;
DROP POLICY IF EXISTS "Users can insert cash positions" ON public.cash_positions;
DROP POLICY IF EXISTS "Users can update cash positions" ON public.cash_positions;
DROP POLICY IF EXISTS "Users can delete cash positions" ON public.cash_positions;

-- Create correct policies
CREATE POLICY "Users can view cash positions"
  ON public.cash_positions FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert cash positions"
  ON public.cash_positions FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update cash positions"
  ON public.cash_positions FOR UPDATE
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete cash positions"
  ON public.cash_positions FOR DELETE
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- Create trigger
DROP TRIGGER IF EXISTS update_cash_positions_updated_at ON public.cash_positions;
CREATE TRIGGER update_cash_positions_updated_at
  BEFORE UPDATE ON public.cash_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 4. CREATE AVATARS STORAGE BUCKET
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- Create storage policies
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ----------------------------------------------------------------------------
-- 5. FIX PORTFOLIOS TABLE RLS (existing table)
-- ----------------------------------------------------------------------------

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own portfolios" ON public.portfolios;
DROP POLICY IF EXISTS "Users can create their own portfolio" ON public.portfolios;
DROP POLICY IF EXISTS "Users can update their own portfolio" ON public.portfolios;
DROP POLICY IF EXISTS "Users can delete their own portfolio" ON public.portfolios;

-- Create correct policies
CREATE POLICY "Users can view their own portfolios"
  ON public.portfolios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own portfolio"
  ON public.portfolios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own portfolio"
  ON public.portfolios FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own portfolio"
  ON public.portfolios FOR DELETE
  USING (auth.uid() = user_id);

-- Enable RLS
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 6. VERIFICATION
-- ----------------------------------------------------------------------------

SELECT
  'Tables Check' as check_type,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('portfolios', 'profiles', 'manual_positions', 'cash_positions')
ORDER BY tablename;

SELECT
  'Storage Bucket Check' as check_type,
  id,
  name,
  public
FROM storage.buckets
WHERE id = 'avatars';
