/**
 * Koppelt instrumenten zonder Yahoo-symbool via de bestaande matching-engine
 * (ticker_mappings → securities → OpenFIGI → naam), met Yahoo-zoeken op ISIN als
 * laatste redmiddel. Zekere matches worden goedgekeurd, twijfelgevallen "suggested".
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { CONFIDENCE, matchPosition } from "@/lib/matching/engine"
import { searchSymbol } from "@/lib/providers/yahoo"

export type MatchOutcome = { id: string; name: string; isin: string; symbol: string | null; status: "approved" | "suggested" | "unmatched" }

export async function matchInstruments(service: SupabaseClient, instrumentIds: string[]): Promise<MatchOutcome[]> {
  if (!instrumentIds.length) return []
  const { data, error } = await service
    .from("instruments")
    .select("id, isin, name, exchange, currency, yahoo_symbol, symbol_status")
    .in("id", instrumentIds)
    .is("yahoo_symbol", null)
  if (error) throw new Error(`Instrumenten ophalen mislukt: ${error.message}`)

  const outcomes: MatchOutcome[] = []
  for (const inst of data ?? []) {
    let symbol: string | null = null
    let confidence = 0
    let method = "none"
    try {
      const m = await matchPosition({ isin: inst.isin, product_name: inst.name, exchange: inst.exchange, currency: inst.currency }, service)
      if (m.yahoo_symbol) {
        symbol = m.yahoo_symbol
        confidence = m.confidence
        method = m.method
      }
    } catch {
      // val door naar Yahoo-zoeken
    }
    if (!symbol) {
      const hits = await searchSymbol(inst.isin).catch(() => [])
      if (hits[0]) {
        symbol = hits[0].symbol
        confidence = 0.8
        method = "yahoo_search_isin"
      }
    }

    const status: MatchOutcome["status"] = !symbol ? "unmatched" : confidence >= CONFIDENCE.REVIEW_SOFT ? "approved" : "suggested"
    if (symbol) {
      await service
        .from("instruments")
        .update({ yahoo_symbol: symbol, symbol_status: status, match_confidence: Math.min(confidence, 0.99), match_method: method, updated_at: new Date().toISOString() })
        .eq("id", inst.id)
    }
    outcomes.push({ id: inst.id, name: inst.name, isin: inst.isin, symbol, status })
  }
  return outcomes
}
