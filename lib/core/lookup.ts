import type { IsoDate } from "./types"

/**
 * Maakt een opzoekfunctie "laatst bekende waarde op of vóór datum" per sleutel
 * (instrument of valuta). Weekenden en feestdagen vallen zo vanzelf terug op de
 * vorige handelsdag. Rijen hoeven niet gesorteerd te zijn.
 */
export function makeSeriesLookup<K extends string>(rows: Iterable<readonly [K, IsoDate, number]>) {
  const byKey = new Map<K, { dates: IsoDate[]; values: number[] }>()
  const tmp = new Map<K, [IsoDate, number][]>()
  for (const [key, date, value] of rows) {
    if (!tmp.has(key)) tmp.set(key, [])
    tmp.get(key)!.push([date, Number(value)])
  }
  for (const [key, list] of tmp) {
    list.sort((a, b) => a[0].localeCompare(b[0]))
    byKey.set(key, { dates: list.map((r) => r[0]), values: list.map((r) => r[1]) })
  }

  return (key: K, date: IsoDate): number | null => {
    const s = byKey.get(key)
    if (!s) return null
    let lo = 0
    let hi = s.dates.length - 1
    let best = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (s.dates[mid] <= date) {
        best = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    return best >= 0 ? s.values[best] : null
  }
}

/** Alle werkdagen (ma–vr) van `from` t/m `to`. */
export function weekdays(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = []
  for (let d = new Date(from + "T00:00:00Z"); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10))
  }
  return out
}
