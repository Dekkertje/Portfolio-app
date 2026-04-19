import { NextRequest, NextResponse } from "next/server"
import { matchPosition }          from "@/lib/matching/engine"
import { getDetailedMetrics, getPositionNews, getHistoricalChart } from "@/lib/providers/yahoo"
import { isCrypto, getCryptoYahooSymbol } from "@/lib/utils"
import { createServiceSupabaseClient } from "@/lib/supabase/server"

// GET /api/position-detail?product=...&isin=...&yahooSymbol=...
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const product     = searchParams.get("product") ?? ""
  const isin        = searchParams.get("isin") || null
  const passedSymbol = searchParams.get("yahooSymbol") || null

  if (!product) {
    return NextResponse.json({ error: "product is required" }, { status: 400 })
  }

  // ── Resolve Yahoo symbol ───────────────────────────────────────────────────
  let yahooSymbol: string | null = passedSymbol

  if (!yahooSymbol) {
    if (isCrypto(product, isin)) {
      if (isin && /^[A-Z0-9]+-[A-Z]{3}$/i.test(isin)) {
        yahooSymbol = isin.toUpperCase()
      } else {
        yahooSymbol = getCryptoYahooSymbol(product, isin)
      }
    } else {
      const supabase = createServiceSupabaseClient()
      const match = await matchPosition({ isin, product_name: product }, supabase)
      yahooSymbol = match.yahoo_symbol
    }
  }

  if (!yahooSymbol) {
    return NextResponse.json({ error: `Geen Yahoo symbol gevonden voor ${product}` }, { status: 404 })
  }

  // ── Fetch data in parallel ─────────────────────────────────────────────────
  const [metrics, news, chart] = await Promise.all([
    getDetailedMetrics(yahooSymbol),
    getPositionNews(yahooSymbol),
    getHistoricalChart(yahooSymbol, "1y"),
  ])

  return NextResponse.json({ symbol: yahooSymbol, metrics, news, chart })
}
