import { NextResponse } from "next/server"
import { refreshProfiles } from "@/lib/instruments/profile"
import { ManualError, resolveInstrument } from "@/lib/ledger/manual"
import { refreshStaleQuotes } from "@/lib/prices/refresh"
import { createRouteHandlerClient, createServiceSupabaseClient } from "@/lib/supabase/server"

export type WatchItem = {
  instrumentId: string
  name: string
  symbol: string | null
  kind: string
  price: number | null
  previousClose: number | null
  currency: string | null
  dayChangePct: number | null
  addedAt: string
}

async function user(db: ReturnType<typeof createRouteHandlerClient>) {
  const { data } = await db.auth.getUser()
  return data.user
}

// GET /api/v2/watchlist — gevolgde effecten met actuele koers
export async function GET(request: Request) {
  const db = createRouteHandlerClient(request)
  const u = await user(db)
  if (!u) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 })

  const { data: rows } = await db
    .from("watchlist")
    .select("instrument_id, created_at, instruments(id, name, yahoo_symbol, kind)")
    .eq("user_id", u.id)
    .order("created_at", { ascending: false })
  type Row = { instrument_id: string; created_at: string; instruments: { id: string; name: string; yahoo_symbol: string | null; kind: string } | null }
  const list = ((rows ?? []) as unknown as Row[]).filter((r) => r.instruments)

  const withSymbol = list.filter((r) => r.instruments!.yahoo_symbol).map((r) => ({ id: r.instrument_id, symbol: r.instruments!.yahoo_symbol! }))
  await refreshStaleQuotes(createServiceSupabaseClient(), withSymbol).catch(() => 0)

  const { data: quotes } = await db
    .from("latest_quotes")
    .select("instrument_id, price, previous_close, currency")
    .in("instrument_id", list.map((r) => r.instrument_id))
  const q = new Map((quotes ?? []).map((x) => [x.instrument_id as string, x]))

  const items: WatchItem[] = list.map((r) => {
    const quote = q.get(r.instrument_id)
    const price = quote ? Number(quote.price) : null
    const prev = quote?.previous_close != null ? Number(quote.previous_close) : null
    return {
      instrumentId: r.instrument_id,
      name: r.instruments!.name,
      symbol: r.instruments!.yahoo_symbol,
      kind: r.instruments!.kind,
      price,
      previousClose: prev,
      currency: quote?.currency ?? null,
      dayChangePct: price != null && prev ? price / prev - 1 : null,
      addedAt: r.created_at,
    }
  })
  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } })
}

// POST /api/v2/watchlist — { instrument: { id } | { symbol, name, isin } }
export async function POST(request: Request) {
  const db = createRouteHandlerClient(request)
  const u = await user(db)
  if (!u) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { instrument?: { id?: string; symbol?: string; isin?: string | null; name?: string } } | null
  if (!body?.instrument) return NextResponse.json({ error: "Kies een effect" }, { status: 400 })

  const service = createServiceSupabaseClient()
  try {
    const instrumentId = await resolveInstrument(service, body.instrument)
    const { count } = await db.from("watchlist").select("id", { count: "exact", head: true }).eq("user_id", u.id)
    if ((count ?? 0) >= 50) return NextResponse.json({ error: "Maximaal 50 effecten op je volglijst" }, { status: 429 })
    const { error } = await db.from("watchlist").upsert({ user_id: u.id, instrument_id: instrumentId }, { onConflict: "user_id,instrument_id", ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await refreshProfiles(service, { instrumentIds: [instrumentId] }).catch(() => 0)
    return NextResponse.json({ instrumentId }, { status: 201 })
  } catch (e) {
    if (e instanceof ManualError) return NextResponse.json({ error: e.message }, { status: 422 })
    throw e
  }
}

// DELETE /api/v2/watchlist?id=<instrumentId>
export async function DELETE(request: Request) {
  const db = createRouteHandlerClient(request)
  const u = await user(db)
  if (!u) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 })
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Geen effect opgegeven" }, { status: 400 })
  await db.from("watchlist").delete().eq("user_id", u.id).eq("instrument_id", id)
  return NextResponse.json({ ok: true })
}
