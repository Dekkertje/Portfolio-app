-- ── Politician follows ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.politician_follows (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  politician_id UUID NOT NULL REFERENCES public.politicians(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, politician_id)
);

ALTER TABLE public.politician_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows_select_own" ON public.politician_follows
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "follows_insert_own" ON public.politician_follows
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "follows_delete_own" ON public.politician_follows
  FOR DELETE USING (auth.uid() = user_id);

-- ── Notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,          -- 'politician_trade' | 'price_alert' | 'system'
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert_own" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);
