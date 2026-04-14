-- ============================================================================
-- fx_rates — daily FX rate cache
--
-- Populated by the refresh-prices job.  Avoids a live Yahoo call on every
-- price conversion and provides an audit trail of historical rates used.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fx_rates (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency  TEXT        NOT NULL,        -- e.g. 'USD'
  quote_currency TEXT        NOT NULL,        -- e.g. 'EUR'
  rate           NUMERIC(18, 8) NOT NULL,     -- quote per 1 base
  rate_date      DATE        NOT NULL,
  source         TEXT        NOT NULL DEFAULT 'yahoo',
  fetched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fx_rates_unique_pair_date
    UNIQUE (base_currency, quote_currency, rate_date)
);

-- Fast lookup: "give me today's USD/EUR rate"
CREATE INDEX IF NOT EXISTS idx_fx_rates_lookup
  ON public.fx_rates (base_currency, quote_currency, rate_date DESC);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- FX rates are not user-specific: authenticated users can read, only the
-- service role (server-side API routes) can write.

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read fx_rates" ON public.fx_rates;
CREATE POLICY "Authenticated users can read fx_rates"
  ON public.fx_rates FOR SELECT
  USING (auth.role() = 'authenticated');

-- Writes are performed via the service_role key in API routes (bypasses RLS),
-- so no INSERT/UPDATE policy is needed for regular users.

-- ── Seed with current approximate rates ─────────────────────────────────────
-- These are overwritten on the first price refresh; they only serve as a
-- safety net if the job hasn't run yet.

INSERT INTO public.fx_rates (base_currency, quote_currency, rate, rate_date, source)
VALUES
  ('USD', 'EUR', 0.92, CURRENT_DATE, 'seed'),
  ('EUR', 'USD', 1.09, CURRENT_DATE, 'seed'),
  ('GBP', 'EUR', 1.17, CURRENT_DATE, 'seed'),
  ('EUR', 'GBP', 0.86, CURRENT_DATE, 'seed'),
  ('CHF', 'EUR', 1.04, CURRENT_DATE, 'seed'),
  ('SEK', 'EUR', 0.087, CURRENT_DATE, 'seed'),
  ('NOK', 'EUR', 0.086, CURRENT_DATE, 'seed'),
  ('DKK', 'EUR', 0.134, CURRENT_DATE, 'seed')
ON CONFLICT (base_currency, quote_currency, rate_date) DO NOTHING;
