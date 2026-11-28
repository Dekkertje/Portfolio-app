-- ─── Rondleiding: per account onthouden of die is afgerond ──────────────────
-- NULL = nog niet gezien: de app start de rondleiding automatisch.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- Bestaande gebruikers met data kennen de app al; wie nog nooit iets importeerde
-- krijgt de rondleiding wel.
UPDATE public.profiles p
SET onboarded_at = NOW()
WHERE onboarded_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.portfolios pf
    JOIN public.ledger_events le ON le.portfolio_id = pf.id
    WHERE pf.user_id = p.id
  );
