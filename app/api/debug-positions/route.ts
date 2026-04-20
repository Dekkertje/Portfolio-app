import { NextRequest, NextResponse } from "next/server"
import { createServiceSupabaseClient } from "@/lib/supabase/server"

// GET /api/debug-positions?portfolio_id=...&symbol=ASML.AS
export async function GET(req: NextRequest) {
  const portfolioId = req.nextUrl.searchParams.get("portfolio_id")
  const testSymbol  = req.nextUrl.searchParams.get("symbol") ?? "ASML.AS"

  // Test yf2.historical with div events on a known dividend payer
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const yf2Pkg = require("yahoo-finance2")
  const yf2 = new yf2Pkg.default({ suppressNotices: ["yahooSurvey"] })

  // Test chart API for dividend events
  let chartDividends: any[] = []
  let chartError: string | null = null
  try {
    const p1 = Math.floor(new Date("2022-01-01").getTime() / 1000)
    const p2 = Math.floor(Date.now() / 1000)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(testSymbol)}?events=div&period1=${p1}&period2=${p2}&interval=1mo`
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } })
    const json = await res.json()
    const divMap = json?.chart?.result?.[0]?.events?.dividends ?? {}
    chartDividends = Object.values(divMap).map((d: any) => ({
      date:   new Date(d.date * 1000).toISOString().split("T")[0],
      amount: d.amount,
    }))
  } catch (e: any) {
    chartError = e.message
  }

  const historyError = null
  const first5: any[] = []
  const divRows = chartDividends
  const allKeys: string[] = []
  const normalFirst3: any[] = []

  if (!portfolioId) {
    return NextResponse.json({ testSymbol, chartError, chartDividends, first5, divRows, allKeys, normalFirst3 })
  }

  const supabase = createServiceSupabaseClient()
  const { data: txs } = await supabase
    .from("transactions")
    .select("product, isin, transaction_type, quantity, trade_date")
    .eq("portfolio_id", portfolioId)
    .order("trade_date", { ascending: true })

  const typeCounts: Record<string, number> = {}
  for (const tx of txs ?? []) {
    const t = tx.transaction_type ?? "(null)"
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }

  return NextResponse.json({
    testSymbol,
    chartError,
    chartDividends,
    typeCounts,
    totalTransactions: txs?.length ?? 0,
  })
}
