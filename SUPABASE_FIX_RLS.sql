-- ============================================================================
-- COMPLETE RLS POLICY FIX
-- Run this to fix all authentication and permission issues
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FIX PORTFOLIOS TABLE RLS
-- ----------------------------------------------------------------------------

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own portfolios" ON portfolios;
DROP POLICY IF EXISTS "Users can create their own portfolio" ON portfolios;
DROP POLICY IF EXISTS "Users can update their own portfolio" ON portfolios;
DROP POLICY IF EXISTS "Users can delete their own portfolio" ON portfolios;

-- Create correct policies
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

-- ----------------------------------------------------------------------------
-- 2. FIX PROFILES TABLE RLS
-- ----------------------------------------------------------------------------

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create correct policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 3. FIX MANUAL POSITIONS RLS
-- ----------------------------------------------------------------------------

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view manual positions" ON manual_positions;
DROP POLICY IF EXISTS "Users can insert manual positions" ON manual_positions;
DROP POLICY IF EXISTS "Users can update manual positions" ON manual_positions;
DROP POLICY IF EXISTS "Users can delete manual positions" ON manual_positions;

-- Create correct policies (linked via portfolio)
CREATE POLICY "Users can view manual positions"
  ON manual_positions FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert manual positions"
  ON manual_positions FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update manual positions"
  ON manual_positions FOR UPDATE
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete manual positions"
  ON manual_positions FOR DELETE
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. FIX CASH POSITIONS RLS
-- ----------------------------------------------------------------------------

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view cash positions" ON cash_positions;
DROP POLICY IF EXISTS "Users can insert cash positions" ON cash_positions;
DROP POLICY IF EXISTS "Users can update cash positions" ON cash_positions;
DROP POLICY IF EXISTS "Users can delete cash positions" ON cash_positions;

-- Create correct policies
CREATE POLICY "Users can view cash positions"
  ON cash_positions FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert cash positions"
  ON cash_positions FOR INSERT
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update cash positions"
  ON cash_positions FOR UPDATE
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete cash positions"
  ON cash_positions FOR DELETE
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 5. VERIFY RLS IS ENABLED
-- ----------------------------------------------------------------------------

ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_positions ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 6. VERIFICATION
-- ----------------------------------------------------------------------------

SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('portfolios', 'profiles', 'manual_positions', 'cash_positions')
ORDER BY tablename;
