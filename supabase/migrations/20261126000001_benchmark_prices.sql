-- ─── Slotkoersen van vergelijkingsindexen ─────────────────────────────────────
-- Los van daily_prices: indexen zijn geen instrumenten in iemands grootboek.
-- Gevuld door de koers-cron; leesbaar voor ingelogde gebruikers.

CREATE TABLE IF NOT EXISTS public.benchmark_prices (
  symbol     TEXT           NOT NULL,
  price_date DATE           NOT NULL,
  close      NUMERIC(20, 6) NOT NULL,
  fetched_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  PRIMARY KEY (symbol, price_date)
);

ALTER TABLE public.benchmark_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "benchmark_prices_select" ON public.benchmark_prices FOR SELECT TO authenticated USING (true);
