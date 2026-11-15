-- ─── Marktdata voor één portfolio in één call ─────────────────────────────────
-- Dagkoersen van alle instrumenten in het grootboek + FX-koersen naar EUR, vanaf
-- het eerste event. Eén JSON-waarde, zodat de 1000-rijenlimiet van PostgREST niet
-- speelt. SECURITY INVOKER: RLS op ledger_events bepaalt of je het portfolio mag zien.
--
-- Vorm: { "prices": [[instrument_id, "YYYY-MM-DD", close, currency], ...],
--         "fx":     [[currency, "YYYY-MM-DD", eur_per_unit], ...] }

CREATE OR REPLACE FUNCTION public.portfolio_market_data(p_portfolio_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH holdings AS (
    SELECT instrument_id, MIN(event_date) AS first_date
    FROM ledger_events
    WHERE portfolio_id = p_portfolio_id AND instrument_id IS NOT NULL
    GROUP BY instrument_id
  ),
  -- een week extra vóór het eerste event, zodat er altijd een koers is om terug te vallen
  bounds AS (SELECT MIN(first_date) - 7 AS since FROM holdings)
  SELECT json_build_object(
    'prices', COALESCE((
      SELECT json_agg(json_build_array(d.instrument_id, d.price_date, d.close, d.currency) ORDER BY d.instrument_id, d.price_date)
      FROM daily_prices d
      JOIN holdings h ON h.instrument_id = d.instrument_id
      WHERE d.price_date >= h.first_date - 7
    ), '[]'::json),
    'fx', COALESCE((
      SELECT json_agg(json_build_array(f.base_currency, f.rate_date, f.rate) ORDER BY f.base_currency, f.rate_date)
      FROM fx_rates f, bounds b
      WHERE f.quote_currency = 'EUR' AND f.rate_date >= b.since
    ), '[]'::json)
  );
$$;

GRANT EXECUTE ON FUNCTION public.portfolio_market_data(UUID) TO authenticated;
