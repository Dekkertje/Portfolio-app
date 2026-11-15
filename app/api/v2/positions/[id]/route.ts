import { NextResponse } from "next/server"
import type { Currency, IsoDate } from "@/lib/core"
import { loadLedger } from "@/lib/ledger/repository"
import { buildPositionDetail } from "@/lib/portfolio/position"
import { refreshStaleQuotes } from "@/lib/prices/refresh"
import { createRouteHandlerClient, createServiceSupabaseClient } from "@/lib/supabase/server"

const PAGE = 1000

// GET /api/v2/positions/[id] — detail van één positie (id = instruments.id)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
  if (!portfolio) return NextResponse.json({ error: "Geen portfolio" }, { status: 404 })

  const { events, instruments } = await loadLedger(db, portfolio.id)
  const inst = instruments.get(id)
  const mine = events.filter((e) => e.instrumentId === id)
  if (!inst || !mine.length) return NextResponse.json({ error: "Positie niet gevonden" }, { status: 404 })

  if (inst.yahoo_symbol) await refreshStaleQuotes(createServiceSupabaseClient(), [{ id, symbol: inst.yahoo_symbol }]).catch(() => 0)

  const since = mine.reduce((m, e) => (e.date < m ? e.date : m), mine[0].date)
  const closes: [IsoDate, number, Currency][] = []
  for (let from = 0; ; from += PAGE) {
    const { data } = await db
      .from("daily_prices")
      .select("price_date, close, currency")
      .eq("instrument_id", id)
      .gte("price_date", since)
      .order("price_date")
      .range(from, from + PAGE - 1)
    for (const r of data ?? []) closes.push([r.price_date, Number(r.close), r.currency])
    if (!data || data.length < PAGE) break
  }

  const currency = closes.at(-1)?.[2] ?? null
  const fx: [Currency, IsoDate, number][] = []
  if (currency && currency !== "EUR") {
    for (let from = 0; ; from += PAGE) {
      const { data } = await db
        .from("fx_rates")
        .select("rate_date, rate")
        .eq("base_currency", currency)
        .eq("quote_currency", "EUR")
        .gte("rate_date", since)
        .order("rate_date")
        .range(from, from + PAGE - 1)
      for (const r of data ?? []) fx.push([currency, r.rate_date, Number(r.rate)])
      if (!data || data.length < PAGE) break
    }
  }

  const { data: q } = await db.from("latest_quotes").select("price, previous_close, currency").eq("instrument_id", id).maybeSingle()

  const detail = buildPositionDetail({
    instrumentId: id,
    instrument: { id, name: inst.name, isin: inst.isin, symbol: inst.yahoo_symbol, kind: inst.kind, sector: inst.sector, country: inst.country, currency },
    events,
    closes,
    fx,
    quote: q ? { price: Number(q.price), previousClose: q.previous_close == null ? null : Number(q.previous_close), currency: q.currency } : null,
    today: new Date().toISOString().slice(0, 10),
  })
  return NextResponse.json(detail, { headers: { "Cache-Control": "private, no-store" } })
}
