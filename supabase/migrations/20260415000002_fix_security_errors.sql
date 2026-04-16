-- ─── Fix Supabase security errors ────────────────────────────────────────────

-- ── 1. Fix SECURITY DEFINER view: position_dividends ─────────────────────────
-- Recreate with SECURITY INVOKER so RLS of the querying user is enforced,
-- not the view creator's permissions.
DROP VIEW IF EXISTS public.position_dividends;

CREATE VIEW public.position_dividends
  WITH (security_invoker = true)
AS
SELECT
  product,
  isin,
  SUM(CASE WHEN transaction_type = 'dividend' THEN total_eur ELSE 0 END) AS total_dividends_received,
  COUNT(CASE WHEN transaction_type = 'dividend' THEN 1 END)               AS dividend_payment_count
FROM public.transactions
GROUP BY product, isin;

-- ── 2. Enable RLS on prices ───────────────────────────────────────────────────
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all prices (reference data written by server)
CREATE POLICY "prices_select_authenticated"
  ON public.prices FOR SELECT
  TO authenticated
  USING (true);

-- Service role (API routes) handles inserts/updates — no client-side write policy needed.

-- ── 3. Enable RLS on portfolio_snapshots ─────────────────────────────────────
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- Users may only read/write snapshots for their own portfolios
CREATE POLICY "snapshots_select_own"
  ON public.portfolio_snapshots FOR SELECT
  TO authenticated
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "snapshots_insert_own"
  ON public.portfolio_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "snapshots_update_own"
  ON public.portfolio_snapshots FOR UPDATE
  TO authenticated
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- ── 4. Enable RLS on securities ───────────────────────────────────────────────
ALTER TABLE public.securities ENABLE ROW LEVEL SECURITY;

-- Securities is shared reference data — all authenticated users may read.
-- Only service role writes (via refresh-prices API route).
CREATE POLICY "securities_select_authenticated"
  ON public.securities FOR SELECT
  TO authenticated
  USING (true);

-- ── 5. Enable RLS on instruments ─────────────────────────────────────────────
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;

-- Instruments is reference data — authenticated read only.
CREATE POLICY "instruments_select_authenticated"
  ON public.instruments FOR SELECT
  TO authenticated
  USING (true);

-- ── 6. Enable RLS on positions ───────────────────────────────────────────────
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

-- If positions is linked to portfolios via portfolio_id, scope to owner.
-- If it has no portfolio_id, fall back to authenticated-read.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'positions'
      AND column_name  = 'portfolio_id'
  ) THEN
    -- Has portfolio_id — scope to owner
    EXECUTE $policy$
      CREATE POLICY "positions_select_own"
        ON public.positions FOR SELECT
        TO authenticated
        USING (
          portfolio_id IN (
            SELECT id FROM public.portfolios WHERE user_id = auth.uid()
          )
        )
    $policy$;
  ELSE
    -- No portfolio_id — allow all authenticated reads
    EXECUTE $policy$
      CREATE POLICY "positions_select_authenticated"
        ON public.positions FOR SELECT
        TO authenticated
        USING (true)
    $policy$;
  END IF;
END;
$$;
