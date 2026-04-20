import { NextRequest, NextResponse } from "next/server"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { matchPosition }              from "@/lib/matching/engine"
import { isCrypto }                   from "@/lib/utils"
import { getFXRate }                  from "@/lib/providers/fx"

export type DividendEntry = {
  product:           string
  symbol:            string
  qty:               number
  exDate:            string | null
  paymentDate:       string | null
  amountPerShare:    number | null
  currency:          string
  amountPerShareEur: number | null
  estimatedPayout:   number | null
  annualRate:        number | null
}

export type ReceivedDividend = {
  product:        string
  symbol:         string
  date:           string
  sharesHeld:     number
  amountPerShare: number
  totalEur:       number
  year:           number
}

// GET /api/dividend-calendar?portfolio_id=...
export async function GET(req: NextRequest) {
  const portfolioId = req.nextUrl.searchParams.get("portfolio_id")
  if (!portfolioId)
    return NextResponse.json({ error: "portfolio_id required" }, { status: 400 })

  const supabase = createServiceSupabaseClient()

  const [{ data: transactions }, { data: manualPositions }] = await Promise.all([
    supabase
      .from("transactions")
      .select("product, isin, transaction_type, quantity, trade_date")
      .eq("portfolio_id", portfolioId)
      .in("transaction_type", ["buy", "sell"])
      .order("trade_date", { ascending: true }),
    supabase
      .from("manual_positions")
      .select("product_name, isin, yahoo_symbol, quantity")
      .eq("portfolio_id", portfolioId),
  ])

  // ── Build holding timeline per product key (chronological) ───────────────────
  // Key: "product__isin"  Value: [{date, qty}] sorted ascending
  type Snapshot = { date: string; qty: number }
  const timeline = new Map<string, Snapshot[]>()
  const runningQty = new Map<string, number>()

  for (const tx of transactions ?? []) {
    const key    = `${tx.product}__${tx.isin || ""}`
    const prev   = runningQty.get(key) ?? 0
    const absQty = Math.abs(Number(tx.quantity))
    const next   = tx.transaction_type === "buy"
      ? prev + absQty
      : Math.max(0, prev - absQty)
    runningQty.set(key, next)
    const snaps = timeline.get(key) ?? []
    snaps.push({ date: tx.trade_date ?? "1900-01-01", qty: next })
    timeline.set(key, snaps)
  }

  // Helper: qty held on a given ISO date (binary search not needed for small sets)
  function qtyOnDate(key: string, isoDate: string): number {
    const snaps = timeline.get(key) ?? []
    let qty = 0
    for (const s of snaps) {
      if (s.date <= isoDate) qty = s.qty
      else break
    }
    return qty
  }

  // ── Compute current net quantities (order-independent) ───────────────────────
  type PosMeta = { product: string; isin: string | null; qty: number; yahooSymbol?: string | null }
  const posMap = new Map<string, PosMeta>()

  for (const [key, snaps] of timeline.entries()) {
    const last = snaps[snaps.length - 1]
    if (!last || last.qty <= 0) continue
    const [product, isin] = key.split("__")
    posMap.set(key, { product, isin: isin || null, qty: last.qty })
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

  const positions = [...posMap.values()].filter(
    p => p.qty > 0 && !isCrypto(p.product, p.isin)
  )

  // ── Resolve Yahoo symbols ────────────────────────────────────────────────────
  type Resolved = { product: string; isin: string | null; qty: number; symbol: string; posKey: string }

  const resolved: Resolved[] = (
    await Promise.all(
      positions.map(async p => {
        const posKey = `${p.product}__${p.isin || ""}`
        let symbol = p.yahooSymbol ?? null
        if (!symbol) {
          const match = await matchPosition({ isin: p.isin, product_name: p.product }, supabase)
          symbol = match.yahoo_symbol
        }
        if (!symbol) return null
        return { product: p.product, isin: p.isin, qty: p.qty, symbol, posKey }
      })
    )
  ).filter((r): r is Resolved => r !== null)

  // ── FX rates ─────────────────────────────────────────────────────────────────
  const { rate: usdToEur } = await getFXRate("USD", "EUR", supabase)
  const { rate: gbpToEur } = await getFXRate("GBP", "EUR", supabase)

  function fxRate(currency: string): number {
    if (currency === "USD") return usdToEur
    if (currency === "GBP" || currency === "GBp") return gbpToEur
    return 1
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const yf2Pkg = require("yahoo-finance2")
  const yf2 = new yf2Pkg.default({ suppressNotices: ["yahooSurvey"] })

  // ── Fetch upcoming ex-dividend dates ─────────────────────────────────────────
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
          const fx = fxRate(currency)

          const exDate = summary.exDividendDate instanceof Date
            ? summary.exDividendDate.toISOString().split("T")[0] : null

          const paymentDate = cal.dividendDate instanceof Date
            ? cal.dividendDate.toISOString().split("T")[0] : null

          const lastDiv    = typeof keyStats.lastDividendValue === "number" ? keyStats.lastDividendValue : null
          const annualRate = typeof summary.dividendRate      === "number" ? summary.dividendRate       : null
          const amountPerShare = lastDiv ?? (annualRate ? annualRate / 4 : null)

          if (!exDate && !annualRate) return null

          const amountPerShareEur = amountPerShare != null ? amountPerShare * fx : null
          const estimatedPayout   = amountPerShareEur != null
            ? Math.round(r.qty * amountPerShareEur * 100) / 100 : null

          return {
            product: r.product, symbol: r.symbol, qty: r.qty,
            exDate, paymentDate, amountPerShare, currency,
            amountPerShareEur, estimatedPayout, annualRate,
          } satisfies DividendEntry
        } catch { return null }
      })
    )
  ).filter((e): e is DividendEntry => e !== null)

  upcoming.sort((a, b) => {
    if (!a.exDate && !b.exDate) return 0
    if (!a.exDate) return 1
    if (!b.exDate) return -1
    return a.exDate.localeCompare(b.exDate)
  })

  // ── Fetch historical dividends from Yahoo and match against holding timeline ─
  // Find earliest transaction date to limit how far back we look
  const allDates = (transactions ?? []).map(t => t.trade_date ?? "").filter(Boolean).sort()
  const earliestDate = allDates[0] ?? "2020-01-01"

  const receivedNested: ReceivedDividend[][] = await Promise.all(
    resolved.map(async r => {
        try {
          const history: any[] = await yf2.historical(r.symbol, {
            period1: earliestDate,
            period2: new Date().toISOString().split("T")[0],
            events:  "div",
          })

          const currency: string =
            upcoming.find(u => u.symbol === r.symbol)?.currency ?? "USD"
          const fx = fxRate(currency)

          return (history ?? [])
            .filter((h: any) => h.date instanceof Date && typeof h.dividends === "number" && h.dividends > 0)
            .map((h: any): ReceivedDividend | null => {
              const exDateStr = h.date.toISOString().split("T")[0]
              const shares    = qtyOnDate(r.posKey, exDateStr)
              if (shares <= 0) return null
              const totalEur  = Math.round(shares * h.dividends * fx * 100) / 100
              return {
                product:        r.product,
                symbol:         r.symbol,
                date:           exDateStr,
                sharesHeld:     shares,
                amountPerShare: h.dividends,
                totalEur,
                year:           h.date.getFullYear(),
              }
            })
            .filter((d: ReceivedDividend | null): d is ReceivedDividend => d !== null)
        } catch { return [] as ReceivedDividend[] }
      })
  )
  const received: ReceivedDividend[] = receivedNested.flat().sort((a, b) => b.date.localeCompare(a.date))

  return NextResponse.json({ upcoming, received })
}
