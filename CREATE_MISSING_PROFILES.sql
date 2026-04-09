-- ============================================================================
-- CREATE PROFILES FOR ALL EXISTING USERS
-- Run this to create profiles for users created before the trigger was added
-- ============================================================================

-- Create profiles for ALL users in auth.users
INSERT INTO public.profiles (id, full_name, avatar_url)
SELECT 
  id,
  COALESCE(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    email
  ) as full_name,
  raw_user_meta_data->>'avatar_url' as avatar_url
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
  avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
  updated_at = NOW();

-- Verify all users have a profile
SELECT 
  'Verification' as check_type,
  (SELECT count(*) FROM auth.users) as total_users,
  (SELECT count(*) FROM public.profiles) as total_profiles,
  CASE 
    WHEN (SELECT count(*) FROM auth.users) = (SELECT count(*) FROM public.profiles) 
    THEN '✅ All users have profiles'
    ELSE '⚠️ Missing profiles detected'
  END as status;

-- Show your profile
SELECT 
  'Your Profile' as info,
  id,
  full_name,
  avatar_url,
  created_at
FROM public.profiles
WHERE id = auth.uid();
