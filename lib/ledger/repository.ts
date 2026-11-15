/**
 * Opslag van het grootboek in Supabase.
 *
 * In de kern (lib/core) is instrumentId een willekeurige string; de importers
 * gebruiken de ISIN. Hier wordt die vertaald naar instruments.id (uuid) en terug.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { LedgerEvent } from "@/lib/core/types"
import type { ParsedInstrument } from "@/lib/import/degiro"
import { isETF } from "@/lib/utils"

export type InstrumentRow = {
  id: string
  isin: string
  name: string
  kind: string
  currency: string
  exchange: string | null
  yahoo_symbol: string | null
  symbol_status: "unmatched" | "suggested" | "approved"
  sector: string | null
}

const CHUNK = 500
// PostgREST levert standaard maximaal 1000 rijen per request
const PAGE = 1000

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Zorgt dat alle instrumenten bestaan en geeft ISIN → instruments.id terug.
 * Nieuwe instrumenten nemen een goedgekeurde Yahoo-koppeling over uit de oude ticker_mappings.
 * Schrijft gedeelde referentiedata: vereist de service-role client.
 */
export async function ensureInstruments(db: SupabaseClient, parsed: ParsedInstrument[]): Promise<Map<string, string>> {
  const isins = [...new Set(parsed.map((p) => p.isin))]
  const idByIsin = new Map<string, string>()
  if (!isins.length) return idByIsin

  for (const part of chunks(isins)) {
    const { data, error } = await db.from("instruments").select("id, isin").in("isin", part)
    if (error) throw new Error(`Instrumenten ophalen mislukt: ${error.message}`)
    for (const row of data ?? []) idByIsin.set(row.isin, row.id)
  }

  const missing = parsed.filter((p, i, all) => !idByIsin.has(p.isin) && all.findIndex((q) => q.isin === p.isin) === i)
  if (!missing.length) return idByIsin

  const symbolByIsin = new Map<string, { symbol: string; confidence: number | null; method: string | null }>()
  for (const part of chunks(missing.map((m) => m.isin))) {
    const { data, error } = await db
      .from("ticker_mappings")
      .select("isin, yahoo_symbol, confidence_score, match_method")
      .eq("is_approved", true)
      .in("isin", part)
      .order("confidence_score", { ascending: false })
    if (error) throw new Error(`Ticker-koppelingen ophalen mislukt: ${error.message}`)
    for (const row of data ?? []) {
      if (!symbolByIsin.has(row.isin)) {
        symbolByIsin.set(row.isin, { symbol: row.yahoo_symbol, confidence: row.confidence_score, method: row.match_method })
      }
    }
  }

  const rows = missing.map((p) => {
    const mapping = symbolByIsin.get(p.isin)
    return {
      isin: p.isin,
      name: p.name,
      kind: isETF(p.name) ? "etf" : "stock",
      currency: p.currency,
      exchange: p.exchange,
      yahoo_symbol: mapping?.symbol ?? null,
      symbol_status: mapping ? "approved" : "unmatched",
      match_confidence: mapping?.confidence ?? null,
      match_method: mapping ? (mapping.method ?? "legacy_mapping") : null,
    }
  })

  for (const part of chunks(rows)) {
    const { data, error } = await db
      .from("instruments")
      .upsert(part, { onConflict: "isin", ignoreDuplicates: true })
      .select("id, isin")
    if (error) throw new Error(`Instrumenten opslaan mislukt: ${error.message}`)
    for (const row of data ?? []) idByIsin.set(row.isin, row.id)
  }

  // Bij een gelijktijdige insert levert ignoreDuplicates geen rij terug; nog één keer ophalen
  const stillMissing = missing.filter((m) => !idByIsin.has(m.isin)).map((m) => m.isin)
  if (stillMissing.length) {
    const { data } = await db.from("instruments").select("id, isin").in("isin", stillMissing)
    for (const row of data ?? []) idByIsin.set(row.isin, row.id)
  }
  return idByIsin
}

export type SaveImportInput = {
  portfolioId: string
  source: "degiro" | "manual" | "migration"
  fileNames: string[]
  /** Events met instrumentId = ISIN, zoals de importers ze opleveren */
  events: LedgerEvent[]
  instruments: Map<string, ParsedInstrument>
  warnings: string[]
}

/**
 * Slaat een import op. Bestaande events (zelfde external_id) worden overgeslagen,
 * dus dezelfde bestanden twee keer importeren is veilig.
 */
export async function saveImport(
  db: SupabaseClient,
  input: SaveImportInput,
): Promise<{ batchId: string; total: number; inserted: number }> {
  const idByIsin = await ensureInstruments(db, [...input.instruments.values()])

  const { data: batch, error: batchError } = await db
    .from("import_batches")
    .insert({
      portfolio_id: input.portfolioId,
      source: input.source,
      file_names: input.fileNames,
      event_count: input.events.length,
      warnings: input.warnings,
    })
    .select("id")
    .single()
  if (batchError || !batch) throw new Error(`Import vastleggen mislukt: ${batchError?.message}`)

  const rows = input.events.map((e) => {
    const instrumentId = e.instrumentId ? idByIsin.get(e.instrumentId) : null
    if (e.instrumentId && !instrumentId) throw new Error(`Geen instrument voor ISIN ${e.instrumentId}`)
    return {
      portfolio_id: input.portfolioId,
      external_id: e.id,
      import_batch_id: batch.id,
      event_date: e.date,
      event_type: e.type,
      instrument_id: instrumentId,
      quantity: e.quantity,
      price: e.price,
      currency: e.currency,
      amount_eur: e.amountEur,
      fee_eur: e.feeEur,
      split_ratio: e.splitRatio ?? null,
    }
  })

  let inserted = 0
  for (const part of chunks(rows)) {
    const { data, error } = await db
      .from("ledger_events")
      .upsert(part, { onConflict: "portfolio_id,external_id", ignoreDuplicates: true })
      .select("id")
    if (error) throw new Error(`Events opslaan mislukt: ${error.message}`)
    inserted += data?.length ?? 0
  }

  await db.from("import_batches").update({ inserted_count: inserted }).eq("id", batch.id)
  return { batchId: batch.id, total: rows.length, inserted }
}

type LedgerEventRow = {
  external_id: string
  event_date: string
  event_type: LedgerEvent["type"]
  instrument_id: string | null
  quantity: number | string
  price: number | string | null
  currency: string
  amount_eur: number | string
  fee_eur: number | string
  split_ratio: number | string | null
}

/** Laadt het volledige grootboek van een portfolio, met instrumentId = instruments.id. */
export async function loadLedger(
  db: SupabaseClient,
  portfolioId: string,
): Promise<{ events: LedgerEvent[]; instruments: Map<string, InstrumentRow> }> {
  const rows: LedgerEventRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("ledger_events")
      .select("external_id, event_date, event_type, instrument_id, quantity, price, currency, amount_eur, fee_eur, split_ratio")
      .eq("portfolio_id", portfolioId)
      .order("event_date")
      .order("external_id")
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Grootboek laden mislukt: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }

  const events: LedgerEvent[] = rows.map((r) => ({
    id: r.external_id,
    date: r.event_date,
    type: r.event_type,
    instrumentId: r.instrument_id,
    quantity: Number(r.quantity),
    price: r.price == null ? null : Number(r.price),
    currency: r.currency,
    amountEur: Number(r.amount_eur),
    feeEur: Number(r.fee_eur),
    ...(r.split_ratio != null ? { splitRatio: Number(r.split_ratio) } : {}),
  }))

  const instrumentIds = [...new Set(events.map((e) => e.instrumentId).filter((id): id is string => Boolean(id)))]
  const instruments = new Map<string, InstrumentRow>()
  for (const part of chunks(instrumentIds)) {
    const { data, error } = await db
      .from("instruments")
      .select("id, isin, name, kind, currency, exchange, yahoo_symbol, symbol_status, sector")
      .in("id", part)
    if (error) throw new Error(`Instrumenten laden mislukt: ${error.message}`)
    for (const row of data ?? []) instruments.set(row.id, row as InstrumentRow)
  }

  return { events, instruments }
}
