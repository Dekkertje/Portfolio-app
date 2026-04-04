-- Create portfolio_snapshots table for tracking historical portfolio performance

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  total_value DECIMAL(15, 2) NOT NULL,
  total_cost DECIMAL(15, 2) NOT NULL,
  total_return DECIMAL(15, 2) NOT NULL,
  total_return_pct DECIMAL(10, 4) NOT NULL,
  position_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one snapshot per portfolio per day
  UNIQUE(portfolio_id, snapshot_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_portfolio_id ON portfolio_snapshots(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_date ON portfolio_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_portfolio_date ON portfolio_snapshots(portfolio_id, snapshot_date);

-- Create trigger for updated_at
CREATE TRIGGER update_portfolio_snapshots_updated_at
  BEFORE UPDATE ON portfolio_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE portfolio_snapshots IS 'Historical daily snapshots of portfolio performance';
COMMENT ON COLUMN portfolio_snapshots.snapshot_date IS 'Date of the snapshot (one per day)';
COMMENT ON COLUMN portfolio_snapshots.total_value IS 'Total portfolio value at snapshot time';
COMMENT ON COLUMN portfolio_snapshots.total_cost IS 'Total cost basis at snapshot time';
COMMENT ON COLUMN portfolio_snapshots.total_return IS 'Total return (unrealized + realized) at snapshot time';
COMMENT ON COLUMN portfolio_snapshots.total_return_pct IS 'Total return percentage at snapshot time';
