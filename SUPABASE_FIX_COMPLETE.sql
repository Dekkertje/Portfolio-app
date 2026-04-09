-- 🔧 COMPLETE SUPABASE RLS FIX
-- Fix all permission issues for import & manual positions
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. PORTFOLIOS - Core user data
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
-- 2. TRANSACTIONS - Import functionality
-- ============================================
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions" 
  ON transactions FOR SELECT 
  TO authenticated 
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
CREATE POLICY "Users can insert own transactions" 
  ON transactions FOR INSERT 
  TO authenticated 
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
CREATE POLICY "Users can update own transactions" 
  ON transactions FOR UPDATE 
  TO authenticated 
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

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
-- 3. MANUAL POSITIONS - Manual stock entry
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
-- 4. TICKER MAPPINGS - Read/Write for all users
-- ============================================
ALTER TABLE ticker_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all ticker mappings" ON ticker_mappings;
CREATE POLICY "Users can read all ticker mappings" 
  ON ticker_mappings FOR SELECT 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Users can insert ticker mappings" ON ticker_mappings;
CREATE POLICY "Users can insert ticker mappings" 
  ON ticker_mappings FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update ticker mappings" ON ticker_mappings;
CREATE POLICY "Users can update ticker mappings" 
  ON ticker_mappings FOR UPDATE 
  TO authenticated 
  USING (true);

-- ============================================
-- 5. SECURITIES - Read-only for all users
-- ============================================
ALTER TABLE securities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read securities" ON securities;
CREATE POLICY "Anyone can read securities"
  ON securities FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- 6. CASH POSITIONS
-- ============================================
ALTER TABLE cash_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own cash positions" ON cash_positions;
CREATE POLICY "Users can view own cash positions"
  ON cash_positions FOR SELECT
  TO authenticated
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own cash positions" ON cash_positions;
CREATE POLICY "Users can insert own cash positions"
  ON cash_positions FOR INSERT
  TO authenticated
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own cash positions" ON cash_positions;
CREATE POLICY "Users can update own cash positions"
  ON cash_positions FOR UPDATE
  TO authenticated
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own cash positions" ON cash_positions;
CREATE POLICY "Users can delete own cash positions"
  ON cash_positions FOR DELETE
  TO authenticated
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 7. PROFILES - User profile data
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if user has a portfolio
SELECT
  u.email,
  p.id as portfolio_id,
  p.name
FROM auth.users u
LEFT JOIN portfolios p ON p.user_id = u.id
WHERE u.email = 'wessel.bennink@simplicate.nl';

-- Count transactions for user
SELECT
  COUNT(*) as transaction_count
FROM transactions t
JOIN portfolios p ON t.portfolio_id = p.id
JOIN auth.users u ON p.user_id = u.id
WHERE u.email = 'wessel.bennink@simplicate.nl';

-- Count manual positions for user
SELECT
  COUNT(*) as manual_position_count
FROM manual_positions mp
JOIN portfolios p ON mp.portfolio_id = p.id
JOIN auth.users u ON p.user_id = u.id
WHERE u.email = 'wessel.bennink@simplicate.nl';

-- List all RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename IN (
  'portfolios',
  'transactions',
  'manual_positions',
  'ticker_mappings',
  'securities',
  'cash_positions',
  'profiles'
)
ORDER BY tablename, policyname;
