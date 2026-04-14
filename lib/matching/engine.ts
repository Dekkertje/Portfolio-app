/**
 * Unified instrument matching engine.
 *
 * Priority chain (highest → lowest):
 *   1. Manual override   (user-approved, always wins)
 *   2. Exact ISIN + exchange match
 *   3. Exact ISIN + currency match
 *   4. Exact ISIN only (single listing in DB)
 *   5. Exact ISIN, multi-listing → prefer non-ADR on European exchange
 *   6. Fuzzy name match (score ≥ FUZZY_THRESHOLD)
 *   7. No match → manual input required
 *
 * Confidence thresholds:
 *   ≥ 0.95  auto-accepted, no review needed
 *   0.80–0.94  show in review with pre-approved state
 *   0.60–0.79  review mandatory
 *   < 0.60  treat as unmatched
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { similarity, normaliseName, bestNameScore } from "./string-utils"
import { normaliseMic, buildYahooSymbol, isEuropeanExchange } from "./exchange-map"

export const CONFIDENCE = {
  AUTO_ACCEPT:   0.95,
  REVIEW_SOFT:   0.80,
  REVIEW_HARD:   0.60,
} as const

const FUZZY_THRESHOLD = CONFIDENCE.REVIEW_HARD

// ─── Public types ────────────────────────────────────────────────────────────

export type BrokerPosition = {
  isin?: string | null
  product_name: string
  exchange?: string | null
  currency?: string | null
}

export type MatchStatus = "matched" | "ambiguous" | "unmatched"

export type MatchCandidate = {
  yahoo_symbol: string
  ticker: string
  name: string
  exchange: string
  currency: string
  is_adr: boolean
}

export type MatchResult = {
  status: MatchStatus
  yahoo_symbol: string | null
  ticker: string | null
  confidence: number
  method: string
  needs_review: boolean
  candidates?: MatchCandidate[]   // populated when status = "ambiguous"
}

// ─── Internal DB row shapes ───────────────────────────────────────────────────

type SecurityRow = {
  isin: string | null
  name: string
  ticker_symbol: string
  yahoo_symbol: string | null
  exchange: string | null
  currency: string
  alternative_names?: string[] | null
}

// ─── Main entry point ────────────────────────────────────────────────────────

export async function matchPosition(
  pos: BrokerPosition,
  supabase: SupabaseClient
): Promise<MatchResult> {

  // ── Step 0: Manual override (user beats everything) ──────────────────────
  const override = await findManualOverride(pos, supabase)
  if (override) {
    return {
      status:       "matched",
      yahoo_symbol: override.yahoo_symbol,
      ticker:       override.suggested_ticker ?? override.yahoo_symbol,
      confidence:   1.0,
      method:       "manual_override",
      needs_review: false,
    }
  }

  // ── Step 1–5: ISIN-based matching ─────────────────────────────────────────
  if (pos.isin) {
    const result = await matchByIsin(pos, supabase)
    if (result) return result
  }

  // ── Step 6: Fuzzy name matching ───────────────────────────────────────────
  const fuzzy = await matchByName(pos, supabase)
  if (fuzzy) return fuzzy

  // ── Step 7: No match ──────────────────────────────────────────────────────
  return {
    status:       "unmatched",
    yahoo_symbol: null,
    ticker:       null,
    confidence:   0,
    method:       "no_match",
    needs_review: true,
  }
}

// ─── Step 0: Manual override ─────────────────────────────────────────────────

async function findManualOverride(
  pos: BrokerPosition,
  supabase: SupabaseClient
) {
  // Check approved ticker_mappings first (existing table)
  if (pos.isin) {
    const { data } = await supabase
      .from("ticker_mappings")
      .select("yahoo_symbol, suggested_ticker")
      .eq("isin", pos.isin)
      .eq("is_approved", true)
      .limit(1)
      .maybeSingle()

    if (data) return data
  }

  // Fallback: match on product name (for positions without ISIN)
  const { data } = await supabase
    .from("ticker_mappings")
    .select("yahoo_symbol, suggested_ticker")
    .eq("product_name", pos.product_name)
    .eq("is_approved", true)
    .limit(1)
    .maybeSingle()

  return data ?? null
}

// ─── Steps 1–5: ISIN matching ────────────────────────────────────────────────

async function matchByIsin(
  pos: BrokerPosition,
  supabase: SupabaseClient
): Promise<MatchResult | null> {

  const { data: rows, error } = await supabase
    .from("securities")
    .select("isin, name, ticker_symbol, yahoo_symbol, exchange, currency, alternative_names")
    .eq("isin", pos.isin!)

  if (error || !rows || rows.length === 0) return null

  // Step 2: ISIN + exchange
  if (pos.exchange) {
    const mic = normaliseMic(pos.exchange)
    const match = rows.find(r => r.exchange && normaliseMic(r.exchange) === mic)
    if (match) {
      return buildResult(match, 0.98, "isin+exchange")
    }
  }

  // Step 3: ISIN + currency
  if (pos.currency) {
    const byCurrency = rows.filter(r => r.currency === pos.currency)
    if (byCurrency.length === 1) {
      return buildResult(byCurrency[0], 0.92, "isin+currency")
    }
    if (byCurrency.length > 1) {
      return buildAmbiguous(byCurrency, 0.82, "isin+currency_multi")
    }
  }

  // Step 4: ISIN only — single result
  if (rows.length === 1) {
    return buildResult(rows[0], 0.88, "isin_only")
  }

  // Step 5: ISIN, multiple listings — ADR filtering
  //  Prefer non-ADR on European exchange when broker exchange is European
  const nonAdr = rows.filter(r => !isAdr(r))
  if (nonAdr.length === 1 && isEuropeanExchange(pos.exchange ?? undefined)) {
    return buildResult(nonAdr[0], 0.84, "isin+nonadr_preference")
  }

  return buildAmbiguous(rows, 0.75, "isin_multilist")
}

// ─── Step 6: Fuzzy name matching ─────────────────────────────────────────────

async function matchByName(
  pos: BrokerPosition,
  supabase: SupabaseClient
): Promise<MatchResult | null> {

  // Use the first significant word as search anchor
  const firstWord = pos.product_name.trim().split(/\s+/)[0]
  if (firstWord.length < 2) return null

  const { data: rows } = await supabase
    .from("securities")
    .select("isin, name, ticker_symbol, yahoo_symbol, exchange, currency, alternative_names")
    .ilike("name", `%${firstWord}%`)
    .limit(10)

  if (!rows || rows.length === 0) return null

  const scored = rows
    .map(r => ({
      row:   r,
      score: bestNameScore(pos.product_name, [r.name, ...(r.alternative_names ?? [])]),
    }))
    .filter(s => s.score >= FUZZY_THRESHOLD)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return null

  const best = scored[0]

  // One clear winner
  if (scored.length === 1 || best.score - scored[1].score > 0.15) {
    // Downscale: name match is less reliable than ISIN
    return buildResult(best.row, best.score * 0.80, "name_fuzzy")
  }

  // Multiple close candidates
  return buildAmbiguous(
    scored.map(s => s.row),
    best.score * 0.70,
    "name_fuzzy_ambiguous"
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildResult(row: SecurityRow, confidence: number, method: string): MatchResult {
  const yahooSymbol = row.yahoo_symbol
    ?? buildYahooSymbol(row.ticker_symbol, row.exchange ?? undefined)

  return {
    status:       "matched",
    yahoo_symbol: yahooSymbol,
    ticker:       row.ticker_symbol,
    confidence,
    method,
    needs_review: confidence < CONFIDENCE.AUTO_ACCEPT,
  }
}

function buildAmbiguous(
  rows: SecurityRow[],
  confidence: number,
  method: string
): MatchResult {
  return {
    status:       "ambiguous",
    yahoo_symbol: null,
    ticker:       null,
    confidence,
    method,
    needs_review: true,
    candidates: rows.map(r => ({
      yahoo_symbol: r.yahoo_symbol
        ?? buildYahooSymbol(r.ticker_symbol, r.exchange ?? undefined),
      ticker:   r.ticker_symbol,
      name:     r.name,
      exchange: r.exchange ?? "UNKNOWN",
      currency: r.currency,
      is_adr:   isAdr(r),
    })),
  }
}

/** Heuristic: US-listed security for a non-US company is likely an ADR */
function isAdr(row: SecurityRow): boolean {
  if (!row.isin || !row.exchange) return false
  const isUsListed = normaliseMic(row.exchange) === "XNAS" || normaliseMic(row.exchange) === "XNYS"
  const isNonUsCorp = !row.isin.startsWith("US")
  return isUsListed && isNonUsCorp
}
