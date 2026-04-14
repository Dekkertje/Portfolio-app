/**
 * FX rate service.
 *
 * Strategy:
 *   1. DB cache (fx_rates table) — avoids redundant API calls within the same day
 *   2. Yahoo Finance live fetch
 *   3. Hardcoded fallback rates — used only when both above fail (prevents crash)
 *
 * All rates are stored as "quote currency per 1 base currency".
 * e.g.  base=USD, quote=EUR, rate=0.92  →  1 USD = 0.92 EUR
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { getFXRateFromYahoo } from "./yahoo"

// ─── Fallback rates (updated periodically — last updated 2026-04) ─────────────
// These are intentionally conservative estimates, not trading rates.

const FALLBACK_RATES: Record<string, number> = {
  "USD/EUR": 0.92,
  "EUR/USD": 1.09,
  "GBP/EUR": 1.17,
  "EUR/GBP": 0.86,
  "USD/GBP": 0.79,
  "GBP/USD": 1.27,
  "CHF/EUR": 1.04,
  "EUR/CHF": 0.96,
  "SEK/EUR": 0.087,
  "NOK/EUR": 0.086,
  "DKK/EUR": 0.134,
}

function fallbackKey(base: string, quote: string): string {
  return `${base.toUpperCase()}/${quote.toUpperCase()}`
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type FXResult = {
  rate:   number
  source: "cache" | "yahoo" | "fallback"
}

/**
 * Get the FX rate for `base → quote` (e.g. USD → EUR).
 *
 * Reads from the DB cache first; fetches from Yahoo if stale/absent;
 * falls back to a hardcoded rate if Yahoo is unavailable.
 *
 * @param supabase — pass null to skip DB caching (useful in scripts/tests)
 */
export async function getFXRate(
  base: string,
  quote: string,
  supabase: SupabaseClient | null
): Promise<FXResult> {
  const b = base.toUpperCase()
  const q = quote.toUpperCase()

  if (b === q) return { rate: 1, source: "cache" }

  // ── 1. DB cache ────────────────────────────────────────────────────────────
  if (supabase) {
    const today = new Date().toISOString().split("T")[0]
    const { data } = await supabase
      .from("fx_rates")
      .select("rate")
      .eq("base_currency", b)
      .eq("quote_currency", q)
      .eq("rate_date", today)
      .maybeSingle()

    if (data?.rate) {
      return { rate: Number(data.rate), source: "cache" }
    }
  }

  // ── 2. Yahoo Finance ───────────────────────────────────────────────────────
  const live = await getFXRateFromYahoo(b, q)

  if (live !== null) {
    // Persist to cache
    if (supabase) {
      const today = new Date().toISOString().split("T")[0]
      await supabase
        .from("fx_rates")
        .upsert(
          {
            base_currency:  b,
            quote_currency: q,
            rate:           live,
            rate_date:      today,
            source:         "yahoo",
          },
          { onConflict: "base_currency,quote_currency,rate_date" }
        )
    }
    return { rate: live, source: "yahoo" }
  }

  // ── 3. Fallback ────────────────────────────────────────────────────────────
  const direct   = FALLBACK_RATES[fallbackKey(b, q)]
  if (direct !== undefined) {
    console.warn(`[fx] Using fallback rate for ${b}/${q}: ${direct}`)
    return { rate: direct, source: "fallback" }
  }

  // Try inverse
  const inverse  = FALLBACK_RATES[fallbackKey(q, b)]
  if (inverse !== undefined && inverse > 0) {
    const rate = 1 / inverse
    console.warn(`[fx] Using inverted fallback rate for ${b}/${q}: ${rate.toFixed(6)}`)
    return { rate, source: "fallback" }
  }

  // Last resort: 1.0 (better than crashing, but logged as a warning)
  console.error(`[fx] No rate available for ${b}/${q} — returning 1.0`)
  return { rate: 1, source: "fallback" }
}

/**
 * Convert `amount` from `fromCurrency` to `toCurrency`.
 * Convenience wrapper around getFXRate.
 */
export async function convert(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  supabase: SupabaseClient | null
): Promise<{ value: number; rate: number; source: FXResult["source"] }> {
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
    return { value: amount, rate: 1, source: "cache" }
  }
  const { rate, source } = await getFXRate(fromCurrency, toCurrency, supabase)
  return { value: amount * rate, rate, source }
}
