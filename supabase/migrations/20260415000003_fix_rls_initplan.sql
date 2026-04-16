-- ─── Fix auth_rls_initplan + multiple_permissive_policies ────────────────────
-- Replace auth.uid() with (select auth.uid()) in all RLS policies so Postgres
-- evaluates the function once per query, not once per row.
-- Also removes duplicate policies that trigger multiple_permissive_policies.

-- ── portfolios ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "portfolios_select"                    ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_insert"                    ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_update"                    ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_delete"                    ON public.portfolios;
DROP POLICY IF EXISTS "Users can view their own portfolios"  ON public.portfolios;
DROP POLICY IF EXISTS "Users can create their own portfolio" ON public.portfolios;
DROP POLICY IF EXISTS "Users can update their own portfolio" ON public.portfolios;
DROP POLICY IF EXISTS "Users can delete their own portfolio" ON public.portfolios;
DROP POLICY IF EXISTS "Users can view own portfolio"         ON public.portfolios;
DROP POLICY IF EXISTS "Users can insert own portfolio"       ON public.portfolios;
DROP POLICY IF EXISTS "Users can update own portfolio"       ON public.portfolios;

CREATE POLICY "portfolios_select" ON public.portfolios FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "portfolios_insert" ON public.portfolios FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "portfolios_update" ON public.portfolios FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "portfolios_delete" ON public.portfolios FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── transactions ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own transactions"   ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;

CREATE POLICY "transactions_select" ON public.transactions FOR SELECT TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "transactions_insert" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "transactions_update" ON public.transactions FOR UPDATE TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "transactions_delete" ON public.transactions FOR DELETE TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));

-- ── manual_positions ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own manual positions"   ON public.manual_positions;
DROP POLICY IF EXISTS "Users can insert own manual positions" ON public.manual_positions;
DROP POLICY IF EXISTS "Users can update own manual positions" ON public.manual_positions;
DROP POLICY IF EXISTS "Users can delete own manual positions" ON public.manual_positions;
DROP POLICY IF EXISTS "manual_positions_select"               ON public.manual_positions;
DROP POLICY IF EXISTS "manual_positions_insert"               ON public.manual_positions;
DROP POLICY IF EXISTS "manual_positions_update"               ON public.manual_positions;
DROP POLICY IF EXISTS "manual_positions_delete"               ON public.manual_positions;

CREATE POLICY "manual_positions_select" ON public.manual_positions FOR SELECT TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "manual_positions_insert" ON public.manual_positions FOR INSERT TO authenticated
  WITH CHECK (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "manual_positions_update" ON public.manual_positions FOR UPDATE TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "manual_positions_delete" ON public.manual_positions FOR DELETE TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));

-- ── profiles ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()));

-- ── price_alerts ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own alerts"   ON public.price_alerts;
DROP POLICY IF EXISTS "Users can insert own alerts" ON public.price_alerts;
DROP POLICY IF EXISTS "Users can update own alerts" ON public.price_alerts;
DROP POLICY IF EXISTS "Users can delete own alerts" ON public.price_alerts;

CREATE POLICY "price_alerts_select" ON public.price_alerts FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "price_alerts_insert" ON public.price_alerts FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "price_alerts_update" ON public.price_alerts FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "price_alerts_delete" ON public.price_alerts FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── ticker_mappings ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ticker_mappings_select_all"           ON public.ticker_mappings;
DROP POLICY IF EXISTS "ticker_mappings_insert_authenticated" ON public.ticker_mappings;
DROP POLICY IF EXISTS "ticker_mappings_update_authenticated" ON public.ticker_mappings;
DROP POLICY IF EXISTS "ticker_mappings_insert_own"           ON public.ticker_mappings;
DROP POLICY IF EXISTS "ticker_mappings_update_own"           ON public.ticker_mappings;

CREATE POLICY "ticker_mappings_select" ON public.ticker_mappings FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "ticker_mappings_insert" ON public.ticker_mappings FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "ticker_mappings_update" ON public.ticker_mappings FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- ── fx_rates ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read fx_rates" ON public.fx_rates;

CREATE POLICY "fx_rates_select" ON public.fx_rates FOR SELECT TO authenticated
  USING (true);

-- ── cash_positions ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cash_positions_select" ON public.cash_positions;
DROP POLICY IF EXISTS "cash_positions_insert" ON public.cash_positions;
DROP POLICY IF EXISTS "cash_positions_update" ON public.cash_positions;
DROP POLICY IF EXISTS "cash_positions_delete" ON public.cash_positions;

CREATE POLICY "cash_positions_select" ON public.cash_positions FOR SELECT TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "cash_positions_insert" ON public.cash_positions FOR INSERT TO authenticated
  WITH CHECK (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "cash_positions_update" ON public.cash_positions FOR UPDATE TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "cash_positions_delete" ON public.cash_positions FOR DELETE TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));

-- ── portfolio_snapshots ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "snapshots_select_own" ON public.portfolio_snapshots;
DROP POLICY IF EXISTS "snapshots_insert_own" ON public.portfolio_snapshots;
DROP POLICY IF EXISTS "snapshots_update_own" ON public.portfolio_snapshots;

CREATE POLICY "snapshots_select" ON public.portfolio_snapshots FOR SELECT TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "snapshots_insert" ON public.portfolio_snapshots FOR INSERT TO authenticated
  WITH CHECK (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "snapshots_update" ON public.portfolio_snapshots FOR UPDATE TO authenticated
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid())));

-- ── positions ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "positions_select_own"            ON public.positions;
DROP POLICY IF EXISTS "positions_select_authenticated"  ON public.positions;

CREATE POLICY "positions_select" ON public.positions FOR SELECT TO authenticated
  USING (
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'positions' AND column_name = 'portfolio_id'
      )
      THEN portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = (SELECT auth.uid()))
      ELSE true
    END
  );
