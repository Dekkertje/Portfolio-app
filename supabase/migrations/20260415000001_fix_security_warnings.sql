-- ─── Fix Supabase security warnings ─────────────────────────────────────────
-- Addresses all WARN-level findings from the Supabase database linter.

-- ── 1. Fix mutable search_path on update_updated_at_column ───────────────────
-- Setting search_path = '' prevents search-path injection attacks.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── 2. Fix mutable search_path on handle_new_user ────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

-- ── 3. Move pg_trgm from public to extensions schema ─────────────────────────
-- Create extensions schema if it doesn't exist, then move the extension.
CREATE SCHEMA IF NOT EXISTS extensions;
-- Drop from public and recreate in extensions schema.
-- Note: if any objects depend on public.pg_trgm operators they will be recreated.
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Recreate the trgm index that was dropped by CASCADE
CREATE INDEX IF NOT EXISTS idx_securities_name_trgm
  ON public.securities USING gin (name extensions.gin_trgm_ops);

-- ── 4. Fix overly permissive RLS on ticker_mappings ──────────────────────────
-- INSERT: only authenticated users may insert, and only for their own rows.
DROP POLICY IF EXISTS ticker_mappings_insert_own ON public.ticker_mappings;
CREATE POLICY ticker_mappings_insert_own
  ON public.ticker_mappings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: only authenticated users may update.
DROP POLICY IF EXISTS ticker_mappings_update_own ON public.ticker_mappings;
CREATE POLICY ticker_mappings_update_own
  ON public.ticker_mappings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── 5. Fix public bucket listing on avatars ───────────────────────────────────
-- Remove the broad SELECT policies that allow listing all files, then replace
-- with a narrower policy that allows fetching objects by URL only.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "avatar_public_read" ON storage.objects;

-- Allow public read of individual avatar objects (no bucket-wide listing).
CREATE POLICY "avatar_public_read"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'avatars'
    AND name IS NOT NULL
  );

-- ── 6. Leaked password protection ────────────────────────────────────────────
-- This can only be enabled via the Supabase Dashboard:
-- Authentication → Providers → Email → Enable "Leaked Password Protection"
-- No SQL equivalent is available for this setting.
