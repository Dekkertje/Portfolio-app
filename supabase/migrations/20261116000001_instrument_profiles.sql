-- ─── Profielgegevens van instrumenten + referentiedata ───────────────────────
-- Sector/land voor aandelen; sectorverdeling (look-through) voor ETF's/fondsen.
-- Bron: Yahoo quoteSummary (assetProfile, topHoldings), periodiek ververst.

ALTER TABLE public.instruments
  ADD COLUMN IF NOT EXISTS industry           TEXT,
  ADD COLUMN IF NOT EXISTS country            TEXT,
  ADD COLUMN IF NOT EXISTS quote_type         TEXT,           -- EQUITY, ETF, MUTUALFUND, CRYPTOCURRENCY
  ADD COLUMN IF NOT EXISTS sector_weights     JSONB,          -- {"technology": 0.58, ...}, som ≈ 1
  ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMPTZ;

-- Kleine sleutel/waarde-opslag voor gedeelde referentiedata, zoals de
-- sectorverdeling van de wereldindex als vergelijkingsmaatstaf.
CREATE TABLE IF NOT EXISTS public.reference_data (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reference_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reference_data_select" ON public.reference_data FOR SELECT TO authenticated USING (true);
