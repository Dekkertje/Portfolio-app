-- ============================================================================
-- CREATE TICKER MAPPINGS TABLE
-- For import approval flow with confidence scores
-- ============================================================================

-- Create ticker_mappings table
CREATE TABLE IF NOT EXISTS public.ticker_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  isin TEXT NOT NULL,
  product_name TEXT NOT NULL,
  exchange TEXT, -- Source exchange from CSV (e.g., "AMS", "NASDAQ", "NYSE")
  suggested_ticker TEXT NOT NULL, -- Base ticker (e.g., "ASML", "AAPL")
  yahoo_symbol TEXT NOT NULL, -- Full Yahoo symbol with suffix (e.g., "ASML.AS", "AAPL")
  confidence_score DECIMAL(3, 2), -- 0.00 to 1.00
  match_method TEXT, -- How was this matched: "exact_isin", "fuzzy_name", "manual"
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(isin, product_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ticker_mappings_isin ON public.ticker_mappings(isin);
CREATE INDEX IF NOT EXISTS idx_ticker_mappings_approved ON public.ticker_mappings(is_approved);
CREATE INDEX IF NOT EXISTS idx_ticker_mappings_yahoo_symbol ON public.ticker_mappings(yahoo_symbol);

-- Enable RLS
ALTER TABLE public.ticker_mappings ENABLE ROW LEVEL SECURITY;

-- Policies - Allow all authenticated users to read/write mappings
-- This is a shared resource that benefits all users
DROP POLICY IF EXISTS "ticker_mappings_select_all" ON public.ticker_mappings;
CREATE POLICY "ticker_mappings_select_all"
  ON public.ticker_mappings FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ticker_mappings_insert_authenticated" ON public.ticker_mappings;
CREATE POLICY "ticker_mappings_insert_authenticated"
  ON public.ticker_mappings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ticker_mappings_update_authenticated" ON public.ticker_mappings;
CREATE POLICY "ticker_mappings_update_authenticated"
  ON public.ticker_mappings FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_ticker_mappings_updated_at ON public.ticker_mappings;
CREATE TRIGGER set_ticker_mappings_updated_at
  BEFORE UPDATE ON public.ticker_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comment
COMMENT ON TABLE public.ticker_mappings IS 'Stores AI-suggested ticker mappings with user approval for CSV imports';
COMMENT ON COLUMN public.ticker_mappings.confidence_score IS 'Match confidence: 1.00 = exact ISIN match, 0.70-0.95 = fuzzy match, 0.00 = manual';
COMMENT ON COLUMN public.ticker_mappings.match_method IS 'How ticker was matched: exact_isin, fuzzy_name, manual';

-- Verification
SELECT 'Ticker Mappings Table Created' as status, count(*) as existing_mappings FROM public.ticker_mappings;
