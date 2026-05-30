-- ─── Fix duplicate portfolios ────────────────────────────────────────────────
-- Every user should have exactly one portfolio. Due to a bug where .single()
-- errored on multiple rows and silently created another portfolio on each
-- import attempt, some users accumulated dozens of empty duplicate portfolios.
--
-- This migration:
--   1. Moves all transactions to the oldest portfolio per user
--   2. Moves all manual_positions, cash_positions, portfolio_snapshots likewise
--   3. Deletes the duplicate portfolios
--   4. Adds a UNIQUE constraint to prevent recurrence

-- ── Step 1: Consolidate transactions ──────────────────────────────────────────
-- Join portfolios into the FROM clause so we can map each transaction's
-- current portfolio to the user's oldest portfolio without self-referencing.
UPDATE transactions
SET portfolio_id = oldest.id
FROM portfolios p
JOIN (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM portfolios
  ORDER BY user_id, created_at ASC
) oldest ON oldest.user_id = p.user_id
WHERE transactions.portfolio_id = p.id
  AND transactions.portfolio_id != oldest.id;

-- ── Step 2: Consolidate manual_positions ──────────────────────────────────────
UPDATE manual_positions
SET portfolio_id = oldest.id
FROM portfolios p
JOIN (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM portfolios
  ORDER BY user_id, created_at ASC
) oldest ON oldest.user_id = p.user_id
WHERE manual_positions.portfolio_id = p.id
  AND manual_positions.portfolio_id != oldest.id;

-- ── Step 3: Consolidate cash_positions ────────────────────────────────────────
UPDATE cash_positions
SET portfolio_id = oldest.id
FROM portfolios p
JOIN (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM portfolios
  ORDER BY user_id, created_at ASC
) oldest ON oldest.user_id = p.user_id
WHERE cash_positions.portfolio_id = p.id
  AND cash_positions.portfolio_id != oldest.id;

-- ── Step 4: Delete duplicate portfolio_snapshots (can be regenerated) ─────────
DELETE FROM portfolio_snapshots
WHERE portfolio_id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM portfolios
  ORDER BY user_id, created_at ASC
);

-- ── Step 5: Delete duplicate portfolios (keep oldest per user) ────────────────
DELETE FROM portfolios
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM portfolios
  ORDER BY user_id, created_at ASC
);

-- ── Step 6: Add UNIQUE constraint to prevent future duplicates ────────────────
ALTER TABLE portfolios
  ADD CONSTRAINT portfolios_user_id_unique UNIQUE (user_id);

-- ── Verification ──────────────────────────────────────────────────────────────
SELECT
  u.email,
  COUNT(p.id)                                                        AS portfolio_count,
  (SELECT COUNT(*) FROM transactions t WHERE t.portfolio_id = p.id) AS tx_count
FROM auth.users u
JOIN portfolios p ON p.user_id = u.id
GROUP BY u.email, p.id
ORDER BY tx_count DESC
LIMIT 20;
