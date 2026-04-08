-- Add manual positions and cash tracking

-- Create manual_positions table for stocks added manually (not from DEGIRO)
CREATE TABLE IF NOT EXISTS manual_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL,
  yahoo_symbol TEXT NOT NULL,
  product_name TEXT NOT NULL,
  isin TEXT,
  quantity DECIMAL(15, 4) NOT NULL,
  average_price DECIMAL(15, 4) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  purchase_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cash_positions table for tracking cash
CREATE TABLE IF NOT EXISTS cash_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  amount DECIMAL(15, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one cash position per portfolio per currency
  UNIQUE(portfolio_id, currency)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_manual_positions_portfolio_id ON manual_positions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_manual_positions_yahoo_symbol ON manual_positions(yahoo_symbol);
CREATE INDEX IF NOT EXISTS idx_cash_positions_portfolio_id ON cash_positions(portfolio_id);

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_manual_positions_updated_at ON manual_positions;
CREATE TRIGGER update_manual_positions_updated_at
  BEFORE UPDATE ON manual_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cash_positions_updated_at ON cash_positions;
CREATE TRIGGER update_cash_positions_updated_at
  BEFORE UPDATE ON cash_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE manual_positions IS 'Manually added stock positions (not imported from DEGIRO)';
COMMENT ON TABLE cash_positions IS 'Cash holdings per currency';
COMMENT ON COLUMN manual_positions.yahoo_symbol IS 'Yahoo Finance symbol (e.g., AAPL, TSLA)';
COMMENT ON COLUMN manual_positions.average_price IS 'Average purchase price in the specified currency';
COMMENT ON COLUMN cash_positions.amount IS 'Cash amount in the specified currency';
