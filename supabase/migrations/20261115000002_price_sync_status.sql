-- ─── Koers-synchronisatie: welke instrumenten, vanaf wanneer ─────────────────
-- Eén rij per instrument met Yahoo-symbool dat in een grootboek voorkomt.
-- security_invoker: gewone gebruikers zien via RLS alleen hun eigen events;
-- de cronjob leest met de service role.

CREATE OR REPLACE VIEW public.price_sync_status
WITH (security_invoker = true) AS
SELECT
  i.id              AS instrument_id,
  i.yahoo_symbol,
  MIN(e.event_date) AS first_event_date,
  MAX(e.event_date) AS last_event_date,
  (SELECT MAX(d.price_date) FROM public.daily_prices d WHERE d.instrument_id = i.id) AS last_price_date
FROM public.instruments i
JOIN public.ledger_events e ON e.instrument_id = i.id
WHERE i.yahoo_symbol IS NOT NULL
GROUP BY i.id, i.yahoo_symbol;
