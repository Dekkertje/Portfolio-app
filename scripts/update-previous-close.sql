-- Update previous_close values based on DEGIRO data
-- Date: 2026-04-01
-- These values are calculated from DEGIRO's W/V (Winst/Verlies) data

-- ASML: Current €1187.60, W/V +€957.60 for 14 shares
-- Previous Close = €1187.60 - (€957.60 / 14) = €1187.60 - €68.40 = €1119.20
UPDATE prices 
SET previous_close = 1119.20 
WHERE product = 'ASML HOLDING NV' AND price_date = '2026-04-01';

-- NVIDIA: Current €152.12, W/V +€78.00 for 65 shares  
-- Previous Close = €152.12 - (€78.00 / 65) = €152.12 - €1.20 = €150.92
UPDATE prices 
SET previous_close = 150.92 
WHERE product = 'NVIDIA CORP' AND price_date = '2026-04-01';

-- Alphabet: Current €258.80, W/V +€148.60 for 15 shares
-- Previous Close = €258.80 - (€148.60 / 15) = €258.80 - €9.91 = €248.89
UPDATE prices 
SET previous_close = 248.89 
WHERE product = 'ALPHABET INC CLASS A' AND price_date = '2026-04-01';

-- Meta: Current €507.90, W/V +€65.75 for 5 shares
-- Previous Close = €507.90 - (€65.75 / 5) = €507.90 - €13.15 = €494.75
UPDATE prices 
SET previous_close = 494.75 
WHERE product = 'META PLATFORMS INC CLASS A' AND price_date = '2026-04-01';

-- Netflix: Current €82.58, W/V -€15.00 for 25 shares
-- Previous Close = €82.58 - (-€15.00 / 25) = €82.58 + €0.60 = €83.18
UPDATE prices 
SET previous_close = 83.18 
WHERE product = 'NETFLIX INC' AND price_date = '2026-04-01';

-- CrowdStrike: Current €339.10, W/V +€8.10 for 6 shares
-- Previous Close = €339.10 - (€8.10 / 6) = €339.10 - €1.35 = €337.75
UPDATE prices 
SET previous_close = 337.75 
WHERE product = 'CROWDSTRIKE HOLDINGS INC CLASS A' AND price_date = '2026-04-01';

-- SoFi: Current €13.65, W/V -€10.20 for 100 shares
-- Previous Close = €13.65 - (-€10.20 / 100) = €13.65 + €0.102 = €13.752
UPDATE prices 
SET previous_close = 13.75 
WHERE product = 'SOFI TECHNOLOGIES INC' AND price_date = '2026-04-01';

-- Marvell: Current €92.34, W/V +€97.54 for 14 shares
-- Previous Close = €92.34 - (€97.54 / 14) = €92.34 - €6.97 = €85.37
UPDATE prices 
SET previous_close = 85.37 
WHERE product = 'MARVELL TECHNOLOGY INC' AND price_date = '2026-04-01';

-- Salesforce: Current $186.25, W/V -€8.15 for 8 shares
-- This is tricky - W/V is in EUR but price is in USD
-- From screenshot: need to check current EUR price
-- Let me skip this for now until we have the correct EUR price

-- MongoDB: Current $259.09, W/V +€27.24 for 5 shares
-- Same issue - need EUR price

-- Oracle: Current €124.16, W/V -€8.40 for 7 shares
-- Previous Close = €124.16 - (-€8.40 / 7) = €124.16 + €1.20 = €125.36
UPDATE prices 
SET previous_close = 125.36 
WHERE product = 'ORACLE CORP' AND price_date = '2026-04-01';

-- ABN AMRO: Current €28.11, W/V +€75.57 for 62.5 shares (need to verify qty)
-- Need to check the exact quantity from DEGIRO

-- ING: Current €23.23, W/V +€81.55 for 62.5 shares (need to verify qty)
-- Need to check the exact quantity from DEGIRO

-- ASR: Current €60.72, W/V +€153.50 for 62.5 shares (need to verify qty)
-- Need to check the exact quantity from DEGIRO

-- Intel: Previous close seems OK from Yahoo
-- AMD: Previous close seems OK from Yahoo
-- Palantir: Previous close seems OK from Yahoo

-- ETFs
-- Invesco EQQQ: Current €908.90, W/V +€108.80 for 16 shares
-- Previous Close = €908.90 - (€108.80 / 16) = €908.90 - €6.80 = €902.10
UPDATE prices 
SET previous_close = 902.10 
WHERE product = 'INVESCO EQQQ NASDAQ-100 UCITS ETF DIST' AND price_date = '2026-04-01';

-- Vanguard S&P 500: Current €107.601, W/V +€67.76 for 39 shares
-- Previous Close = €107.601 - (€67.76 / 39) = €107.601 - €1.738 = €105.863
UPDATE prices 
SET previous_close = 105.86 
WHERE product = 'VANGUARD S&P 500 UCITS ETF USD DIS' AND price_date = '2026-04-01';

