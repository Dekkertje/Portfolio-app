-- ============================================================================
-- DEBUG TRANSACTIONS - Find exact product names
-- Run this in Supabase SQL Editor to see what's in your database
-- ============================================================================

-- Get your portfolio ID first
SELECT 
  u.email,
  p.id as portfolio_id,
  p.name
FROM auth.users u
JOIN portfolios p ON p.user_id = u.id
WHERE u.email LIKE '%carel%' OR u.email LIKE '%@%'
ORDER BY p.created_at DESC
LIMIT 5;

-- Copy the portfolio_id from above and paste it below:
-- Replace 'YOUR_PORTFOLIO_ID' with actual UUID

-- Show ALL products in portfolio with their exact names
SELECT DISTINCT
  product,
  isin,
  COUNT(*) as transaction_count,
  STRING_AGG(DISTINCT transaction_type, ', ') as transaction_types
FROM transactions
WHERE portfolio_id = 'bfb04203-72a1-4da3-8a2b-d04744ecc758'  -- ← Your portfolio ID
GROUP BY product, isin
ORDER BY product;

-- Search for "Silver" specifically
SELECT 
  id,
  product,
  isin,
  transaction_type,
  quantity,
  trade_date,
  total_eur
FROM transactions
WHERE portfolio_id = 'bfb04203-72a1-4da3-8a2b-d04744ecc758'
  AND product ILIKE '%silver%'
ORDER BY trade_date DESC;

-- Search for "Hyatt" specifically
SELECT 
  id,
  product,
  isin,
  transaction_type,
  quantity,
  trade_date,
  total_eur
FROM transactions
WHERE portfolio_id = 'bfb04203-72a1-4da3-8a2b-d04744ecc758'
  AND product ILIKE '%hyatt%'
ORDER BY trade_date DESC;

-- Search for "Sentinel" specifically
SELECT 
  id,
  product,
  isin,
  transaction_type,
  quantity,
  trade_date,
  total_eur
FROM transactions
WHERE portfolio_id = 'bfb04203-72a1-4da3-8a2b-d04744ecc758'
  AND product ILIKE '%sentinel%'
ORDER BY trade_date DESC;

-- Check for products with short ISINs (potential tickers)
SELECT 
  product,
  isin,
  LENGTH(isin) as isin_length,
  COUNT(*) as count
FROM transactions
WHERE portfolio_id = 'bfb04203-72a1-4da3-8a2b-d04744ecc758'
  AND LENGTH(isin) < 10
GROUP BY product, isin
ORDER BY isin_length, product;
