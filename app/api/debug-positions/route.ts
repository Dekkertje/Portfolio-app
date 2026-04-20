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

  let historyRaw: any[] = []
  let historyError: string | null = null
  try {
    historyRaw = await yf2.historical(testSymbol, {
      period1: "2022-01-01",
      period2: new Date().toISOString().split("T")[0],
      events:  "div",
    })
  } catch (e: any) {
    historyError = e.message
  }

  // Show first 5 items and any with dividends > 0
  const first5  = historyRaw.slice(0, 5)
  const divRows = historyRaw.filter((h: any) => h.dividends && h.dividends > 0).slice(0, 10)
  const allKeys = first5.length > 0 ? Object.keys(first5[0]) : []

  // Also try without events filter — normal history, look for dividend field
  let normalFirst3: any[] = []
  try {
    const normal = await yf2.historical(testSymbol, {
      period1: "2024-01-01",
      period2: "2024-06-01",
    })
    normalFirst3 = normal.slice(0, 5).map((h: any) => ({
      date:      h.date,
      close:     h.close,
      dividends: h.dividends,
      keys:      Object.keys(h),
    }))
  } catch { /* ignore */ }

  if (!portfolioId) {
    return NextResponse.json({ testSymbol, historyError, totalRows: historyRaw.length, first5, divRows, allKeys, normalFirst3 })
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
    historyError,
    totalHistoryRows: historyRaw.length,
    allKeys,
    first5,
    divRows,
    normalFirst3,
    typeCounts,
    totalTransactions: txs?.length ?? 0,
  })
}
