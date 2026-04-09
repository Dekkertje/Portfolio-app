-- ============================================================================
-- DATABASE DIAGNOSIS - Run this to see current state
-- ============================================================================

-- Check if profiles table exists and its columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check if manual_positions table exists
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'manual_positions'
ORDER BY ordinal_position;

-- Check all policies on profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- Check all policies on manual_positions
SELECT 
  tablename,
  policyname
FROM pg_policies
WHERE tablename = 'manual_positions';
