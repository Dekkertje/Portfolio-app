import { NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server"
import { matchPosition }              from "@/lib/matching/engine"
import { getQuote, getDividendInfo, normalisePencePrice } from "@/lib/providers/yahoo"
import { getFXRate }                  from "@/lib/providers/fx"
import { isCrypto, getCryptoYahooSymbol } from "@/lib/utils"

// ─── POST /api/refresh-prices ────────────────────────────────────────────────
// Fetches current prices for all positions (DEGIRO transactions + manual)
// and stores them in the prices table.  Also refreshes dividend data and
// caches today's USD/EUR rate in fx_rates.

export async function POST(request: Request) {
  // "force=true" (the manual refresh button) always re-fetches every item.
  // Silent/background calls (page load, 3-minute auto-refresh) skip products
  // that already have a price for today — no point hitting Yahoo Finance again.
  const { searchParams } = new URL(request.url)
  const force = searchParams.get("force") === "true"

  // Use service-role client so API routes can write to prices/securities/fx_rates
  // without being blocked by RLS (these tables have no authenticated INSERT policy).
  const supabase = createServiceSupabaseClient()

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
  const dedupedItems = allItems.filter(item => {
    const key = `${item.product}__${item.isin ?? item.yahooSymbol ?? ""}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // ── Skip products already refreshed today (unless forced) ──────────────────
  let items = dedupedItems
  if (!force && dedupedItems.length) {
    const today = new Date().toISOString().split("T")[0]
    const { data: freshToday } = await supabase
      .from("prices")
      .select("product")
      .eq("price_date", today)
      .in("product", dedupedItems.map(i => i.product))

    const freshProducts = new Set((freshToday ?? []).map(p => p.product))
    items = dedupedItems.filter(item => !freshProducts.has(item.product))
  }

  if (items.length === 0) {
    return NextResponse.json({
      success: true,
      inserted: 0,
      skipped: 0,
      errors: [],
      dividendStats: [],
      message: "Koersen zijn al up-to-date voor vandaag.",
    })
  }

  // ── Resolve FX rates once for the whole batch ──────────────────────────────
  const [{ rate: usdToEur }, { rate: gbpToEur }] = await Promise.all([
    getFXRate("USD", "EUR", supabase),
    getFXRate("GBP", "EUR", supabase),
  ])

  // ── Process each product ────────────────────────────────────────────────────
  const results = await Promise.allSettled(items.map(item => processItem(item, usdToEur, gbpToEur, supabase)))

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
    errors: errors.slice(0, 10), // cap to avoid oversized responses
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
  gbpToEur: number,
  supabase: ReturnType<typeof createServerSupabaseClient> extends Promise<infer T> ? T : never
): Promise<ProcessResult> {

  // ── Resolve Yahoo symbol ──────────────────────────────────────────────────
  let yahooSymbol = item.yahooSymbol   // already set for manual positions

  if (!yahooSymbol) {
    if (isCrypto(item.product, item.isin)) {
      // If DEGIRO stored the ISIN as a Yahoo-style ticker (e.g. "XRP-USD", "BTC-EUR"),
      // use it directly — no further resolution needed.
      if (item.isin && /^[A-Z0-9]+-[A-Z]{3}$/i.test(item.isin)) {
        yahooSymbol = item.isin.toUpperCase()
      } else {
        yahooSymbol = getCryptoYahooSymbol(item.product, item.isin)
      }
    } else {
      const match = await matchPosition(
        { isin: item.isin, product_name: item.product },
        supabase
      )
      yahooSymbol = match.yahoo_symbol
    }
  }

  if (!yahooSymbol) {
    return { skipped: true, reason: `No symbol: ${item.product} (ISIN: ${item.isin ?? "N/A"})` }
  }

  // ── Fetch quote + dividend info in parallel ────────────────────────────────
  // These are two independent Yahoo Finance calls — no need to wait for the
  // quote to finish before starting the dividend lookup.
  const [quote, divInfo] = await Promise.all([getQuote(yahooSymbol), getDividendInfo(yahooSymbol)])

  if (!quote) {
    return { skipped: true, reason: `No quote for ${yahooSymbol} (${item.product})` }
  }

  // ── Currency conversion + pence fix ──────────────────────────────────────
  // normalisePencePrice handles GBp → GBP (÷100); then we convert to EUR.
  const isUsd = quote.currency === "USD"
  const isGBp = quote.currency === "GBp" || quote.currency === "GBP"
  const rate  = isUsd ? usdToEur : isGBp ? gbpToEur : 1

  const price         = normalisePencePrice(quote.price,         quote.currency) * rate
  // Store yesterday's closing price so "dag" P&L = current vs previous close.
  const previousClose = normalisePencePrice(quote.previousClose, quote.currency) * rate

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

  if (divInfo && divInfo.annualDividendRate > 0) {
    const annualEur = isUsd
      ? divInfo.annualDividendRate * usdToEur
      : isGBp
      ? normalisePencePrice(divInfo.annualDividendRate, quote.currency) * gbpToEur
      : divInfo.annualDividendRate

    // Frequency: quarterly for USD, annual for EUR, monthly for GBP income trusts
    const frequency = isUsd ? "quarterly" : "annual"

    dividendResult = { product: item.product, dividend: annualEur, frequency }

    if (item.isin) {
      // UPSERT: creates the row if it doesn't exist yet (e.g. ISINs not in the
      // pre-seeded securities table), otherwise updates the dividend columns only.
      await supabase
        .from("securities")
        .upsert(
          {
            isin:               item.isin,
            name:               item.product,
            yahoo_symbol:       yahooSymbol,
            annual_dividend:    round4(annualEur),
            dividend_frequency: frequency,
          },
          { onConflict: "isin" }
        )
    }
  }

  return { skipped: false, dividend: dividendResult }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}
