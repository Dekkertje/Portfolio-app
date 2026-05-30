import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@/lib/supabase/server"
import { matchPosition } from "@/lib/matching/engine"

// GET /api/ticker-mapping?pending=1  — list unapproved mappings
// GET /api/ticker-mapping?pending=1&count=1  — just the count
export async function GET(request: Request) {
  const supabase = createRouteHandlerClient(request)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const countOnly = url.searchParams.get("count") === "1"

  const query = supabase
    .from("ticker_mappings")
    .select("id, isin, product_name, suggested_ticker, yahoo_symbol, confidence_score, match_method, created_at")
    .eq("is_approved", false)
    .order("created_at", { ascending: false })

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (countOnly) return NextResponse.json({ count: data?.length ?? 0 })
  return NextResponse.json({ mappings: data ?? [] })
}

// PATCH /api/ticker-mapping
// Body: { id, yahoo_symbol, suggested_ticker, approve: true } — approve/update a mapping
// Body: { id, reject: true } — delete a mapping
export async function PATCH(request: Request) {
  const supabase = createRouteHandlerClient(request)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { id?: string; yahoo_symbol?: string; suggested_ticker?: string; approve?: boolean; reject?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 })

  if (body.reject) {
    const { error } = await supabase.from("ticker_mappings").delete().eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabase
    .from("ticker_mappings")
    .update({
      is_approved: true,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      ...(body.yahoo_symbol    ? { yahoo_symbol: body.yahoo_symbol }       : {}),
      ...(body.suggested_ticker ? { suggested_ticker: body.suggested_ticker } : {}),
    })
    .eq("id", body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// POST /api/ticker-mapping
// Body: { positions: Array<{ isin, product, exchange, currency? }> }
// Returns: { suggestions: MatchSuggestion[] }

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient(request)

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { positions?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!Array.isArray(body.positions)) {
    return NextResponse.json({ error: "positions must be an array" }, { status: 400 })
  }

  const suggestions = await Promise.all(
    body.positions.map(async (pos: any) => {
      const result = await matchPosition(
        {
          isin:         pos.isin     ?? null,
          product_name: pos.product  ?? pos.product_name ?? "",
          exchange:     pos.exchange ?? null,
          currency:     pos.currency ?? null,
        },
        supabase
      )

      return {
        isin:             pos.isin ?? null,
        product:          pos.product ?? pos.product_name ?? "",
        exchange:         pos.exchange ?? null,
        suggested_ticker: result.ticker,
        yahoo_symbol:     result.yahoo_symbol,
        confidence_score: result.confidence,
        match_method:     result.method,
        is_approved:      result.method === "manual_override",
        needs_review:     result.needs_review,
        candidates:       result.candidates ?? [],
      }
    })
  )

  return NextResponse.json({ suggestions })
}
