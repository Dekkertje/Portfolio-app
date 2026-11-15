import { NextResponse } from "next/server"
import { buildState } from "@/lib/core"
import { loadLedger } from "@/lib/ledger/repository"
import { buildOverview, type MarketData, type OverviewInstrument, type OverviewQuote } from "@/lib/portfolio/overview"
import { refreshStaleQuotes } from "@/lib/prices/refresh"
import { createRouteHandlerClient, createServiceSupabaseClient } from "@/lib/supabase/server"

export const maxDuration = 30

// GET /api/v2/overview — volledig portfolio-overzicht, server-side berekend uit het grootboek
export async function GET(request: Request) {
  const db = createRouteHandlerClient(request)
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 })

  const { data: portfolio } = await db
    .from("portfolios")
    .select("id")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!portfolio) return NextResponse.json({ empty: true })

  const { events, instruments } = await loadLedger(db, portfolio.id)
  if (!events.length) return NextResponse.json({ empty: true })

  // Actuele koersen verversen voor open posities (service role: referentiedata)
  const held = buildState(events).positions
  const toRefresh = [...instruments.values()]
    .filter((i) => i.yahoo_symbol && (held.get(i.id)?.quantity ?? 0) > 0)
    .map((i) => ({ id: i.id, symbol: i.yahoo_symbol! }))

  const [, marketResult] = await Promise.all([
    refreshStaleQuotes(createServiceSupabaseClient(), toRefresh).catch(() => 0),
    db.rpc("portfolio_market_data", { p_portfolio_id: portfolio.id }),
  ])
  if (marketResult.error) {
    return NextResponse.json({ error: `Koersen laden mislukt: ${marketResult.error.message}` }, { status: 500 })
  }

  const { data: quoteRows } = await db
    .from("latest_quotes")
    .select("instrument_id, price, previous_close, currency, quoted_at, market_state")
    .in("instrument_id", [...instruments.keys()])

  const quotes = new Map<string, OverviewQuote>(
    (quoteRows ?? []).map((q) => [
      q.instrument_id,
      {
        instrumentId: q.instrument_id,
        price: Number(q.price),
        previousClose: q.previous_close == null ? null : Number(q.previous_close),
        currency: q.currency,
        quotedAt: q.quoted_at,
        marketState: q.market_state,
      },
    ]),
  )

  const overviewInstruments = new Map<string, OverviewInstrument>(
    [...instruments.values()].map((i) => [i.id, { id: i.id, name: i.name, isin: i.isin, kind: i.kind, symbol: i.yahoo_symbol }]),
  )

  const overview = buildOverview({
    events,
    instruments: overviewInstruments,
    quotes,
    market: marketResult.data as MarketData,
    today: new Date().toISOString().slice(0, 10),
  })

  return NextResponse.json(overview, { headers: { "Cache-Control": "private, no-store" } })
}
