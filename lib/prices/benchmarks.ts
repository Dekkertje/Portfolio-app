import type { SupabaseClient } from "@supabase/supabase-js"
import { BENCHMARKS } from "@/lib/benchmarks"
import { minusDays } from "./sync"
import { fetchChart } from "./yahoo-chart"

/** Eerste datum die we ophalen als er nog niets is (ruim vóór de oudste portfolio's) */
const HISTORY_START = "2018-01-01"

/** Werkt de slotkoersen van alle vergelijkingsindexen bij. Vereist de service-role client. */
export async function syncBenchmarks(service: SupabaseClient): Promise<{ rows: number; errors: string[] }> {
  let rows = 0
  const errors: string[] = []
  for (const b of BENCHMARKS) {
    try {
      const { data: last } = await service
        .from("benchmark_prices")
        .select("price_date")
        .eq("symbol", b.symbol)
        .order("price_date", { ascending: false })
        .limit(1)
        .maybeSingle()
      const from = last?.price_date ? minusDays(last.price_date, 7) : HISTORY_START
      const chart = await fetchChart(b.symbol, from)
      if (!chart) {
        errors.push(`${b.symbol}: onbekend bij Yahoo`)
        continue
      }
      const now = new Date().toISOString()
      const upserts = chart.closes.map((c) => ({ symbol: b.symbol, price_date: c.date, close: c.close, fetched_at: now }))
      for (let i = 0; i < upserts.length; i += 500) {
        const { error } = await service.from("benchmark_prices").upsert(upserts.slice(i, i + 500), { onConflict: "symbol,price_date" })
        if (error) throw new Error(error.message)
      }
      rows += upserts.length
    } catch (e) {
      errors.push(`${b.symbol}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { rows, errors }
}
