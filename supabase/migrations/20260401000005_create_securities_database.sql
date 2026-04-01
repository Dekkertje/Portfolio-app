-- Create securities reference database for stocks and ETFs
-- This acts as a fallback when exact product name matching fails

-- Enable pg_trgm extension for fuzzy text matching (must be done first)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS securities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  isin TEXT UNIQUE,
  name TEXT NOT NULL,
  alternative_names TEXT[] DEFAULT '{}',
  ticker_symbol TEXT,
  yahoo_symbol TEXT,
  exchange TEXT,
  currency TEXT,
  security_type TEXT CHECK (security_type IN ('STOCK', 'ETF', 'BOND', 'OPTION', 'FUTURE', 'CRYPTO')),
  sector TEXT,
  region TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_securities_isin ON securities(isin);
CREATE INDEX IF NOT EXISTS idx_securities_name ON securities(name);
CREATE INDEX IF NOT EXISTS idx_securities_ticker ON securities(ticker_symbol);
CREATE INDEX IF NOT EXISTS idx_securities_yahoo ON securities(yahoo_symbol);

-- Enable full-text search on name and alternative names
CREATE INDEX idx_securities_name_trgm ON securities USING gin (name gin_trgm_ops);

-- Create function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_securities_updated_at
  BEFORE UPDATE ON securities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();