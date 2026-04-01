-- Clean up old alphavantage price data to force refresh from Yahoo Finance
-- This will remove stale data and allow the refresh-prices API to fetch fresh data

-- Delete old Invesco EQQQ prices (these were in pence/wrong source)
DELETE FROM prices 
WHERE product LIKE '%INVESCO EQQQ%' 
  AND (source = 'alphavantage' OR source IS NULL)
  AND price_date >= '2026-04-01';

-- Optional: Delete all alphavantage source prices from today if you want to force a full refresh
-- Uncomment the line below if needed:
-- DELETE FROM prices WHERE source = 'alphavantage' AND price_date >= '2026-04-01';

