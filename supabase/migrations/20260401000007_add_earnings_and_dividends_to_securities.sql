-- Add earnings dates and dividend info to securities table
ALTER TABLE securities 
ADD COLUMN IF NOT EXISTS next_earnings_date DATE,
ADD COLUMN IF NOT EXISTS annual_dividend DECIMAL(10, 4),
ADD COLUMN IF NOT EXISTS dividend_frequency TEXT CHECK (dividend_frequency IN ('annual', 'quarterly', 'monthly', 'none'));

-- Add column to track total dividends received per position
-- This will be a view that calculates from transactions
CREATE OR REPLACE VIEW position_dividends AS
SELECT 
  product,
  isin,
  SUM(CASE WHEN transaction_type = 'dividend' THEN total_eur ELSE 0 END) as total_dividends_received,
  COUNT(CASE WHEN transaction_type = 'dividend' THEN 1 END) as dividend_payment_count
FROM transactions
GROUP BY product, isin;

-- Update securities with dividend and earnings data
UPDATE securities SET annual_dividend = 6.25, dividend_frequency = 'annual', next_earnings_date = '2026-04-23' WHERE isin = 'NL0010273215'; -- ASML
UPDATE securities SET annual_dividend = 0, dividend_frequency = 'none' WHERE isin = 'US02079K3059'; -- Alphabet
UPDATE securities SET annual_dividend = 0, dividend_frequency = 'none' WHERE isin = 'US0378331005'; -- Apple (stopped in 2026 Q1)
UPDATE securities SET annual_dividend = 0.88, dividend_frequency = 'quarterly', next_earnings_date = '2026-04-24' WHERE isin = 'US5949181045'; -- Microsoft
UPDATE securities SET annual_dividend = 0, dividend_frequency = 'none' WHERE isin = 'US30303M1027'; -- Meta
UPDATE securities SET annual_dividend = 0, dividend_frequency = 'none' WHERE isin = 'US0231351067'; -- Amazon
UPDATE securities SET annual_dividend = 0, dividend_frequency = 'none' WHERE isin = 'US67066G1040'; -- NVIDIA
UPDATE securities SET annual_dividend = 0.50, dividend_frequency = 'quarterly', next_earnings_date = '2026-04-22' WHERE isin = 'US4581401001'; -- Intel
UPDATE securities SET annual_dividend = 1.85, dividend_frequency = 'quarterly', next_earnings_date = '2026-05-01' WHERE isin = 'IE0032077012'; -- Invesco EQQQ
UPDATE securities SET annual_dividend = 0, dividend_frequency = 'none' WHERE isin = 'US8334451098'; -- SoFi
UPDATE securities SET annual_dividend = 0, dividend_frequency = 'none', next_earnings_date = '2026-05-05' WHERE isin = 'US69608A1088'; -- Palantir
UPDATE securities SET annual_dividend = 0, dividend_frequency = 'none', next_earnings_date = '2026-04-30' WHERE isin = 'US23804L1035'; -- CrowdStrike

COMMENT ON COLUMN securities.next_earnings_date IS 'Next expected earnings announcement date';
COMMENT ON COLUMN securities.annual_dividend IS 'Annual dividend per share in the security currency';
COMMENT ON COLUMN securities.dividend_frequency IS 'How often dividends are paid out';

