-- Create politicians table
CREATE TABLE IF NOT EXISTS politicians (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  party TEXT CHECK (party IN ('democrat', 'republican', 'independent')),
  chamber TEXT CHECK (chamber IN ('house', 'senate')),
  state TEXT,
  district TEXT,
  photo_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create politician_trades table
CREATE TABLE IF NOT EXISTS politician_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_id TEXT NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  asset_description TEXT,
  transaction_type TEXT CHECK (transaction_type IN ('purchase', 'sale', 'exchange')),
  transaction_date DATE NOT NULL,
  disclosure_date DATE,
  amount_min DECIMAL(15, 2),
  amount_max DECIMAL(15, 2),
  amount_display TEXT, -- e.g., "$1,001 - $15,000"
  price_at_transaction DECIMAL(15, 4),
  current_price DECIMAL(15, 4),
  gain_loss_percent DECIMAL(10, 4),
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create politician_holdings table (current portfolio)
CREATE TABLE IF NOT EXISTS politician_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_id TEXT NOT NULL REFERENCES politicians(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  asset_description TEXT,
  shares DECIMAL(15, 4),
  average_cost DECIMAL(15, 4),
  current_price DECIMAL(15, 4),
  total_value DECIMAL(15, 2),
  gain_loss_percent DECIMAL(10, 4),
  last_updated DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(politician_id, ticker)
);

-- Create indexes
CREATE INDEX idx_politician_trades_politician_id ON politician_trades(politician_id);
CREATE INDEX idx_politician_trades_ticker ON politician_trades(ticker);
CREATE INDEX idx_politician_trades_transaction_date ON politician_trades(transaction_date DESC);
CREATE INDEX idx_politician_trades_disclosure_date ON politician_trades(disclosure_date DESC);

CREATE INDEX idx_politician_holdings_politician_id ON politician_holdings(politician_id);
CREATE INDEX idx_politician_holdings_ticker ON politician_holdings(ticker);

-- Enable RLS
ALTER TABLE politicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE politician_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE politician_holdings ENABLE ROW LEVEL SECURITY;

-- Create policies (public read access)
CREATE POLICY "Public can read politicians" ON politicians FOR SELECT USING (true);
CREATE POLICY "Public can read politician_trades" ON politician_trades FOR SELECT USING (true);
CREATE POLICY "Public can read politician_holdings" ON politician_holdings FOR SELECT USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_politicians_updated_at BEFORE UPDATE ON politicians
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_politician_trades_updated_at BEFORE UPDATE ON politician_trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_politician_holdings_updated_at BEFORE UPDATE ON politician_holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

