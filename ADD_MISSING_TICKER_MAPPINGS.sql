-- ============================================================================
-- ADD MISSING TICKER MAPPINGS
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Delete existing mappings for these ISINs first (if any)
DELETE FROM ticker_mappings
WHERE isin IN (
  'NL0012817175', 'NL0013654783', 'NL0010408704',
  'US6311031081', 'US63942X1063', 'US75734B1008', 'US88160R1014',
  'GB00BMHVL512',
  'IE00BZ4BMM98', 'IE0031442068', 'DE000A0F5UF5', 'IE00BMC38736', 'IE00B3RBWM25'
);

-- Insert all missing ticker mappings
INSERT INTO ticker_mappings (
  isin,
  product_name,
  suggested_ticker,
  yahoo_symbol,
  confidence_score,
  match_method,
  is_approved
) VALUES
  -- Dutch Stocks
  ('NL0012817175', 'ALFEN NV', 'ALFEN', 'ALFEN.AS', 1.0, 'manual', true),
  ('NL0013654783', 'PROSUS NV CLASS N', 'PRX', 'PRX.AS', 1.0, 'manual', true),
  ('NL0010408704', 'VANECK WORLD EQUAL WEIGHT SCREENED UCITS ETF', 'TGET', 'TGET.AS', 1.0, 'manual', true),

  -- US Stocks
  ('US6311031081', 'NASDAQ INC', 'NDAQ', 'NDAQ', 1.0, 'manual', true),
  ('US63942X1063', 'NAVITAS SEMICONDUCTOR CORP', 'NVTS', 'NVTS', 1.0, 'manual', true),
  ('US75734B1008', 'REDDIT INC CLASS A', 'RDDT', 'RDDT', 1.0, 'manual', true),
  ('US88160R1014', 'TESLA INC', 'TSLA', 'TSLA', 1.0, 'manual', true),

  -- UK Stock (Note: Klarna is not publicly traded yet, use placeholder)
  ('GB00BMHVL512', 'KLARNA GROUP PLC', 'KLRN', 'KLRN.L', 0.5, 'manual', true),

  -- European ETFs (CORRECTED - use Amsterdam exchange where possible)
  ('IE00BZ4BMM98', 'INVESCO EURO STOXX HI DIV LOW VLTY UCITS ETF DIST', 'EUHD', 'EUHD.AS', 1.0, 'manual', true),
  ('IE0031442068', 'ISHARES CORE S&P 500 UCITS ETF USD (DIST)', 'CSPX', 'CSPX.AS', 1.0, 'manual', true),
  ('DE000A0F5UF5', 'ISHARES NASDAQ-100 UCITS (DE) ETF', 'SXRV', 'SXRV.DE', 1.0, 'manual', true),
  ('IE00BMC38736', 'VANECK SEMICONDUCTOR UCITS ETF USD A', 'SMH', 'SMH.AS', 1.0, 'manual', true),
  ('IE00B3RBWM25', 'VANGUARD FTSE ALL-WORLD UCITS ETF USD DIS', 'VWRL', 'VWRL.AS', 1.0, 'manual', true);

-- Verify mappings
SELECT 
  product_name,
  isin,
  yahoo_symbol,
  is_approved,
  '✅ Added' as status
FROM ticker_mappings
WHERE is_approved = true
ORDER BY product_name;
