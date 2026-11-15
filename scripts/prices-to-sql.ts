/**
 * Koersen ophalen bij Yahoo en als SQL wegschrijven (voor een eerste vulling
 * zonder service-role-sleutel). Status komt uit de view price_sync_status:
 *
 *   npx supabase db query --remote --read-only "select json_agg(s)::text as status from price_sync_status s" > status.json
 *   npx tsx scripts/prices-to-sql.ts status.json > prices.sql
 *   npx supabase db query --remote -f prices.sql
 */
import { readFileSync } from "node:fs"
import { collectPriceUpdates } from "@/lib/prices/sync"

type StatusRow = { instrument_id: string; yahoo_symbol: string; first_event_date: string; last_price_date: string | null }

const raw = JSON.parse(readFileSync(process.argv[2], "utf8"))
// Accepteert zowel de CLI-uitvoer ({ rows: [{ status }] }) als een kale array
const rows: StatusRow[] = Array.isArray(raw) ? raw : JSON.parse(raw.rows[0].status)

const q = (v: string | null) => (v == null ? "NULL" : `'${v.replace(/'/g, "''")}'`)
const n = (v: number | null) => (v == null || !isFinite(v) ? "NULL" : String(v))

async function main() {
  const updates = await collectPriceUpdates(
    rows.map((r) => ({ instrumentId: r.instrument_id, symbol: r.yahoo_symbol, firstEventDate: r.first_event_date, lastPriceDate: r.last_price_date })),
    [],
  )

  const out: string[] = ["BEGIN;"]
  const batch = <T>(items: T[], size = 1000) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size))

  for (const part of batch(updates.daily)) {
    out.push(`INSERT INTO public.daily_prices (instrument_id, price_date, close, currency, source) VALUES
  ${part.map((r) => `  (${q(r.instrument_id)}, ${q(r.price_date)}, ${n(r.close)}, ${q(r.currency)}, 'yahoo')`).join(",\n")}
  ON CONFLICT (instrument_id, price_date) DO UPDATE SET close = EXCLUDED.close, currency = EXCLUDED.currency, fetched_at = NOW();`)
  }
  if (updates.quotes.length) {
    out.push(`INSERT INTO public.latest_quotes (instrument_id, price, previous_close, currency, market_state, quoted_at, source) VALUES
  ${updates.quotes.map((r) => `  (${q(r.instrument_id)}, ${n(r.price)}, ${n(r.previous_close)}, ${q(r.currency)}, ${q(r.market_state)}, ${q(r.quoted_at)}, 'yahoo')`).join(",\n")}
  ON CONFLICT (instrument_id) DO UPDATE SET price = EXCLUDED.price, previous_close = EXCLUDED.previous_close, currency = EXCLUDED.currency,
    market_state = EXCLUDED.market_state, quoted_at = EXCLUDED.quoted_at, fetched_at = NOW();`)
  }
  for (const part of batch(updates.fx)) {
    out.push(`INSERT INTO public.fx_rates (base_currency, quote_currency, rate, rate_date, source) VALUES
  ${part.map((r) => `  (${q(r.base_currency)}, ${q(r.quote_currency)}, ${n(r.rate)}, ${q(r.rate_date)}, 'yahoo')`).join(",\n")}
  ON CONFLICT (base_currency, quote_currency, rate_date) DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source, fetched_at = NOW();`)
  }
  out.push("COMMIT;")
  process.stdout.write(out.join("\n\n") + "\n")

  console.error(`${rows.length} instrumenten → ${updates.daily.length} dagkoersen, ${updates.quotes.length} actuele koersen, ${updates.fx.length} FX-koersen`)
  for (const e of updates.errors) console.error("  fout:", e)
}

main()
