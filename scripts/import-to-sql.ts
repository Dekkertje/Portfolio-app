/**
 * Zet een import om naar één SQL-transactie, uit te voeren met
 *   npx supabase db query --remote -f <bestand.sql>
 * Handig voor eenmalige migraties zonder service-role-sleutel.
 *
 *   npx tsx scripts/import-to-sql.ts degiro <portfolioId> <Transactions.csv> [Account.csv] > out.sql
 *   npx tsx scripts/import-to-sql.ts legacy <dump.json> > out.sql
 *
 * dump.json: { portfolios: [{ id, transactions: LegacyTransactionRow[], manualPositions: LegacyManualPositionRow[] }] }
 *
 * Idempotent: bestaande instrumenten worden overgeslagen; bestaande events (zelfde
 * external_id) worden bijgewerkt, zodat parser-verbeteringen doorkomen bij herimport.
 */
import { readFileSync } from "node:fs"
import { basename } from "node:path"
import type { LedgerEvent } from "@/lib/core/types"
import { degiroToLedger, type ParsedInstrument } from "@/lib/import/degiro"
import { legacyToLedger, type LegacyManualPositionRow, type LegacyTransactionRow } from "@/lib/import/legacy"
import { isETF } from "@/lib/utils"

const q = (v: string | null | undefined) => (v == null ? "NULL" : `'${v.replace(/'/g, "''")}'`)
const num = (v: number | null | undefined) => (v == null || !isFinite(v) ? "NULL" : String(v))

type Batch = {
  portfolioId: string
  source: "degiro" | "migration"
  fileNames: string[]
  events: LedgerEvent[]
  instruments: Map<string, ParsedInstrument>
  warnings: string[]
}

function instrumentsSql(instruments: ParsedInstrument[]): string {
  if (!instruments.length) return ""
  const values = instruments
    .map((i) => `(${q(i.isin)}, ${q(i.name)}, ${q(isETF(i.name) ? "etf" : "stock")}, ${q(i.currency)}, ${q(i.exchange)})`)
    .join(",\n  ")
  return `INSERT INTO public.instruments (isin, name, kind, currency, exchange) VALUES
  ${values}
ON CONFLICT (isin) DO NOTHING;
`
}

function batchSql(b: Batch): string {
  if (!b.events.length) return ""
  const values = b.events
    .map(
      (e) =>
        `(${q(e.id)}, ${q(e.date)}, ${q(e.type)}, ${q(e.instrumentId)}, ${num(e.quantity)}, ${num(e.price)}, ${q(e.currency)}, ${num(Math.round(e.amountEur * 100) / 100)}, ${num(Math.round(e.feeEur * 100) / 100)}, ${num(e.splitRatio)})`,
    )
    .join(",\n  ")
  return `WITH b AS (
  INSERT INTO public.import_batches (portfolio_id, source, file_names, event_count, warnings)
  VALUES (${q(b.portfolioId)}, ${q(b.source)}, ARRAY[${b.fileNames.map(q).join(", ")}]::text[], ${b.events.length}, ${q(JSON.stringify(b.warnings))}::jsonb)
  RETURNING id
)
INSERT INTO public.ledger_events
  (portfolio_id, external_id, import_batch_id, event_date, event_type, instrument_id, quantity, price, currency, amount_eur, fee_eur, split_ratio)
SELECT ${q(b.portfolioId)}::uuid, v.external_id, b.id, v.event_date::date, v.event_type, i.id,
       v.quantity::numeric, v.price::numeric, v.currency, v.amount_eur::numeric, v.fee_eur::numeric, v.split_ratio::numeric
FROM b
CROSS JOIN (VALUES
  ${values}
) AS v(external_id, event_date, event_type, isin, quantity, price, currency, amount_eur, fee_eur, split_ratio)
LEFT JOIN public.instruments i ON i.isin = v.isin
ON CONFLICT (portfolio_id, external_id) DO UPDATE SET
  event_date = EXCLUDED.event_date, event_type = EXCLUDED.event_type, instrument_id = EXCLUDED.instrument_id,
  quantity = EXCLUDED.quantity, price = EXCLUDED.price, currency = EXCLUDED.currency,
  amount_eur = EXCLUDED.amount_eur, fee_eur = EXCLUDED.fee_eur, split_ratio = EXCLUDED.split_ratio;
`
}

function wrap(batches: Batch[]): string {
  const allInstruments = new Map<string, ParsedInstrument>()
  for (const b of batches) for (const [isin, i] of b.instruments) if (!allInstruments.has(isin)) allInstruments.set(isin, i)

  return `BEGIN;

${instrumentsSql([...allInstruments.values()])}
-- Goedgekeurde Yahoo-koppelingen uit de oude ticker_mappings overnemen
UPDATE public.instruments i
SET yahoo_symbol = m.yahoo_symbol,
    symbol_status = 'approved',
    match_confidence = m.confidence_score,
    match_method = COALESCE(m.match_method, 'legacy_mapping'),
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (isin) isin, yahoo_symbol, confidence_score, match_method
  FROM public.ticker_mappings
  WHERE is_approved
  ORDER BY isin, confidence_score DESC NULLS LAST
) m
WHERE m.isin = i.isin AND i.yahoo_symbol IS NULL;

${batches.map(batchSql).join("\n")}
UPDATE public.import_batches ib
SET inserted_count = (SELECT COUNT(*) FROM public.ledger_events le WHERE le.import_batch_id = ib.id)
-- import_batch_id blijft bij een update de oorspronkelijke batch, dus dit telt alleen nieuwe events
WHERE ib.inserted_count = 0 AND ib.event_count > 0;

COMMIT;
`
}

const [mode, ...args] = process.argv.slice(2)

if (mode === "degiro") {
  const [portfolioId, txPath, accountPath] = args
  const r = degiroToLedger({
    transactions: readFileSync(txPath, "utf8"),
    account: accountPath ? readFileSync(accountPath, "utf8") : undefined,
  })
  const fileNames = [txPath, accountPath].filter(Boolean).map((p) => basename(p!))
  process.stdout.write(wrap([{ portfolioId, source: "degiro", fileNames, ...r }]))
  console.error(`degiro: ${r.events.length} events, ${r.instruments.size} instrumenten, ${r.warnings.length} waarschuwingen`)
} else if (mode === "legacy") {
  const dump = JSON.parse(readFileSync(args[0], "utf8")) as {
    portfolios: { id: string; transactions: LegacyTransactionRow[]; manualPositions: LegacyManualPositionRow[] }[]
  }
  const batches: Batch[] = dump.portfolios.map((p) => ({
    portfolioId: p.id,
    source: "migration",
    fileNames: [],
    ...legacyToLedger({ transactions: p.transactions, manualPositions: p.manualPositions }),
  }))
  process.stdout.write(wrap(batches))
  for (const b of batches) console.error(`legacy ${b.portfolioId}: ${b.events.length} events, ${b.warnings.length} waarschuwingen`)
} else {
  console.error("Gebruik: import-to-sql.ts degiro <portfolioId> <tx.csv> [account.csv] | legacy <dump.json>")
  process.exit(1)
}
