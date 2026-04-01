-- Create securities reference database for stocks and ETFs
-- This acts as a fallback when exact product name matching fails

CREATE TABLE IF NOT EXISTS securities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  isin TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  alternative_names TEXT[], -- Array of alternative names for fuzzy matching
  ticker_symbol TEXT NOT NULL,
  yahoo_symbol TEXT NOT NULL, -- Yahoo Finance specific symbol (e.g., AAPL, ASML.AS)
  exchange TEXT NOT NULL, -- e.g., 'NASDAQ', 'XETRA', 'EURONEXT'
  currency TEXT NOT NULL, -- 'USD' or 'EUR'
  security_type TEXT NOT NULL, -- 'STOCK' or 'ETF'
  sector TEXT, -- For stocks: 'Technology', 'Healthcare', etc.
  region TEXT, -- 'US', 'Europe', 'Asia', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX idx_securities_isin ON securities(isin);
CREATE INDEX idx_securities_name ON securities(name);
CREATE INDEX idx_securities_ticker ON securities(ticker_symbol);
CREATE INDEX idx_securities_type ON securities(security_type);

-- Enable full-text search on name and alternative names
CREATE INDEX idx_securities_name_trgm ON securities USING gin (name gin_trgm_ops);

-- Create trigger for updated_at
CREATE TRIGGER update_securities_updated_at
  BEFORE UPDATE ON securities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

