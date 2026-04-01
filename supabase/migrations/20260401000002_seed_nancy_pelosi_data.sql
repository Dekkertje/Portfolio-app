-- Insert Nancy Pelosi
INSERT INTO politicians (id, first_name, last_name, full_name, party, chamber, state, district, bio)
VALUES (
  'pelosi-nancy',
  'Nancy',
  'Pelosi',
  'Nancy Pelosi',
  'democrat',
  'house',
  'California',
  '11',
  'Former Speaker of the House and Representative for California''s 11th congressional district. Known for significant stock trading activity, particularly in technology stocks.'
);

-- Insert some high-profile recent trades for Nancy Pelosi
-- Note: These are example trades based on publicly reported activity

-- NVIDIA trades (very profitable)
INSERT INTO politician_trades (politician_id, ticker, asset_description, transaction_type, transaction_date, disclosure_date, amount_min, amount_max, amount_display, price_at_transaction)
VALUES
('pelosi-nancy', 'NVDA', 'NVIDIA Corporation - Common Stock', 'purchase', '2024-11-22', '2024-12-15', 1000000, 5000000, '$1,000,001 - $5,000,000', 140.50),
('pelosi-nancy', 'NVDA', 'NVIDIA Corporation - Common Stock', 'sale', '2025-02-10', '2025-02-28', 1000000, 5000000, '$1,000,001 - $5,000,000', 152.12);

-- Alphabet/Google trades
INSERT INTO politician_trades (politician_id, ticker, asset_description, transaction_type, transaction_date, disclosure_date, amount_min, amount_max, amount_display, price_at_transaction)
VALUES
('pelosi-nancy', 'GOOGL', 'Alphabet Inc - Class A Common Stock', 'purchase', '2024-12-05', '2024-12-20', 500000, 1000000, '$500,001 - $1,000,000', 165.20),
('pelosi-nancy', 'GOOGL', 'Alphabet Inc - Class A Common Stock', 'purchase', '2025-01-15', '2025-02-05', 250000, 500000, '$250,001 - $500,000', 171.80);

-- Microsoft trades
INSERT INTO politician_trades (politician_id, ticker, asset_description, transaction_type, transaction_date, disclosure_date, amount_min, amount_max, amount_display, price_at_transaction)
VALUES
('pelosi-nancy', 'MSFT', 'Microsoft Corporation - Common Stock', 'purchase', '2024-10-10', '2024-11-01', 1000000, 5000000, '$1,000,001 - $5,000,000', 415.30);

-- Tesla trades
INSERT INTO politician_trades (politician_id, ticker, asset_description, transaction_type, transaction_date, disclosure_date, amount_min, amount_max, amount_display, price_at_transaction)
VALUES
('pelosi-nancy', 'TSLA', 'Tesla Inc - Common Stock', 'sale', '2025-01-20', '2025-02-10', 500000, 1000000, '$500,001 - $1,000,000', 385.00),
('pelosi-nancy', 'TSLA', 'Tesla Inc - Common Stock', 'purchase', '2024-11-15', '2024-12-05', 250000, 500000, '$250,001 - $500,000', 340.20);

-- Apple trades
INSERT INTO politician_trades (politician_id, ticker, asset_description, transaction_type, transaction_date, disclosure_date, amount_min, amount_max, amount_display, price_at_transaction)
VALUES
('pelosi-nancy', 'AAPL', 'Apple Inc - Common Stock', 'purchase', '2024-09-25', '2024-10-15', 500000, 1000000, '$500,001 - $1,000,000', 225.50);

-- Meta trades
INSERT INTO politician_trades (politician_id, ticker, asset_description, transaction_type, transaction_date, disclosure_date, amount_min, amount_max, amount_display, price_at_transaction)
VALUES
('pelosi-nancy', 'META', 'Meta Platforms Inc - Class A Common Stock', 'purchase', '2024-12-12', '2025-01-05', 1000000, 5000000, '$1,000,001 - $5,000,000', 480.00);

-- Palantir trades  
INSERT INTO politician_trades (politician_id, ticker, asset_description, transaction_type, transaction_date, disclosure_date, amount_min, amount_max, amount_display, price_at_transaction)
VALUES
('pelosi-nancy', 'PLTR', 'Palantir Technologies Inc - Class A Common Stock', 'purchase', '2024-08-15', '2024-09-10', 100000, 250000, '$100,001 - $250,000', 28.50);

-- Current holdings (estimated based on trades)
INSERT INTO politician_holdings (politician_id, ticker, asset_description, shares, average_cost, last_updated)
VALUES
('pelosi-nancy', 'NVDA', 'NVIDIA Corporation', 25000, 145.00, '2026-04-01'),
('pelosi-nancy', 'GOOGL', 'Alphabet Inc - Class A', 15000, 168.50, '2026-04-01'),
('pelosi-nancy', 'MSFT', 'Microsoft Corporation', 10000, 415.30, '2026-04-01'),
('pelosi-nancy', 'AAPL', 'Apple Inc', 18000, 225.50, '2026-04-01'),
('pelosi-nancy', 'META', 'Meta Platforms Inc', 7500, 480.00, '2026-04-01'),
('pelosi-nancy', 'PLTR', 'Palantir Technologies Inc', 35000, 28.50, '2026-04-01'),
('pelosi-nancy', 'TSLA', 'Tesla Inc', 5000, 340.20, '2026-04-01');

