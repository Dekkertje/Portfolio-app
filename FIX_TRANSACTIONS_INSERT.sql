-- ============================================================================
-- FIX TRANSACTIONS INSERT POLICY
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- SELECT policy
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions" 
  ON transactions FOR SELECT 
  TO authenticated 
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- INSERT policy (CRITICAL for import!)
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
CREATE POLICY "Users can insert own transactions" 
  ON transactions FOR INSERT 
  TO authenticated 
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- UPDATE policy
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
CREATE POLICY "Users can update own transactions" 
  ON transactions FOR UPDATE 
  TO authenticated 
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- DELETE policy
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;
CREATE POLICY "Users can delete own transactions" 
  ON transactions FOR DELETE 
  TO authenticated 
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- Verify policies
SELECT 
  tablename,
  policyname,
  cmd as operation,
  CASE 
    WHEN cmd = 'SELECT' THEN '✅ Can read'
    WHEN cmd = 'INSERT' THEN '✅ Can import'
    WHEN cmd = 'UPDATE' THEN '✅ Can update'
    WHEN cmd = 'DELETE' THEN '✅ Can delete'
  END as status
FROM pg_policies
WHERE tablename = 'transactions'
ORDER BY cmd;

-- Expected output:
-- transactions | Users can delete own transactions | DELETE | ✅ Can delete
-- transactions | Users can insert own transactions | INSERT | ✅ Can import
-- transactions | Users can view own transactions   | SELECT | ✅ Can read
-- transactions | Users can update own transactions | UPDATE | ✅ Can update
