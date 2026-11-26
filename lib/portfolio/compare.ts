import { makeSeriesLookup, type IsoDate } from "@/lib/core"
import { twrIndex } from "@/lib/core/returns"

export type ComparePoint = { d: IsoDate; mine: number; bench: number | null }

/**
 * Cumulatief rendement van het portfolio (tijdgewogen, dus stortingen tellen niet
 * mee) naast dat van een index, beide vanaf het eerste punt van de periode (0 = start).
 * `points` begint met het nulpunt van de periode; de geldstroom daarvan telt niet.
 */
export function compareWithBenchmark(
  points: { d: IsoDate; v: number; f: number }[],
  closes: [IsoDate, number][],
): ComparePoint[] {
  if (!points.length) return []
  const idx = twrIndex(points.map((p, i) => ({ date: p.d, valueEur: p.v, flowEur: i === 0 ? 0 : p.f })))
  const close = makeSeriesLookup(closes.map(([d, c]) => ["b", d, c] as const))
  const base = close("b", points[0].d)
  return idx.map((p) => {
    const c = close("b", p.date)
    return { d: p.date, mine: p.index - 1, bench: base && c != null ? c / base - 1 : null }
  })
}
