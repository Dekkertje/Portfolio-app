-- ─── v2: grootboek-model ──────────────────────────────────────────────────────
-- Nieuwe basis naast de bestaande tabellen (transactions, prices, manual_positions,
-- cash_positions blijven voorlopig staan zodat de huidige app blijft werken).
--
--   instruments    — één rij per effect, sleutel = ISIN (gedeelde referentiedata)
--   import_batches — elke import, met waarschuwingen
--   ledger_events  — alles wat er op de rekening gebeurt (zie lib/core/types.ts)
--   daily_prices   — ongecorrigeerde slotkoersen per instrument per dag
--   latest_quotes  — actuele koers + vorige slot per instrument
--
-- Wisselkoersen per dag staan al in public.fx_rates.

-- ── instruments ───────────────────────────────────────────────────────────────
-- Er bestond al een ongebruikte, lege legacy-tabel "instruments" (symbol/name/isin/...),
-- buiten de migraties om aangemaakt. Vervangen — maar alleen als hij echt leeg is.
DO $$
BEGIN
  IF to_regclass('public.instruments') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'instruments' AND column_name = 'symbol_status') THEN
    IF EXISTS (SELECT 1 FROM public.instruments) THEN
      RAISE EXCEPTION 'Legacy-tabel public.instruments bevat data; eerst handmatig nakijken';
    END IF;
    DROP TABLE public.instruments;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.instruments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  isin             TEXT        NOT NULL UNIQUE,
  name             TEXT        NOT NULL,
  kind             TEXT        NOT NULL DEFAULT 'stock'
                     CHECK (kind IN ('stock', 'etf', 'fund', 'crypto', 'bond', 'other')),
  currency         TEXT        NOT NULL,                 -- noteringsvaluta
  exchange         TEXT,                                 -- beurscode van de broker (TDG, EAM, NDQ, ...)
  yahoo_symbol     TEXT,
  symbol_status    TEXT        NOT NULL DEFAULT 'unmatched'
                     CHECK (symbol_status IN ('unmatched', 'suggested', 'approved')),
  match_confidence NUMERIC(3, 2),
  match_method     TEXT,
  sector           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── import_batches ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.import_batches (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id   UUID        NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  source         TEXT        NOT NULL CHECK (source IN ('degiro', 'manual', 'migration')),
  file_names     TEXT[]      NOT NULL DEFAULT '{}',
  event_count    INTEGER     NOT NULL DEFAULT 0,          -- events in de bestanden
  inserted_count INTEGER     NOT NULL DEFAULT 0,          -- waarvan nieuw
  warnings       JSONB       NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_portfolio ON public.import_batches (portfolio_id, created_at DESC);

-- ── ledger_events ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ledger_events (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id    UUID           NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  -- Deterministische id uit de importer (of 'manual:<uuid>'); maakt herimport idempotent
  external_id     TEXT           NOT NULL,
  import_batch_id UUID           REFERENCES public.import_batches(id) ON DELETE SET NULL,
  event_date      DATE           NOT NULL,
  event_type      TEXT           NOT NULL CHECK (event_type IN (
                    'buy', 'sell', 'dividend', 'dividend_tax', 'fee',
                    'interest', 'deposit', 'withdrawal', 'split')),
  instrument_id   UUID           REFERENCES public.instruments(id),
  quantity        NUMERIC(20, 8) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  price           NUMERIC(20, 8),
  currency        TEXT           NOT NULL DEFAULT 'EUR',
  amount_eur      NUMERIC(14, 2) NOT NULL,                -- cash-effect met teken
  fee_eur         NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (fee_eur >= 0),
  split_ratio     NUMERIC(20, 10),
  note            TEXT,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT ledger_events_unique_external UNIQUE (portfolio_id, external_id),
  CONSTRAINT ledger_events_instrument_required
    CHECK (event_type NOT IN ('buy', 'sell', 'split') OR instrument_id IS NOT NULL),
  CONSTRAINT ledger_events_split_ratio
    CHECK (event_type <> 'split' OR split_ratio > 0)
);

CREATE INDEX IF NOT EXISTS idx_ledger_events_portfolio_date ON public.ledger_events (portfolio_id, event_date);
CREATE INDEX IF NOT EXISTS idx_ledger_events_instrument     ON public.ledger_events (instrument_id);
CREATE INDEX IF NOT EXISTS idx_ledger_events_batch          ON public.ledger_events (import_batch_id);

-- ── daily_prices ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_prices (
  instrument_id UUID           NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  price_date    DATE           NOT NULL,
  close         NUMERIC(20, 6) NOT NULL,                  -- ongecorrigeerd (géén adjclose)
  currency      TEXT           NOT NULL,
  source        TEXT           NOT NULL DEFAULT 'yahoo',
  fetched_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  PRIMARY KEY (instrument_id, price_date)
);

-- ── latest_quotes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.latest_quotes (
  instrument_id  UUID           PRIMARY KEY REFERENCES public.instruments(id) ON DELETE CASCADE,
  price          NUMERIC(20, 6) NOT NULL,
  previous_close NUMERIC(20, 6),
  currency       TEXT           NOT NULL,
  market_state   TEXT,                                    -- REGULAR, CLOSED, PRE, POST
  quoted_at      TIMESTAMPTZ    NOT NULL,
  source         TEXT           NOT NULL DEFAULT 'yahoo',
  fetched_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Referentiedata (instruments, koersen) is leesbaar voor ingelogde gebruikers en
-- wordt alleen server-side met de service role geschreven.

ALTER TABLE public.instruments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_prices   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.latest_quotes  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instruments_select"   ON public.instruments   FOR SELECT TO authenticated USING (true);
CREATE POLICY "daily_prices_select"  ON public.daily_prices  FOR SELECT TO authenticated USING (true);
CREATE POLICY "latest_quotes_select" ON public.latest_quotes FOR SELECT TO authenticated USING (true);

CREATE POLICY "import_batches_select" ON public.import_batches FOR SELECT TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "import_batches_insert" ON public.import_batches FOR INSERT TO authenticated
  WITH CHECK (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "import_batches_delete" ON public.import_batches FOR DELETE TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "ledger_events_select" ON public.ledger_events FOR SELECT TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "ledger_events_insert" ON public.ledger_events FOR INSERT TO authenticated
  WITH CHECK (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "ledger_events_update" ON public.ledger_events FOR UPDATE TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "ledger_events_delete" ON public.ledger_events FOR DELETE TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
