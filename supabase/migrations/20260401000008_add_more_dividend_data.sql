-- Add dividend and earnings data for remaining securities

-- More US Tech stocks with dividends
UPDATE securities SET annual_dividend = 0.78, dividend_frequency = 'quarterly', next_earnings_date = '2026-05-06' WHERE isin = 'US11135F1012'; -- Broadcom
UPDATE securities SET annual_dividend = 1.64, dividend_frequency = 'quarterly', next_earnings_date = '2026-05-13' WHERE isin = 'US17275R1023'; -- Cisco
UPDATE securities SET annual_dividend = 0.40, dividend_frequency = 'quarterly', next_earnings_date = '2026-05-08' WHERE isin = 'US68389X1054'; -- Oracle

-- Payments & Fintech
UPDATE securities SET annual_dividend = 2.08, dividend_frequency = 'quarterly', next_earnings_date = '2026-04-29' WHERE isin = 'US92826C8394'; -- Visa
UPDATE securities SET annual_dividend = 2.64, dividend_frequency = 'quarterly', next_earnings_date = '2026-04-30' WHERE isin = 'US57636Q1040'; -- Mastercard
UPDATE securities SET annual_dividend = 0, dividend_frequency = 'none', next_earnings_date = '2026-05-14' WHERE isin = 'US6701002056'; -- Nu Holdings

-- Semiconductors
UPDATE securities SET annual_dividend = 0.16, dividend_frequency = 'quarterly', next_earnings_date = '2026-05-21' WHERE isin = 'US0079031078'; -- AMD
UPDATE securities SET annual_dividend = 0, dividend_frequency = 'none', next_earnings_date = '2026-05-28' WHERE isin = 'US56585A1025'; -- Marvell

-- Other stocks
UPDATE securities SET annual_dividend = 0, dividend_frequency = 'none', next_earnings_date = '2026-04-17' WHERE isin = 'US64110L1061'; -- Netflix
UPDATE securities SET annual_dividend = 0, dividend_frequency = 'none', next_earnings_date = '2026-04-25' WHERE isin = 'US79466L3024'; -- Salesforce

-- Berkshire Hathaway (B shares don't pay dividend)
UPDATE securities SET annual_dividend = 0, dividend_frequency = 'none', next_earnings_date = '2026-05-03' WHERE isin = 'US0846707026'; -- Berkshire Hathaway B

-- ETFs with dividends
UPDATE securities SET annual_dividend = 2.05, dividend_frequency = 'quarterly', next_earnings_date = NULL WHERE isin = 'US46090E1038'; -- Invesco QQQ
UPDATE securities SET annual_dividend = 6.85, dividend_frequency = 'quarterly', next_earnings_date = NULL WHERE isin = 'IE00B3XXRP09'; -- Vanguard S&P 500 (VUSA)
UPDATE securities SET annual_dividend = 6.92, dividend_frequency = 'quarterly', next_earnings_date = NULL WHERE isin = 'IE00B5BMR087'; -- iShares Core S&P 500 (CSPX)
UPDATE securities SET annual_dividend = 6.35, dividend_frequency = 'quarterly', next_earnings_date = NULL WHERE isin = 'US78462F1030'; -- SPY
UPDATE securities SET annual_dividend = 5.45, dividend_frequency = 'annual', next_earnings_date = NULL WHERE isin = 'IE00B4L5Y983'; -- iShares Core MSCI World (IWDA)
UPDATE securities SET annual_dividend = 5.12, dividend_frequency = 'quarterly', next_earnings_date = NULL WHERE isin = 'IE00BK5BQT80'; -- Vanguard FTSE All-World (VWRL)

