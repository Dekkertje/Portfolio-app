import { NextRequest, NextResponse } from "next/server"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { matchPosition }            from "@/lib/matching/engine"
import { isCrypto, getCryptoYahooSymbol } from "@/lib/utils"
import { getFXRate }                from "@/lib/providers/fx"

const BASE_V8  = "https://query1.finance.yahoo.com/v8/finance"
const HEADERS  = { "User-Agent": "Mozilla/5.0" }

// GET /api/portfolio-intraday?portfolio_id=...
// Returns 5-minute portfolio value snapshots for today.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const portfolioId = searchParams.get("portfolio_id")
  if (!portfolioId) {
    return NextResponse.json({ error: "portfolio_id required" }, { status: 400 })
  }

  const supabase = createServiceSupabaseClient()

  // ── Load raw data in parallel ──────────────────────────────────────────────
  const [
    { data: transactions },
    { data: manualPositions },
    { data: cashRows },
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
      .from("cash_positions")
      .select("amount")
      .eq("portfolio_id", portfolioId),
  ])

  // ── Compute net quantities ─────────────────────────────────────────────────
  type PosMeta = { product: string; isin: string | null; qty: number; yahooSymbol?: string | null }
  const posMap = new Map<string, PosMeta>()

  for (const tx of transactions ?? []) {
    const key = `${tx.product}__${tx.isin || ""}`
    const p   = posMap.get(key) ?? { product: tx.product, isin: tx.isin || null, qty: 0 }
    p.qty += tx.transaction_type === "buy" ? Number(tx.quantity) : -Number(tx.quantity)
    posMap.set(key, p)
  }

  // Manual positions override the map key (same logic as refresh-prices)
  for (const mp of manualPositions ?? []) {
    const key = `${mp.product_name}__${mp.isin || ""}`
    posMap.set(key, {
      product:     mp.product_name,
      isin:        mp.isin || null,
      qty:         Number(mp.quantity),
      yahooSymbol: mp.yahoo_symbol ?? null,
    })
  }

  const positions = [...posMap.values()].filter(p => p.qty > 0)

  // ── Resolve Yahoo symbols ──────────────────────────────────────────────────
  type Resolved = { qty: number; symbol: string }

  const resolved: Resolved[] = (
    await Promise.all(
      positions.map(async p => {
        let symbol = p.yahooSymbol ?? null

        if (!symbol) {
          if (isCrypto(p.product, p.isin)) {
            symbol =
              p.isin && /^[A-Z0-9]+-[A-Z]{3}$/i.test(p.isin)
                ? p.isin.toUpperCase()
                : getCryptoYahooSymbol(p.product, p.isin)
          } else {
            const match = await matchPosition({ isin: p.isin, product_name: p.product }, supabase)
            symbol = match.yahoo_symbol
          }
        }

        if (!symbol) return null
        return { qty: p.qty, symbol } satisfies Resolved
      })
    )
  ).filter((r): r is Resolved => r !== null)

  // ── FX rate ────────────────────────────────────────────────────────────────
  const { rate: usdToEur } = await getFXRate("USD", "EUR", supabase)

  // ── Fetch intraday (5m/1d) for each symbol ─────────────────────────────────
  type RawPoint = { ts: number; price: number; currency: string }

  async function fetchIntraday(symbol: string): Promise<RawPoint[]> {
    const url = `${BASE_V8}/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d`
    try {
      const res = await fetch(url, { headers: HEADERS })
      if (!res.ok) return []
      const json     = await res.json()
      const result   = json?.chart?.result?.[0]
      if (!result) return []
      const tss:      number[] = result.timestamp ?? []
      const closes:   number[] = result.indicators?.quote?.[0]?.close ?? []
      const currency: string   = result.meta?.currency ?? "USD"
      return tss
        .map((ts, i) => ({ ts, price: closes[i], currency }))
        .filter(p => p.price != null && p.price > 0)
    } catch {
      return []
    }
  }

  const intradayByPos = await Promise.all(
    resolved.map(async r => ({ qty: r.qty, data: await fetchIntraday(r.symbol) }))
  )

  // ── Build unified timeline ─────────────────────────────────────────────────
  const allTs = new Set<number>()
  for (const { data } of intradayByPos) {
    for (const p of data) allTs.add(p.ts)
  }

  if (allTs.size === 0) {
    return NextResponse.json({ points: [] })
  }

  const cashTotal = (cashRows ?? []).reduce((s, c) => s + Number(c.amount), 0)

  const sortedTs = [...allTs].sort((a, b) => a - b)

  const timeline = sortedTs.map(ts => {
    let value = cashTotal

    for (const { qty, data } of intradayByPos) {
      // Fill-forward: find the most recent price at or before this timestamp
      let price    = 0
      let currency = "EUR"
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].ts <= ts) {
          price    = data[i].price
          currency = data[i].currency
          break
        }
      }
      if (price <= 0) continue

      const rate = currency === "USD" ? usdToEur
                 : currency === "GBp" ? 0.01   // pence → pounds
                 : 1

      value += qty * price * rate
    }

    const timeLabel = new Date(ts * 1000).toLocaleTimeString("nl-NL", {
      hour:     "2-digit",
      minute:   "2-digit",
      timeZone: "Europe/Amsterdam",
    })

    return { time: timeLabel, ts: ts * 1000, value: Math.round(value * 100) / 100 }
  })

  return NextResponse.json({ points: timeline })
}
