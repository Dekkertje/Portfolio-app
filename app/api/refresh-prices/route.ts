import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { matchPosition }              from "@/lib/matching/engine"
import { getQuote, getDividendInfo, normalisePencePrice } from "@/lib/providers/yahoo"
import { getFXRate }                  from "@/lib/providers/fx"

// ─── POST /api/refresh-prices ────────────────────────────────────────────────
// Fetches current prices for all positions (DEGIRO transactions + manual)
// and stores them in the prices table.  Also refreshes dividend data and
// caches today's USD/EUR rate in fx_rates.

export async function POST() {
  const supabase = await createServerSupabaseClient()

  // ── Collect unique products ─────────────────────────────────────────────────
  const [{ data: transactions }, { data: manualPositions }] = await Promise.all([
    supabase.from("transactions").select("product, isin"),
    supabase.from("manual_positions").select("product_name, isin, yahoo_symbol"),
  ])

  type Item = { product: string; isin: string | null; yahooSymbol: string | null }

  const allItems: Item[] = [
    ...(transactions     ?? []).map(t  => ({ product: t.product,       isin: t.isin  ?? null, yahooSymbol: null })),
    ...(manualPositions  ?? []).map(mp => ({ product: mp.product_name, isin: mp.isin ?? null, yahooSymbol: mp.yahoo_symbol ?? null })),
  ]

  // Deduplicate on (product, isin)
  const seen  = new Set<string>()
  const items = allItems.filter(item => {
    const key = `${item.product}__${item.isin ?? item.yahooSymbol ?? ""}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // ── Resolve USD/EUR rate once for the whole batch ───────────────────────────
  const { rate: usdToEur } = await getFXRate("USD", "EUR", supabase)

  // ── Process each product ────────────────────────────────────────────────────
  const results = await Promise.allSettled(items.map(item => processItem(item, usdToEur, supabase)))

  let inserted = 0
  let skipped  = 0
  const errors: string[] = []
  const dividendStats: { product: string; dividend: number; frequency: string }[] = []

  for (const r of results) {
    if (r.status === "rejected") {
      errors.push(String(r.reason))
      skipped++
      continue
    }
    if (r.value.skipped) {
      skipped++
      if (r.value.reason) errors.push(r.value.reason)
    } else {
      inserted++
      if (!r.value.skipped && r.value.dividend) dividendStats.push(r.value.dividend)
    }
  }

  return NextResponse.json({
    success: true,
    inserted,
    skipped,
    errors,
    dividendStats,
    message: `${inserted} prijzen opgehaald, ${skipped} overgeslagen, ${dividendStats.length} dividenden gevonden`,
  })
}

// ─── Process a single item ───────────────────────────────────────────────────

type DividendStat = { product: string; dividend: number; frequency: string }

type ProcessResult =
  | { skipped: false; dividend?: DividendStat }
  | { skipped: true;  reason?: string }

async function processItem(
  item: { product: string; isin: string | null; yahooSymbol: string | null },
  usdToEur: number,
  supabase: ReturnType<typeof createServerSupabaseClient> extends Promise<infer T> ? T : never
): Promise<ProcessResult> {

  // ── Resolve Yahoo symbol ──────────────────────────────────────────────────
  let yahooSymbol = item.yahooSymbol   // already set for manual positions

  if (!yahooSymbol) {
    const match = await matchPosition(
      { isin: item.isin, product_name: item.product },
      supabase
    )
    yahooSymbol = match.yahoo_symbol
  }

  if (!yahooSymbol) {
    return { skipped: true, reason: `No symbol found for: ${item.product} (ISIN: ${item.isin ?? "N/A"})` }
  }

  // ── Fetch quote ───────────────────────────────────────────────────────────
  const quote = await getQuote(yahooSymbol)

  if (!quote) {
    return { skipped: true, reason: `No price data for ${yahooSymbol}` }
  }

  // ── Currency conversion + pence fix ──────────────────────────────────────
  const isUsd = quote.currency === "USD"
  const rate  = isUsd ? usdToEur : 1

  let price         = normalisePencePrice(quote.price,         quote.currency) * rate
  let previousClose = normalisePencePrice(quote.previousClose, quote.currency) * rate

  // Prefer our own DB history as previous close (more stable across FX movements)
  const { data: lastStored } = await supabase
    .from("prices")
    .select("price, price_date")
    .eq("product", item.product)
    .lt("price_date", quote.priceDate)
    .order("price_date", { ascending: false })
    .limit(1)

  if (lastStored && lastStored.length > 0) {
    previousClose = Number(lastStored[0].price)
  }

  // ── Persist price ─────────────────────────────────────────────────────────
  // Delete-then-insert to avoid unique constraint conflicts on same-day refresh
  await supabase.from("prices").delete()
    .eq("product", item.product)
    .eq("price_date", quote.priceDate)

  const { error: insertError } = await supabase.from("prices").insert({
    product:        item.product,
    isin:           item.isin,
    price:          round4(price),
    previous_close: round4(previousClose),
    price_date:     quote.priceDate,
    source:         "yahoo_finance",
  })

  if (insertError) {
    return { skipped: true, reason: `DB insert failed for ${item.product}: ${insertError.message}` }
  }

  // ── Refresh dividend data ─────────────────────────────────────────────────
  let dividendResult: DividendStat | undefined

  const divInfo = await getDividendInfo(yahooSymbol)
  if (divInfo && divInfo.annualDividendRate > 0) {
    const annualEur = isUsd
      ? divInfo.annualDividendRate * usdToEur
      : divInfo.annualDividendRate

    const frequency = isUsd ? "quarterly" : "annual"

    dividendResult = { product: item.product, dividend: annualEur, frequency }

    if (item.isin) {
      await supabase
        .from("securities")
        .update({
          annual_dividend:    round4(annualEur),
          dividend_frequency: frequency,
        })
        .eq("isin", item.isin)
    }
  }

  return { skipped: false, dividend: dividendResult }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}
