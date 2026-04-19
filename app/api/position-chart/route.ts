import { NextRequest, NextResponse } from "next/server"
import { getHistoricalChart, YahooChartRange } from "@/lib/providers/yahoo"

const VALID_RANGES: YahooChartRange[] = ["1wk", "1mo", "3mo", "6mo", "1y", "5y"]

// GET /api/position-chart?symbol=AAPL&range=6mo
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const symbol = searchParams.get("symbol")
  const range  = (searchParams.get("range") ?? "1y") as YahooChartRange

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 })
  }

  if (!VALID_RANGES.includes(range)) {
    return NextResponse.json({ error: "invalid range" }, { status: 400 })
  }

  const chart = await getHistoricalChart(symbol, range)
  return NextResponse.json({ chart })
}
