import { NextRequest, NextResponse } from "next/server"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { matchPosition }              from "@/lib/matching/engine"
import { isCrypto }                   from "@/lib/utils"
import { getFXRate }                  from "@/lib/providers/fx"

export type DividendEntry = {
  product:        string
  symbol:         string
  qty:            number
  exDate:         string | null   // YYYY-MM-DD
  paymentDate:    string | null   // YYYY-MM-DD
  amountPerShare: number | null   // in native currency
  currency:       string
  amountPerShareEur: number | null
  estimatedPayout:   number | null  // qty × amountPerShareEur
  annualRate:     number | null   // full-year dividend in native currency
}

export type ReceivedDividend = {
  product:  string
  date:     string
  totalEur: number
  year:     number
}

// GET /api/dividend-calendar?portfolio_id=...
export async function GET(req: NextRequest) {
  const portfolioId = req.nextUrl.searchParams.get("portfolio_id")
  if (!portfolioId) {
    return NextResponse.json({ error: "portfolio_id required" }, { status: 400 })
  }

  const supabase = createServiceSupabaseClient()
  const thisYear = new Date().getFullYear()

  const [
    { data: transactions },
    { data: manualPositions },
    { data: dividendTxs },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("product, isin, transaction_type, quantity")
      .eq("portfolio_id", portfolioId)
      .not("transaction_type", "ilike", "%dividend%"),
    supabase
      .from("manual_positions")
      .select("product_name, isin, yahoo_symbol, quantity")
      .eq("portfolio_id", portfolioId),
    supabase
      .from("transactions")
      .select("product, trade_date, total_eur")
      .eq("portfolio_id", portfolioId)
      .ilike("transaction_type", "%dividend%")
      .order("trade_date", { ascending: false }),
  ])

  // ── Compute net quantities ─────────────────────────────────────────────────
  type PosMeta = { product: string; isin: string | null; qty: number; yahooSymbol?: string | null }
  const posMap = new Map<string, PosMeta>()

  for (const tx of transactions ?? []) {
    const key = `${tx.product}__${tx.isin || ""}`
    const p   = posMap.get(key) ?? { product: tx.product, isin: tx.isin || null, qty: 0 }
    if (tx.transaction_type === "buy") {
      p.qty += Number(tx.quantity)
    } else if (tx.transaction_type === "sell") {
      p.qty = Math.max(0, p.qty - Number(tx.quantity))
    }
    posMap.set(key, p)
  }
  for (const mp of manualPositions ?? []) {
    const key = `${mp.product_name}__${mp.isin || ""}`
    posMap.set(key, {
      product:     mp.product_name,
      isin:        mp.isin || null,
      qty:         Number(mp.quantity),
      yahooSymbol: mp.yahoo_symbol ?? null,
    })
  }

  // Skip crypto — they don't pay dividends
  const positions = [...posMap.values()].filter(
    p => p.qty > 0 && !isCrypto(p.product, p.isin)
  )

  // ── Resolve Yahoo symbols ──────────────────────────────────────────────────
  const resolved = (
    await Promise.all(
      positions.map(async p => {
        let symbol = p.yahooSymbol ?? null
        if (!symbol) {
          const match = await matchPosition({ isin: p.isin, product_name: p.product }, supabase)
          symbol = match.yahoo_symbol
        }
        if (!symbol) return null
        return { product: p.product, qty: p.qty, symbol }
      })
    )
  ).filter((r): r is { product: string; qty: number; symbol: string } => r !== null)

  // ── FX rates ───────────────────────────────────────────────────────────────
  const { rate: usdToEur } = await getFXRate("USD", "EUR", supabase)
  const { rate: gbpToEur } = await getFXRate("GBP", "EUR", supabase)

  // ── Fetch dividend data via yahoo-finance2 ─────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const yf2Pkg = require("yahoo-finance2")
  const yf2 = new yf2Pkg.default({ suppressNotices: ["yahooSurvey"] })

  const upcoming: DividendEntry[] = (
    await Promise.all(
      resolved.map(async r => {
        try {
          const result = await yf2.quoteSummary(r.symbol, {
            modules: ["summaryDetail", "defaultKeyStatistics", "calendarEvents", "price"],
          })

          const summary  = result?.summaryDetail        ?? {}
          const keyStats = result?.defaultKeyStatistics ?? {}
          const cal      = result?.calendarEvents       ?? {}
          const price    = result?.price                ?? {}

          const currency: string = price.currency ?? "USD"

          const exDate = summary.exDividendDate instanceof Date
            ? summary.exDividendDate.toISOString().split("T")[0]
            : null

          const paymentDate = cal.dividendDate instanceof Date
            ? cal.dividendDate.toISOString().split("T")[0]
            : null

          // Best per-share estimate: last actual payout, then annual/4
          const lastDiv    = typeof keyStats.lastDividendValue === "number" ? keyStats.lastDividendValue : null
          const annualRate = typeof summary.dividendRate === "number" ? summary.dividendRate : null
          const amountPerShare = lastDiv ?? (annualRate ? annualRate / 4 : null)

          if (!exDate && !annualRate) return null   // not a dividend payer

          const fxRate = currency === "USD" ? usdToEur
                       : currency === "GBP" || currency === "GBp" ? gbpToEur
                       : 1

          const amountPerShareEur = amountPerShare != null ? amountPerShare * fxRate : null
          const estimatedPayout   = amountPerShareEur != null
            ? Math.round(r.qty * amountPerShareEur * 100) / 100
            : null

          return {
            product:        r.product,
            symbol:         r.symbol,
            qty:            r.qty,
            exDate,
            paymentDate,
            amountPerShare,
            currency,
            amountPerShareEur,
            estimatedPayout,
            annualRate,
          } satisfies DividendEntry
        } catch {
          return null
        }
      })
    )
  ).filter((e): e is DividendEntry => e !== null)

  // Sort: entries with an exDate first (chronological), then nulls
  upcoming.sort((a, b) => {
    if (!a.exDate && !b.exDate) return 0
    if (!a.exDate) return 1
    if (!b.exDate) return -1
    return a.exDate.localeCompare(b.exDate)
  })

  const received: ReceivedDividend[] = (dividendTxs ?? []).map(tx => ({
    product:  tx.product,
    date:     tx.trade_date ?? "",
    totalEur: Math.abs(Number(tx.total_eur)),
    year:     tx.trade_date ? new Date(tx.trade_date).getFullYear() : thisYear,
  }))

  return NextResponse.json({ upcoming, received })
}
