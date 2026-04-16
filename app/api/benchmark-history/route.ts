import { NextResponse } from "next/server"

// Yahoo Finance symbols per benchmark
const BENCHMARK_SYMBOLS: Record<string, string> = {
  sp500:      "^GSPC",
  nasdaq100:  "^NDX",
  aex:        "^AEX",
  msci_world: "URTH",   // iShares MSCI World ETF — best available proxy via Yahoo
}

// Map period to Yahoo Finance range parameter
function periodToRange(period: string): string {
  switch (period) {
    case "1W":  return "5d"
    case "1M":  return "1mo"
    case "3M":  return "3mo"
    case "6M":  return "6mo"
    case "YTD": return "ytd"
    case "1Y":  return "1y"
    case "ALL": return "5y"
    default:    return "1y"
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const benchmarkType = searchParams.get("benchmark") ?? "sp500"
  const period        = searchParams.get("period")    ?? "1Y"
  const fromDate      = searchParams.get("from")      // optional custom start YYYY-MM-DD
  const toDate        = searchParams.get("to")        // optional custom end   YYYY-MM-DD

  const symbol = BENCHMARK_SYMBOLS[benchmarkType]
  if (!symbol) {
    return NextResponse.json({ error: `Unknown benchmark: ${benchmarkType}` }, { status: 400 })
  }

  // Build Yahoo Finance chart URL
  let url: string
  if (fromDate && toDate) {
    const from = Math.floor(new Date(fromDate).getTime() / 1000)
    const to   = Math.floor(new Date(toDate).getTime()   / 1000)
    url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${from}&period2=${to}`
  } else {
    const range = periodToRange(period)
    url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`
  }

  let res: Response
  try {
    res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
  } catch (e) {
    return NextResponse.json({ error: `Fetch failed: ${String(e)}` }, { status: 502 })
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Yahoo returned ${res.status}` }, { status: 502 })
  }

  const json   = await res.json()
  const result = json?.chart?.result?.[0]

  if (!result) {
    return NextResponse.json({ error: "No data from Yahoo Finance" }, { status: 502 })
  }

  const timestamps: number[]        = result.timestamp ?? []
  const closes:     (number | null)[] = result.indicators?.adjclose?.[0]?.adjclose
    ?? result.indicators?.quote?.[0]?.close
    ?? []

  if (timestamps.length === 0 || closes.length === 0) {
    return NextResponse.json({ error: "Empty price series" }, { status: 502 })
  }

  // Build daily series, skip null closes
  const raw: { date: string; close: number }[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i]
    if (close == null || close <= 0) continue
    const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0]
    raw.push({ date, close })
  }

  if (raw.length === 0) {
    return NextResponse.json({ error: "All closes were null" }, { status: 502 })
  }

  // Normalise: first close = 0%, each subsequent point = % change from first
  const base = raw[0].close
  const history = raw.map(p => ({
    date:  p.date,
    value: ((p.close / base) - 1) * 100,   // e.g. +8.3 means +8.3%
    close: p.close,
  }))

  return NextResponse.json({ history, symbol, benchmarkType })
}
