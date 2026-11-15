/**
 * Dividendanalyse uit het grootboek (werkelijk ontvangen, netto) en een schatting
 * van komende uitkeringen op basis van de uitkeringshistorie. Puur, geen I/O.
 */

import type { IsoDate, LedgerEvent } from "@/lib/core"

export type DividendPayment = {
  date: IsoDate
  instrumentId: string
  grossEur: number
  taxEur: number
  netEur: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Dividend + ingehouden bronbelasting per uitkering (zelfde dag, zelfde instrument). */
export function dividendPayments(events: LedgerEvent[]): DividendPayment[] {
  const byKey = new Map<string, DividendPayment>()
  for (const e of events) {
    if ((e.type !== "dividend" && e.type !== "dividend_tax") || !e.instrumentId) continue
    const key = `${e.date}|${e.instrumentId}`
    const p = byKey.get(key) ?? { date: e.date, instrumentId: e.instrumentId, grossEur: 0, taxEur: 0, netEur: 0 }
    if (e.type === "dividend") p.grossEur += e.amountEur
    else p.taxEur += -e.amountEur
    p.netEur = p.grossEur - p.taxEur
    byKey.set(key, p)
  }
  return [...byKey.values()]
    .map((p) => ({ ...p, grossEur: round2(p.grossEur), taxEur: round2(p.taxEur), netEur: round2(p.netEur) }))
    // Correcties (dividend teruggeboekt) netten tegen nul; die tonen we niet
    .filter((p) => Math.abs(p.netEur) >= 0.005)
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function totalsByYear(payments: DividendPayment[]): { year: number; netEur: number; count: number }[] {
  const m = new Map<number, { netEur: number; count: number }>()
  for (const p of payments) {
    const y = Number(p.date.slice(0, 4))
    const t = m.get(y) ?? { netEur: 0, count: 0 }
    t.netEur += p.netEur
    t.count++
    m.set(y, t)
  }
  return [...m.entries()].map(([year, t]) => ({ year, netEur: round2(t.netEur), count: t.count })).sort((a, b) => b.year - a.year)
}

/** Netto per maand voor de laatste 12 maanden t/m de maand van `today` (oudste eerst, lege maanden = 0). */
export function last12Months(payments: DividendPayment[], today: IsoDate): { month: string; netEur: number }[] {
  const months: string[] = []
  const d = new Date(today.slice(0, 7) + "-01T00:00:00Z")
  for (let i = 11; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1))
    months.push(m.toISOString().slice(0, 7))
  }
  const sums = new Map(months.map((m) => [m, 0]))
  for (const p of payments) {
    const m = p.date.slice(0, 7)
    if (sums.has(m)) sums.set(m, sums.get(m)! + p.netEur)
  }
  return months.map((month) => ({ month, netEur: round2(sums.get(month)!) }))
}

export type DividendEstimate = {
  frequency: 1 | 2 | 4 | 12
  /** Verwachte volgende ex-dividenddatum */
  nextExDate: IsoDate
  /** Laatste uitkering per aandeel, in de noteringsvaluta */
  amountPerShare: number
  annualPerShare: number
}

function addMonths(date: IsoDate, months: number): IsoDate {
  const d = new Date(date + "T00:00:00Z")
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate())).toISOString().slice(0, 10)
}

const daysBetween = (a: IsoDate, b: IsoDate) => (Date.parse(b) - Date.parse(a)) / 86_400_000

/**
 * Schat de volgende uitkering uit de historie: frequentie uit het aantal uitkeringen
 * in het laatste jaar, volgende datum = laatste + periode. Geen schatting als het
 * fonds al ruim een periode niets uitkeerde (gestopt) of als er geen historie is.
 */
export function estimateNextDividend(history: { date: IsoDate; amount: number }[], today: IsoDate): DividendEstimate | null {
  const sorted = [...history].filter((h) => h.amount > 0).sort((a, b) => a.date.localeCompare(b.date))
  if (!sorted.length) return null
  const last = sorted[sorted.length - 1]
  const lastYear = sorted.filter((h) => daysBetween(h.date, today) <= 380)
  if (!lastYear.length) return null

  const n = lastYear.length
  const frequency: DividendEstimate["frequency"] = n >= 10 ? 12 : n >= 3 ? 4 : n === 2 ? 2 : 1
  const periodMonths = 12 / frequency

  // Langer dan anderhalve periode niets: waarschijnlijk gestopt of onregelmatig
  if (daysBetween(last.date, today) > periodMonths * 30.5 * 1.5 + 14) return null

  let next = addMonths(last.date, periodMonths)
  while (next < today) next = addMonths(next, periodMonths)

  return {
    frequency,
    nextExDate: next,
    amountPerShare: last.amount,
    annualPerShare: round2(lastYear.reduce((s, h) => s + h.amount, 0) * 1e4) / 1e4,
  }
}
