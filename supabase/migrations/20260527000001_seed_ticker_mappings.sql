-- ─── Seed common ticker mappings for stocks Yahoo Finance finds via ISIN ───────
-- These are stocks that DEGIRO users commonly import where the fuzzy name
-- matcher fails or the ISIN is not in the securities reference table.
-- is_approved = true means the matching engine treats these as manual overrides.

INSERT INTO public.ticker_mappings (isin, product_name, yahoo_symbol, suggested_ticker, match_method, is_approved)
VALUES
  -- Take-Two Interactive Software (both casing variants DEGIRO uses)
  ('US8740541094', 'TAKE-TWO INTERACTIVE SOFTWARE', 'TTWO', 'TTWO', 'seed', true),
  ('US8740541094', 'Take-Two Interactive',          'TTWO', 'TTWO', 'seed', true),
  ('US8740541094', 'TAKE-TWO INTERACTIVE',          'TTWO', 'TTWO', 'seed', true),
  -- Electronic Arts
  ('US2855121099', 'ELECTRONIC ARTS INC',           'EA',   'EA',   'seed', true),
  -- Roblox
  ('US7710491033', 'ROBLOX CORP-A',                 'RBLX', 'RBLX', 'seed', true),
  -- Palantir Technologies
  ('US69608A1088', 'PALANTIR TECHNOLOGIES-A',       'PLTR', 'PLTR', 'seed', true)
ON CONFLICT (isin, product_name) DO UPDATE
  SET yahoo_symbol     = EXCLUDED.yahoo_symbol,
      suggested_ticker = EXCLUDED.suggested_ticker,
      is_approved      = true;
