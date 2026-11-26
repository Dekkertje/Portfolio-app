import { NextResponse } from "next/server"
import { ownPortfolio } from "@/lib/portfolio/owner"
import { searchSymbol } from "@/lib/providers/yahoo"
import { createRouteHandlerClient } from "@/lib/supabase/server"

export type InstrumentHit = {
  /** Bestaand instrument in de app */
  id: string | null
  symbol: string | null
  name: string
  exchange: string | null
  type: string | null
  isin: string | null
}

// Yahoo-soorten die je kunt kopen, met Nederlandse naam (futures, opties, indexen e.d. vallen af)
const TYPES: Record<string, string> = { Equity: "Aandeel", ETF: "ETF", Fund: "Fonds", "Mutual Fund": "Fonds", Cryptocurrency: "Crypto" }

// GET /api/v2/instruments/search?q=… — eerst bekende effecten, dan Yahoo
export async function GET(request: Request) {
  const db = createRouteHandlerClient(request)
  const owner = await ownPortfolio(db)
  if (!owner) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 })

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim()
  if (q.length < 2) return NextResponse.json({ hits: [] })

  // Komma's en procenttekens zouden het or-filter van PostgREST breken
  const safe = q.replace(/[,%()]/g, " ")
  const [{ data: known }, yahoo] = await Promise.all([
    db
      .from("instruments")
      .select("id, name, isin, yahoo_symbol, kind, exchange")
      .or(`name.ilike.%${safe}%,yahoo_symbol.ilike.%${safe}%,isin.ilike.%${safe}%`)
      .limit(5),
    searchSymbol(q).catch(() => []),
  ])

  const hits: InstrumentHit[] = (known ?? []).map((i) => ({
    id: i.id,
    symbol: i.yahoo_symbol,
    name: i.name,
    exchange: i.exchange,
    type: i.kind === "etf" ? "ETF" : i.kind === "crypto" ? "Crypto" : "Aandeel",
    isin: i.isin.startsWith("SYM:") ? null : i.isin,
  }))
  const seen = new Set(hits.map((h) => h.symbol))
  for (const y of yahoo) {
    if (seen.has(y.symbol) || !TYPES[y.typeDisp]) continue
    hits.push({ id: null, symbol: y.symbol, name: y.longname || y.shortname, exchange: y.exchDisp || null, type: TYPES[y.typeDisp], isin: null })
    seen.add(y.symbol)
  }
  return NextResponse.json({ hits: hits.slice(0, 10) })
}
