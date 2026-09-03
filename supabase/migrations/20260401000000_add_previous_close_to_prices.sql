-- Add previous_close column to prices table for daily P&L calculation
ALTER TABLE prices 
ADD COLUMN IF NOT EXISTS previous_close NUMERIC;

-- Add comment to explain the column
COMMENT ON COLUMN prices.previous_close IS 'Previous day closing price for calculating daily change';

