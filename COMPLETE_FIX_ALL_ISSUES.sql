-- ============================================================================
-- COMPLETE FIX - ALL PERMISSIONS + MISSING TABLES
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================
-- 1. CREATE MISSING PRICE_ALERTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.price_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product TEXT NOT NULL,
  isin TEXT,
  yahoo_symbol TEXT,
  target_price DECIMAL(10, 2) NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('above', 'below')),
  is_active BOOLEAN DEFAULT true,
  triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for price_alerts
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own alerts" ON price_alerts;
CREATE POLICY "Users can view own alerts" 
  ON price_alerts FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own alerts" ON price_alerts;
CREATE POLICY "Users can insert own alerts" 
  ON price_alerts FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own alerts" ON price_alerts;
CREATE POLICY "Users can update own alerts" 
  ON price_alerts FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own alerts" ON price_alerts;
CREATE POLICY "Users can delete own alerts" 
  ON price_alerts FOR DELETE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- ============================================
-- 2. FIX TRANSACTIONS - ALLOW DELETE
-- ============================================

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Allow users to DELETE their own transactions (imported from DEGIRO)
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;
CREATE POLICY "Users can delete own transactions" 
  ON transactions FOR DELETE 
  TO authenticated 
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 3. FIX MANUAL POSITIONS - ALL OPERATIONS
-- ============================================

ALTER TABLE manual_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own manual positions" ON manual_positions;
CREATE POLICY "Users can view own manual positions" 
  ON manual_positions FOR SELECT 
  TO authenticated 
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own manual positions" ON manual_positions;
CREATE POLICY "Users can insert own manual positions" 
  ON manual_positions FOR INSERT 
  TO authenticated 
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own manual positions" ON manual_positions;
CREATE POLICY "Users can update own manual positions" 
  ON manual_positions FOR UPDATE 
  TO authenticated 
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own manual positions" ON manual_positions;
CREATE POLICY "Users can delete own manual positions" 
  ON manual_positions FOR DELETE 
  TO authenticated 
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 4. FIX PORTFOLIOS
-- ============================================

ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own portfolio" ON portfolios;
CREATE POLICY "Users can view own portfolio" 
  ON portfolios FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own portfolio" ON portfolios;
CREATE POLICY "Users can insert own portfolio" 
  ON portfolios FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own portfolio" ON portfolios;
CREATE POLICY "Users can update own portfolio" 
  ON portfolios FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);

-- ============================================
-- 5. CREATE PORTFOLIO FOR EXISTING USERS
-- ============================================

INSERT INTO public.portfolios (user_id, name)
SELECT 
  u.id,
  'My Portfolio'
FROM auth.users u
LEFT JOIN portfolios p ON p.user_id = u.id
WHERE p.id IS NULL
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. AUTO-CREATE PORTFOLIO TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create portfolio
  INSERT INTO public.portfolios (user_id, name)
  VALUES (NEW.id, 'My Portfolio')
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
