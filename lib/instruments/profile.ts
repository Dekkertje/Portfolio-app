/**
 * Profielgegevens via Yahoo quoteSummary (yahoo-finance2 regelt de sessie-crumb):
 * soort (aandeel/ETF), sector, branche en land voor aandelen, en de sectorverdeling
 * van de onderliggende aandelen voor ETF's en fondsen.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import YahooFinance from "yahoo-finance2"
import { sectorKey, type SectorKey, type SectorWeights } from "./sectors"

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] })

/** Maatstaf voor "welke sectoren mis ik": iShares Core MSCI World */
export const BENCHMARK = { key: "benchmark_sectors", symbol: "IWDA.AS", label: "MSCI World" }

const PROFILE_MAX_AGE_DAYS = 30

export type InstrumentProfile = {
  quoteType: string | null
  sector: SectorKey | null
  industry: string | null
  country: string | null
  sectorWeights: SectorWeights | null
}

export async function fetchProfile(symbol: string): Promise<InstrumentProfile | null> {
  try {
    const r = await yf.quoteSummary(symbol, { modules: ["price", "assetProfile", "topHoldings"] })
    let sectorWeights: SectorWeights | null = null
    const raw = r.topHoldings?.sectorWeightings as Record<string, number>[] | undefined
    if (raw?.length) {
      sectorWeights = {}
      for (const entry of raw) {
        for (const [name, w] of Object.entries(entry)) {
          const key = sectorKey(name)
          if (key && typeof w === "number" && w > 0) sectorWeights[key] = (sectorWeights[key] ?? 0) + w
        }
      }
      if (!Object.keys(sectorWeights).length) sectorWeights = null
    }
    return {
      quoteType: r.price?.quoteType ?? null,
      sector: sectorKey(r.assetProfile?.sector),
      industry: r.assetProfile?.industry ?? null,
      country: r.assetProfile?.country ?? null,
      sectorWeights,
    }
  } catch {
    return null
  }
}

const KIND_BY_QUOTE_TYPE: Record<string, string> = { EQUITY: "stock", ETF: "etf", MUTUALFUND: "fund", CRYPTOCURRENCY: "crypto" }

/**
 * Ververst profielen die ontbreken of ouder zijn dan 30 dagen (of alleen `instrumentIds`),
 * plus de sectorverdeling van de maatstaf. Vereist de service-role client.
 */
export async function refreshProfiles(service: SupabaseClient, opts: { instrumentIds?: string[]; force?: boolean } = {}): Promise<number> {
  const cutoff = new Date(Date.now() - PROFILE_MAX_AGE_DAYS * 86_400_000).toISOString()
  let query = service.from("instruments").select("id, yahoo_symbol").not("yahoo_symbol", "is", null)
  if (opts.instrumentIds) query = query.in("id", opts.instrumentIds)
  if (!opts.force) query = query.or(`profile_updated_at.is.null,profile_updated_at.lt.${cutoff}`)
  const { data } = await query.limit(60)

  let updated = 0
  for (const inst of data ?? []) {
    const p = await fetchProfile(inst.yahoo_symbol as string)
    if (!p) continue
    const patch: Record<string, unknown> = {
      quote_type: p.quoteType,
      sector: p.sector,
      industry: p.industry,
      country: p.country,
      sector_weights: p.sectorWeights,
      profile_updated_at: new Date().toISOString(),
    }
    if (p.quoteType && KIND_BY_QUOTE_TYPE[p.quoteType]) patch.kind = KIND_BY_QUOTE_TYPE[p.quoteType]
    await service.from("instruments").update(patch).eq("id", inst.id)
    updated++
  }

  const { data: bench } = await service.from("reference_data").select("updated_at").eq("key", BENCHMARK.key).maybeSingle()
  if (opts.force || !bench || bench.updated_at < cutoff) {
    const p = await fetchProfile(BENCHMARK.symbol)
    if (p?.sectorWeights) {
      await service
        .from("reference_data")
        .upsert({ key: BENCHMARK.key, value: { label: BENCHMARK.label, symbol: BENCHMARK.symbol, weights: p.sectorWeights }, updated_at: new Date().toISOString() })
    }
  }
  return updated
}
