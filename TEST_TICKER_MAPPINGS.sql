-- ============================================================================
-- TEST TICKER MAPPINGS
-- Run this to check if ticker mappings are working
-- ============================================================================

-- Check all approved ticker mappings
SELECT 
  isin,
  product_name,
  yahoo_symbol,
  confidence_score,
  match_method,
  is_approved,
  approved_at
FROM ticker_mappings
WHERE is_approved = true
ORDER BY approved_at DESC;

-- Check which products have transactions but NO ticker mapping
SELECT DISTINCT
  t.product,
  t.isin,
  CASE 
    WHEN tm.id IS NULL THEN '❌ NO MAPPING'
    WHEN tm.is_approved = false THEN '⚠️ NOT APPROVED'
    ELSE '✅ APPROVED'
  END as mapping_status,
  tm.yahoo_symbol
FROM transactions t
LEFT JOIN ticker_mappings tm ON (t.isin = tm.isin AND t.product = tm.product_name)
ORDER BY mapping_status, t.product;

-- Check if manual_positions have all required policies
SELECT 
  tablename,
  policyname,
  cmd as operation,
  CASE 
    WHEN cmd = 'SELECT' THEN '✅'
    WHEN cmd = 'INSERT' THEN '✅'
    WHEN cmd = 'UPDATE' THEN '✅'
    WHEN cmd = 'DELETE' THEN '✅'
    ELSE '❓'
  END as status
FROM pg_policies
WHERE tablename = 'manual_positions'
ORDER BY cmd;

-- Should have 4 policies: SELECT, INSERT, UPDATE, DELETE
-- If any are missing, run AUTO_CREATE_PORTFOLIO_AND_FIXES.sql!

-- Check latest prices for products
SELECT 
  p.product,
  p.price,
  p.previous_close,
  p.price_date,
  p.source
FROM prices p
WHERE p.price_date = (SELECT MAX(price_date) FROM prices WHERE product = p.product)
ORDER BY p.product;

-- Find products that should have prices but don't
SELECT DISTINCT
  t.product,
  t.isin,
  CASE 
    WHEN pr.product IS NULL THEN '❌ NO PRICE DATA'
    WHEN pr.price_date < CURRENT_DATE - INTERVAL '7 days' THEN '⚠️ STALE PRICE'
    ELSE '✅ HAS PRICE'
  END as price_status,
  pr.price_date,
  pr.price
FROM transactions t
LEFT JOIN LATERAL (
  SELECT * FROM prices 
  WHERE product = t.product 
  ORDER BY price_date DESC 
  LIMIT 1
) pr ON true
ORDER BY price_status, t.product;

-- Test ticker mapping lookup for specific product
-- Replace 'ASML HOLDING' with your product name
SELECT 
  tm.product_name,
  tm.isin,
  tm.yahoo_symbol,
  tm.is_approved,
  'This should be used by refresh-prices!' as note
FROM ticker_mappings tm
WHERE tm.is_approved = true
  AND (tm.product_name = 'ASML HOLDING' OR tm.isin = 'NL0010273215')
LIMIT 1;
