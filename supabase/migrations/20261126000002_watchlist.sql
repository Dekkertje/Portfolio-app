-- ─── Volglijst: effecten volgen zonder ze te bezitten ─────────────────────────

CREATE TABLE IF NOT EXISTS public.watchlist (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instrument_id UUID        NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT watchlist_unique UNIQUE (user_id, instrument_id)
);

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlist_select" ON public.watchlist FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "watchlist_insert" ON public.watchlist FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "watchlist_delete" ON public.watchlist FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
