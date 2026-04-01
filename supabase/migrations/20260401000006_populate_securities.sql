-- Populate securities database with common stocks and ETFs
-- This provides fallback data for fuzzy matching
-- Note: pg_trgm extension is already enabled in migration 0005

-- US Tech Giants
INSERT INTO securities (isin, name, alternative_names, ticker_symbol, yahoo_symbol, exchange, currency, security_type, sector, region) VALUES
('US02079K3059', 'Alphabet Inc Class A', ARRAY['Google', 'GOOGL', 'Alphabet'], 'GOOGL', 'GOOGL', 'NASDAQ', 'USD', 'STOCK', 'Technology', 'US'),
('US0378331005', 'Apple Inc', ARRAY['Apple', 'AAPL'], 'AAPL', 'AAPL', 'NASDAQ', 'USD', 'STOCK', 'Technology', 'US'),
('US5949181045', 'Microsoft Corp', ARRAY['Microsoft', 'MSFT'], 'MSFT', 'MSFT', 'NASDAQ', 'USD', 'STOCK', 'Technology', 'US'),
('US30303M1027', 'Meta Platforms Inc Class A', ARRAY['Facebook', 'Meta', 'FB', 'META'], 'META', 'META', 'NASDAQ', 'USD', 'STOCK', 'Technology', 'US'),
('US0231351067', 'Amazon.com Inc', ARRAY['Amazon', 'AMZN'], 'AMZN', 'AMZN', 'NASDAQ', 'USD', 'STOCK', 'Consumer Cyclical', 'US'),
('US64110L1061', 'Netflix Inc', ARRAY['Netflix', 'NFLX'], 'NFLX', 'NFLX', 'NASDAQ', 'USD', 'STOCK', 'Communication Services', 'US')
ON CONFLICT (isin) DO NOTHING;

-- Semiconductors
INSERT INTO securities (isin, name, alternative_names, ticker_symbol, yahoo_symbol, exchange, currency, security_type, sector, region) VALUES
('NL0010273215', 'ASML Holding NV', ARRAY['ASML', 'ASML Holding'], 'ASML', 'ASML.AS', 'EURONEXT', 'EUR', 'STOCK', 'Technology', 'Europe'),
('US67066G1040', 'NVIDIA Corp', ARRAY['Nvidia', 'NVDA'], 'NVDA', 'NVDA', 'NASDAQ', 'USD', 'STOCK', 'Technology', 'US'),
('US4581401001', 'Intel Corp', ARRAY['Intel', 'INTC'], 'INTC', 'INTC', 'NASDAQ', 'USD', 'STOCK', 'Technology', 'US'),
('US0079031078', 'Advanced Micro Devices', ARRAY['AMD'], 'AMD', 'AMD', 'NASDAQ', 'USD', 'STOCK', 'Technology', 'US'),
('US56585A1025', 'Marvell Technology Inc', ARRAY['Marvell', 'MRVL'], 'MRVL', 'MRVL', 'NASDAQ', 'USD', 'STOCK', 'Technology', 'US')
ON CONFLICT (isin) DO NOTHING;

-- Software & Cloud
INSERT INTO securities (isin, name, alternative_names, ticker_symbol, yahoo_symbol, exchange, currency, security_type, sector, region) VALUES
('US79466L3024', 'Salesforce Inc', ARRAY['Salesforce', 'CRM'], 'CRM', 'CRM', 'NYSE', 'USD', 'STOCK', 'Technology', 'US'),
('US68389X1054', 'Oracle Corp', ARRAY['Oracle', 'ORCL'], 'ORCL', 'ORCL', 'NYSE', 'USD', 'STOCK', 'Technology', 'US'),
('US8334451098', 'SoFi Technologies Inc', ARRAY['SoFi', 'SOFI'], 'SOFI', 'SOFI', 'NASDAQ', 'USD', 'STOCK', 'Financial Services', 'US'),
('US69608A1088', 'Palantir Technologies Inc', ARRAY['Palantir', 'PLTR'], 'PLTR', 'PLTR', 'NYSE', 'USD', 'STOCK', 'Technology', 'US')
ON CONFLICT (isin) DO NOTHING;

-- Payments & Fintech
INSERT INTO securities (isin, name, alternative_names, ticker_symbol, yahoo_symbol, exchange, currency, security_type, sector, region) VALUES
('US92826C8394', 'Visa Inc Class A', ARRAY['Visa', 'V'], 'V', 'V', 'NYSE', 'USD', 'STOCK', 'Financial Services', 'US'),
('US57636Q1040', 'Mastercard Inc Class A', ARRAY['Mastercard', 'MA'], 'MA', 'MA', 'NYSE', 'USD', 'STOCK', 'Financial Services', 'US'),
('US6701002056', 'Nu Holdings Ltd Class A', ARRAY['Nubank', 'Nu', 'NU'], 'NU', 'NU', 'NYSE', 'USD', 'STOCK', 'Financial Services', 'US')
ON CONFLICT (isin) DO NOTHING;

-- Other Tech
INSERT INTO securities (isin, name, alternative_names, ticker_symbol, yahoo_symbol, exchange, currency, security_type, sector, region) VALUES
('US11135F1012', 'Broadcom Inc', ARRAY['Broadcom', 'AVGO'], 'AVGO', 'AVGO', 'NASDAQ', 'USD', 'STOCK', 'Technology', 'US'),
('US17275R1023', 'Cisco Systems Inc', ARRAY['Cisco', 'CSCO'], 'CSCO', 'CSCO', 'NASDAQ', 'USD', 'STOCK', 'Technology', 'US'),
('US0846707026', 'Berkshire Hathaway Inc Class B', ARRAY['Berkshire', 'BRK.B', 'Buffett'], 'BRK.B', 'BRK.B', 'NYSE', 'USD', 'STOCK', 'Financial Services', 'US')
ON CONFLICT (isin) DO NOTHING;

-- Crowdstrike
INSERT INTO securities (isin, name, alternative_names, ticker_symbol, yahoo_symbol, exchange, currency, security_type, sector, region) VALUES
('US23804L1035', 'CrowdStrike Holdings Inc Class A', ARRAY['Crowdstrike', 'CRWD'], 'CRWD', 'CRWD', 'NASDAQ', 'USD', 'STOCK', 'Technology', 'US')
ON CONFLICT (isin) DO NOTHING;

-- ETFs - Nasdaq 100
INSERT INTO securities (isin, name, alternative_names, ticker_symbol, yahoo_symbol, exchange, currency, security_type, sector, region) VALUES
('IE0032077012', 'Invesco EQQQ NASDAQ-100 UCITS ETF Dist', ARRAY['EQQQ', 'Invesco EQQQ', 'Invesco Nasdaq', 'EQQQ Nasdaq'], 'EQQQ', 'EQQQ.DE', 'XETRA', 'EUR', 'ETF', NULL, 'Europe'),
('US46090E1038', 'Invesco QQQ Trust', ARRAY['QQQ', 'Invesco QQQ'], 'QQQ', 'QQQ', 'NASDAQ', 'USD', 'ETF', NULL, 'US')
ON CONFLICT (isin) DO NOTHING;

-- ETFs - S&P 500
INSERT INTO securities (isin, name, alternative_names, ticker_symbol, yahoo_symbol, exchange, currency, security_type, sector, region) VALUES
('IE00B3XXRP09', 'Vanguard S&P 500 UCITS ETF USD Dis', ARRAY['VUSA', 'Vanguard S&P 500', 'Vanguard SP500'], 'VUSA', 'VUSA.AS', 'EURONEXT', 'EUR', 'ETF', NULL, 'Europe'),
('IE00B5BMR087', 'iShares Core S&P 500 UCITS ETF', ARRAY['CSPX', 'iShares S&P 500', 'iShares SP500'], 'CSPX', 'CSPX.DE', 'XETRA', 'EUR', 'ETF', NULL, 'Europe'),
('US78462F1030', 'SPDR S&P 500 ETF Trust', ARRAY['SPY', 'S&P 500 ETF'], 'SPY', 'SPY', 'NYSE', 'USD', 'ETF', NULL, 'US')
ON CONFLICT (isin) DO NOTHING;

-- ETFs - Other Popular
INSERT INTO securities (isin, name, alternative_names, ticker_symbol, yahoo_symbol, exchange, currency, security_type, sector, region) VALUES
('IE00B4L5Y983', 'iShares Core MSCI World UCITS ETF', ARRAY['IWDA', 'iShares World', 'MSCI World'], 'IWDA', 'IWDA.AS', 'EURONEXT', 'EUR', 'ETF', NULL, 'Europe'),
('IE00BK5BQT80', 'Vanguard FTSE All-World UCITS ETF', ARRAY['VWRL', 'Vanguard All-World'], 'VWRL', 'VWRL.AS', 'EURONEXT', 'EUR', 'ETF', NULL, 'Europe')
ON CONFLICT (isin) DO NOTHING;

