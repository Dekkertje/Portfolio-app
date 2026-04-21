import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@/lib/supabase/server"
import { matchPosition } from "@/lib/matching/engine"

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
