import type { IsoDate } from "./types"

const DAY_MS = 86_400_000

function daysBetween(a: IsoDate, b: IsoDate): number {
  return (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY_MS
}

/**
 * Time-weighted return als cumulatieve index (start = 1).
 *
 * Geldstromen worden aan het eind van de dag verondersteld (aankopen gebeuren
 * tegen de koers van die dag, dus nieuw geld heeft die dag nog niets verdiend):
 *   r_t = (V_t − F_t) / V_{t-1} − 1
 * Zo telt een storting of aankoop niet als rendement, alleen de koersbeweging.
 */
export function twrIndex(points: { date: IsoDate; valueEur: number; flowEur: number }[]): { date: IsoDate; index: number }[] {
  const out: { date: IsoDate; index: number }[] = []
  let index = 1
  let prevValue = 0
  for (const p of points) {
    if (prevValue > 0) index *= (p.valueEur - p.flowEur) / prevValue
    out.push({ date: p.date, index })
    prevValue = p.valueEur
  }
  return out
}

/** TWR over een periode als fractie (0.12 = +12%). */
export function twr(points: { date: IsoDate; valueEur: number; flowEur: number }[]): number {
  const idx = twrIndex(points)
  return idx.length ? idx[idx.length - 1].index - 1 : 0
}

export type CashFlow = { date: IsoDate; amount: number }

/**
 * XIRR (geldgewogen jaarrendement). Bedragen vanuit de belegger: inleg negatief,
 * opnames en eindwaarde positief. Geeft null als er geen oplossing is.
 */
export function xirr(flows: CashFlow[]): number | null {
  const fs = flows.filter((f) => f.amount !== 0).sort((a, b) => a.date.localeCompare(b.date))
  if (fs.length < 2 || !fs.some((f) => f.amount < 0) || !fs.some((f) => f.amount > 0)) return null

  const t0 = fs[0].date
  const ts = fs.map((f) => daysBetween(t0, f.date) / 365)
  const npv = (r: number) => fs.reduce((s, f, k) => s + f.amount / Math.pow(1 + r, ts[k]), 0)
  const dnpv = (r: number) => fs.reduce((s, f, k) => s - (ts[k] * f.amount) / Math.pow(1 + r, ts[k] + 1), 0)

  // Newton vanaf 10%, met bisectie als vangnet
  let r = 0.1
  for (let k = 0; k < 50; k++) {
    const f = npv(r)
    const d = dnpv(r)
    if (!isFinite(f) || !isFinite(d) || d === 0) break
    const next = r - f / d
    if (!isFinite(next) || next <= -0.9999) break
    if (Math.abs(next - r) < 1e-10) return next
    r = next
  }

  let lo = -0.9999
  let hi = 10
  let fLo = npv(lo)
  if (fLo * npv(hi) > 0) return null
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    const fMid = npv(mid)
    if (Math.abs(fMid) < 1e-7) return mid
    if (fLo * fMid < 0) hi = mid
    else {
      lo = mid
      fLo = fMid
    }
  }
  return (lo + hi) / 2
}

/** Zet een dagreeks om naar XIRR-kasstromen: −flow per dag plus de eindwaarde. */
export function flowsFromSeries(points: { date: IsoDate; valueEur: number; flowEur: number }[]): CashFlow[] {
  if (!points.length) return []
  const flows: CashFlow[] = points.filter((p) => p.flowEur !== 0).map((p) => ({ date: p.date, amount: -p.flowEur }))
  const last = points[points.length - 1]
  flows.push({ date: last.date, amount: last.valueEur })
  return flows
}
