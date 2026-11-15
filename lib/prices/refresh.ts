/**
 * Actuele koersen on-demand verversen (de cron draait maar één keer per dag).
 * Alleen voor instrumenten waarvan de laatste quote ouder is dan `maxAgeMinutes`.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { minusDays } from "./sync"
import { fetchChart } from "./yahoo-chart"

const CONCURRENCY = 4

export async function refreshStaleQuotes(
  service: SupabaseClient,
  instruments: { id: string; symbol: string }[],
  maxAgeMinutes = 15,
): Promise<number> {
  if (!instruments.length) return 0
  const { data } = await service
    .from("latest_quotes")
    .select("instrument_id, fetched_at")
    .in("instrument_id", instruments.map((i) => i.id))
  const fetchedAt = new Map((data ?? []).map((r) => [r.instrument_id as string, Date.parse(r.fetched_at)]))
  const cutoff = Date.now() - maxAgeMinutes * 60_000
  const stale = instruments.filter((i) => (fetchedAt.get(i.id) ?? 0) < cutoff)
  if (!stale.length) return 0

  const from = minusDays(new Date().toISOString().slice(0, 10), 10)
  const quotes: object[] = []
  const closes: object[] = []
  const now = new Date().toISOString()

  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, stale.length) }, async () => {
      while (next < stale.length) {
        const inst = stale[next++]
        try {
          const chart = await fetchChart(inst.symbol, from)
          if (!chart?.quote) continue
          quotes.push({
            instrument_id: inst.id,
            price: chart.quote.price,
            previous_close: chart.quote.previousClose,
            currency: chart.currency,
            market_state: chart.quote.marketState,
            quoted_at: chart.quote.quotedAt,
            source: "yahoo",
            fetched_at: now,
          })
          for (const c of chart.closes) {
            closes.push({ instrument_id: inst.id, price_date: c.date, close: c.close, currency: chart.currency, source: "yahoo", fetched_at: now })
          }
        } catch {
          // Eén mislukte koers mag het overzicht niet blokkeren; de vorige quote blijft staan
        }
      }
    }),
  )

  if (quotes.length) await service.from("latest_quotes").upsert(quotes, { onConflict: "instrument_id" })
  if (closes.length) await service.from("daily_prices").upsert(closes, { onConflict: "instrument_id,price_date" })
  return quotes.length
}
