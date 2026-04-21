/**
 * GET /api/portfolio-history?portfolio_id=X&from=YYYY-MM-DD
 *
 * Reconstructs daily portfolio values from transaction history + Yahoo Finance
 * historical prices.  Results are upserted into portfolio_snapshots so that
 * subsequent chart loads use the fast snapshot path instead of re-fetching.
 *
 * Returns:
 *   { history: { date, value, cost, pnl, realizedPnL }[] }
 *
 * Notes:
 * - USD → EUR conversion uses today's cached rate (acceptable approximation for
 *   a personal portfolio — avoids fetching daily FX series).
 * - GBp (pence) prices are divided by 100.
 * - Weekends and holidays are skipped (no price data available).
 * - Positions without a mapped Yahoo symbol fall back to average cost per share.
 */

import { NextResponse } from "next/server"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { getFXRate } from "@/lib/providers/fx"

const HEADERS = { "User-Agent": "Mozilla/5.0" }

// ─── Yahoo historical price fetch ─────────────────────────────────────────────

type DayPrice = { close: number; currency: string }

async function fetchHistoricalPrices(
  symbol: string,
  fromDate: string,
  toDate: string
): Promise<Record<string, DayPrice>> {
  const p1 = Math.floor(new Date(fromDate + "T00:00:00Z").getTime() / 1000) - 86400
  const p2 = Math.floor(new Date(toDate   + "T23:59:59Z").getTime() / 1000) + 86400

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
              `?interval=1d&period1=${p1}&period2=${p2}`

  try {
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) return {}

    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return {}

    const currency: string = result.meta?.currency ?? "USD"
    const timestamps: number[] = result.timestamp ?? []

    // Prefer adjusted close (handles splits + dividends), fall back to close
    const closes: (number | null)[] =
      result.indicators?.adjclose?.[0]?.adjclose ??
      result.indicators?.quote?.[0]?.close ??
      []

    const out: Record<string, DayPrice> = {}
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i]
      if (c == null || !isFinite(c)) continue
      const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0]
      out[date] = { close: c, currency }
    }
    return out
  } catch {
    return {}
  }
}

// ─── Date range helper ────────────────────────────────────────────────────────

function dateRange(from: string, to: string): string[] {
  const dates: string[] = []
  const cur = new Date(from + "T12:00:00Z")
  const end = new Date(to   + "T12:00:00Z")
  while (cur <= end) {
    dates.push(cur.toISOString().split("T")[0])
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const supabase = createServiceSupabaseClient()
    const { searchParams } = new URL(request.url)
    const portfolioId = searchParams.get("portfolio_id")
    const fromParam   = searchParams.get("from") // optional YYYY-MM-DD

    if (!portfolioId) {
      return NextResponse.json({ error: "portfolio_id required" }, { status: 400 })
    }

    // ── 1. Fetch transactions ─────────────────────────────────────────────────
    const { data: txs } = await supabase
      .from("transactions")
      .select("trade_date, product, isin, transaction_type, quantity, total_eur")
      .eq("portfolio_id", portfolioId)
      .order("trade_date", { ascending: true })

    if (!txs || txs.length === 0) {
      return NextResponse.json({ history: [] })
    }

    const firstDate = fromParam ?? txs[0].trade_date
    const today     = new Date().toISOString().split("T")[0]

    // ── 2. Get Yahoo symbols for each ISIN ────────────────────────────────────
    const isins = [...new Set(txs.map(t => t.isin).filter(Boolean))] as string[]

    const { data: mappings } = await supabase
      .from("ticker_mappings")
      .select("isin, yahoo_symbol")
      .in("isin", isins)
      .eq("is_approved", true)

    // Fallback: securities table
    const { data: securities } = await supabase
      .from("securities")
      .select("isin, yahoo_symbol")
      .in("isin", isins)

    const symbolByIsin: Record<string, string> = {}
    for (const s of securities ?? [])  if (s.isin && s.yahoo_symbol) symbolByIsin[s.isin] = s.yahoo_symbol
    for (const m of mappings  ?? [])   if (m.isin && m.yahoo_symbol) symbolByIsin[m.isin] = m.yahoo_symbol  // overrides

    // ── 3. Fetch USD → EUR rate (single rate, used for all history) ───────────
    const { rate: usdToEur } = await getFXRate("USD", "EUR", supabase)
    const gbpToEur            = usdToEur * 1.27  // approximate GBP/EUR via USD cross

    function toEur(price: number, currency: string): number {
      if (currency === "GBp") return (price / 100) * gbpToEur
      if (currency === "GBP") return price * gbpToEur
      if (currency === "USD") return price * usdToEur
      return price  // EUR or unknown → no conversion
    }

    // ── 4. Fetch historical prices for all symbols in parallel ────────────────
    const pricesByIsin: Record<string, Record<string, DayPrice>> = {}

    await Promise.allSettled(
      isins.map(async isin => {
        const symbol = symbolByIsin[isin]
        if (!symbol) return
        pricesByIsin[isin] = await fetchHistoricalPrices(symbol, firstDate, today)
      })
    )

    // ── 5. Group transactions by date ─────────────────────────────────────────
    type TxRow = typeof txs[0]
    const txByDate: Record<string, TxRow[]> = {}
    for (const tx of txs) {
      if (!tx.trade_date) continue
      ;(txByDate[tx.trade_date] ??= []).push(tx)
    }

    // ── 6. Replay transactions day by day ─────────────────────────────────────
    type Holding = { qty: number; cost: number }
    const holdings: Record<string, Holding> = {}  // key = "product__isin"
    let realizedPnL = 0
    const lastPriceEur: Record<string, number> = {}

    const history: {
      date: string; value: number; cost: number; pnl: number; realizedPnL: number
    }[] = []

    for (const date of dateRange(firstDate, today)) {
      // Apply transactions on this date
      for (const tx of txByDate[date] ?? []) {
        const key     = `${tx.product}__${tx.isin ?? ""}`
        const holding = (holdings[key] ??= { qty: 0, cost: 0 })
        const absQty  = Math.abs(Number(tx.quantity))
        const total   = Math.abs(Number(tx.total_eur))

        if (tx.transaction_type === "buy") {
          holding.qty  += absQty
          holding.cost += total
        } else if (tx.transaction_type === "sell") {
          const avgCost  = holding.qty > 0 ? holding.cost / holding.qty : 0
          const costSold = avgCost * absQty
          realizedPnL   += total - costSold
          holding.qty    = Math.max(0, holding.qty - absQty)
          holding.cost   = Math.max(0, holding.cost - costSold)
        }
      }

      // Skip weekends — markets are closed
      const dow = new Date(date + "T12:00:00Z").getUTCDay()
      if (dow === 0 || dow === 6) continue

      // Calculate portfolio value on this date
      let totalValue = 0
      let totalCost  = 0

      for (const [key, holding] of Object.entries(holdings)) {
        if (holding.qty <= 0) continue
        totalCost += holding.cost

        const isin       = key.split("__")[1]
        const isinPrices = pricesByIsin[isin]
        let   priceEur: number

        // Find price on or up to 5 trading days back (gap filling for holidays)
        if (isinPrices) {
          let found: DayPrice | undefined
          const checkDate = new Date(date + "T12:00:00Z")
          for (let gap = 0; gap < 6; gap++) {
            const d = checkDate.toISOString().split("T")[0]
            if (isinPrices[d]) { found = isinPrices[d]; break }
            checkDate.setUTCDate(checkDate.getUTCDate() - 1)
          }

          if (found) {
            priceEur = toEur(found.close, found.currency)
            lastPriceEur[isin] = priceEur
          } else {
            // Fall back to last known price, then cost-per-share
            priceEur = lastPriceEur[isin] ?? (holding.cost / holding.qty)
          }
        } else {
          // No Yahoo mapping — approximate with cost per share (P&L = 0 for this position)
          priceEur = holding.cost / holding.qty
        }

        totalValue += holding.qty * priceEur
      }

      if (totalValue === 0 && totalCost === 0) continue

      history.push({
        date,
        value:       Math.round(totalValue * 100) / 100,
        cost:        Math.round(totalCost  * 100) / 100,
        pnl:         Math.round((totalValue - totalCost + realizedPnL) * 100) / 100,
        realizedPnL: Math.round(realizedPnL * 100) / 100,
      })
    }

    // ── 7. Backfill portfolio_snapshots with reconstructed history ────────────
    // Delete all existing snapshots and replace with fresh data derived from
    // current transactions only — this ensures deleted/test positions don't linger.
    await supabase
      .from("portfolio_snapshots")
      .delete()
      .eq("portfolio_id", portfolioId)

    const toInsert = history.map(h => ({
        portfolio_id:     portfolioId,
        snapshot_date:    h.date,
        total_value:      h.value,
        total_cost:       h.cost,
        total_return:     h.pnl,
        total_return_pct: h.cost > 0 ? (h.pnl / h.cost) * 100 : 0,
        position_count:   0,
      }))

    // Insert in batches of 100 to stay within Supabase row limits
    for (let i = 0; i < toInsert.length; i += 100) {
      await supabase.from("portfolio_snapshots").insert(toInsert.slice(i, i + 100))
    }

    return NextResponse.json({ history, backfilled: toInsert.length })
  } catch (e: any) {
    console.error("[portfolio-history]", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
