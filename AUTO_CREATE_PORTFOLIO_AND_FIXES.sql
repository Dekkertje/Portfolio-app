-- ============================================================================
-- AUTO-CREATE PORTFOLIO + FIX DELETE PERMISSIONS
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================
-- 1. UPDATE TRIGGER TO AUTO-CREATE PORTFOLIO
-- ============================================

-- Enhanced function that creates BOTH profile AND portfolio
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_portfolio_id UUID;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create portfolio automatically
  INSERT INTO public.portfolios (user_id, name)
  VALUES (
    NEW.id,
    'My Portfolio'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO new_portfolio_id;

  RAISE NOTICE 'Created profile and portfolio for user %', NEW.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure trigger is attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. CREATE PORTFOLIO FOR EXISTING USERS
-- ============================================

-- Create portfolios for users who don't have one yet
INSERT INTO public.portfolios (user_id, name)
SELECT 
  u.id,
  'My Portfolio'
FROM auth.users u
LEFT JOIN portfolios p ON p.user_id = u.id
WHERE p.id IS NULL
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. FIX DELETE PERMISSIONS FOR MANUAL POSITIONS
-- ============================================

-- Make sure manual_positions table has proper structure
ALTER TABLE manual_positions 
  DROP CONSTRAINT IF EXISTS manual_positions_portfolio_id_fkey;

ALTER TABLE manual_positions
  ADD CONSTRAINT manual_positions_portfolio_id_fkey
  FOREIGN KEY (portfolio_id)
  REFERENCES portfolios(id)
  ON DELETE CASCADE;

-- Enable RLS if not already enabled
ALTER TABLE manual_positions ENABLE ROW LEVEL SECURITY;

-- Drop and recreate DELETE policy
DROP POLICY IF EXISTS "Users can delete own manual positions" ON manual_positions;
CREATE POLICY "Users can delete own manual positions" 
  ON manual_positions FOR DELETE 
  TO authenticated 
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- Also ensure UPDATE policy exists
DROP POLICY IF EXISTS "Users can update own manual positions" ON manual_positions;
CREATE POLICY "Users can update own manual positions" 
  ON manual_positions FOR UPDATE 
  TO authenticated 
  USING (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM portfolios WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 4. VERIFICATION QUERIES
-- ============================================

-- Check users without portfolios
SELECT 
  u.email,
  u.created_at,
  CASE WHEN p.id IS NULL THEN 'NO PORTFOLIO' ELSE 'HAS PORTFOLIO' END as status
FROM auth.users u
LEFT JOIN portfolios p ON p.user_id = u.id
ORDER BY u.created_at DESC;

-- Check wessel specifically
SELECT 
  u.email,
  p.id as portfolio_id,
  p.name as portfolio_name,
  COUNT(mp.id) as manual_positions_count
FROM auth.users u
LEFT JOIN portfolios p ON p.user_id = u.id
LEFT JOIN manual_positions mp ON mp.portfolio_id = p.id
WHERE u.email = 'wessel.bennink@simplicate.nl'
GROUP BY u.email, p.id, p.name;

-- Check all RLS policies for manual_positions
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'manual_positions'
ORDER BY cmd;

-- ============================================
-- 5. TEST DELETE PERMISSION (run as test)
-- ============================================

-- This should show you can delete your own positions
-- (Will fail with permission denied if RLS is wrong)
-- Don't run this if you have real data!

-- SELECT auth.uid(); -- See your user ID
-- DELETE FROM manual_positions WHERE id = 'some-uuid'; -- Test delete
