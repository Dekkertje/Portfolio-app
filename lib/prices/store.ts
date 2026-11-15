import type { SupabaseClient } from "@supabase/supabase-js"
import type { FxSyncStatus, InstrumentSyncStatus, PriceUpdates } from "./sync"

const CHUNK = 500

export async function loadSyncStatus(db: SupabaseClient): Promise<{ instruments: InstrumentSyncStatus[]; fx: FxSyncStatus[] }> {
  const { data, error } = await db
    .from("price_sync_status")
    .select("instrument_id, yahoo_symbol, first_event_date, last_price_date")
  if (error) throw new Error(`Sync-status laden mislukt: ${error.message}`)

  const instruments: InstrumentSyncStatus[] = (data ?? []).map((r) => ({
    instrumentId: r.instrument_id,
    symbol: r.yahoo_symbol,
    firstEventDate: r.first_event_date,
    lastPriceDate: r.last_price_date,
  }))

  // Valuta's waarvoor al koersen bestaan; nieuwe valuta's komen uit de Yahoo-resultaten zelf
  const { data: quoteCurrencies } = await db.from("latest_quotes").select("currency").neq("currency", "EUR")
  const currencies = [...new Set((quoteCurrencies ?? []).map((q) => q.currency as string))]

  const fx: FxSyncStatus[] = await Promise.all(
    currencies.map(async (currency) => {
      const { data: last } = await db
        .from("fx_rates")
        .select("rate_date")
        .eq("base_currency", currency)
        .eq("quote_currency", "EUR")
        .order("rate_date", { ascending: false })
        .limit(1)
        .maybeSingle()
      return { currency, lastRateDate: last?.rate_date ?? null }
    }),
  )

  return { instruments, fx }
}

async function upsertChunked(db: SupabaseClient, table: string, rows: object[], onConflict: string) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + CHUNK), { onConflict })
    if (error) throw new Error(`${table} opslaan mislukt: ${error.message}`)
  }
}

/** Schrijft de updates weg. Vereist de service-role client (referentiedata). */
export async function savePriceUpdates(db: SupabaseClient, updates: PriceUpdates): Promise<void> {
  const fetched_at = new Date().toISOString()
  await upsertChunked(db, "daily_prices", updates.daily.map((r) => ({ ...r, fetched_at })), "instrument_id,price_date")
  await upsertChunked(db, "latest_quotes", updates.quotes.map((r) => ({ ...r, fetched_at })), "instrument_id")
  await upsertChunked(db, "fx_rates", updates.fx.map((r) => ({ ...r, fetched_at })), "base_currency,quote_currency,rate_date")
}
