/**
 * Jaaroverzicht per kalenderjaar: rendement, waarde op 1 januari (box 3-peildatum),
 * dividend met ingehouden belasting per land, gerealiseerd resultaat en kosten.
 * Puur: gebruikt het grootboek en de dagreeks die het overzicht al heeft.
 */

import { buildState, sellResults, type IsoDate, type LedgerEvent } from "@/lib/core"
import { twr } from "@/lib/core/returns"

export type YearSummary = {
  year: number
  /** Lopend jaar: eindwaarde is de waarde van vandaag */
  ongoing: boolean
  /** Waarde op 1 januari (= slot van de laatste handelsdag van het vorige jaar) */
  startValueEur: number
  startSecuritiesEur: number
  startCashEur: number
  endValueEur: number
  /** Netto geldstroom het portfolio in (stortingen − opnames, of zonder rekeningoverzicht: aankopen − verkopen − uitkeringen) */
  netFlowEur: number
  depositsEur: number
  withdrawalsEur: number
  /** Eindwaarde − beginwaarde − netto geldstroom */
  resultEur: number
  /** Tijdgewogen rendement over het jaar */
  returnPct: number
  realizedEur: number
  dividendGrossEur: number
  /** Ingehouden dividendbelasting per land (landcode uit de ISIN), positief bedrag */
  dividendTaxByCountry: { country: string; taxEur: number; grossEur: number }[]
  dividendNetEur: number
  transactionCostsEur: number
  otherCostsEur: number
  interestEur: number
  buys: number
  sells: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function yearlySummaries(input: {
  events: LedgerEvent[]
  series: { d: IsoDate; v: number; f: number }[]
  /** instrumentId → ISIN, voor het land van de dividendbelasting */
  isinOf: (instrumentId: string) => string | null
  tracksCash: boolean
  today: IsoDate
}): YearSummary[] {
  const { events, series, isinOf, tracksCash, today } = input
  if (!events.length || !series.length) return []

  const sells = sellResults(events)
  const firstYear = Number(series[0].d.slice(0, 4))
  const lastYear = Number(today.slice(0, 4))
  const out: YearSummary[] = []

  for (let year = firstYear; year <= lastYear; year++) {
    const start = `${year}-01-01`
    const end = `${year}-12-31`
    const prev = series.filter((p) => p.d < start).at(-1)
    const inYear = series.filter((p) => p.d >= start && p.d <= end)
    if (!inYear.length) continue

    // Waarde op 1 januari, gesplitst naar effecten en cash via de state op 31 december
    const stateAtStart = buildState(events, `${year - 1}-12-31`)
    const startValue = prev?.v ?? 0
    const startCash = tracksCash ? stateAtStart.cashEur : 0
    const endValue = inYear.at(-1)!.v
    const netFlow = inYear.reduce((s, p) => s + p.f, 0)
    const points = prev ? [{ ...prev, f: 0 }, ...inYear] : inYear

    const ev = events.filter((e) => e.date >= start && e.date <= end)
    // Jaren zonder noemenswaardige waarde en zonder activiteit (bijv. €0,10 na een opname) overslaan
    if (startValue < 1 && endValue < 1 && !ev.length) continue
    const sum = (pred: (e: LedgerEvent) => boolean, f: (e: LedgerEvent) => number) => ev.filter(pred).reduce((s, e) => s + f(e), 0)

    const byCountry = new Map<string, { taxEur: number; grossEur: number }>()
    for (const e of ev) {
      if ((e.type !== "dividend" && e.type !== "dividend_tax") || !e.instrumentId) continue
      const country = (isinOf(e.instrumentId) ?? "??").slice(0, 2).toUpperCase()
      const c = byCountry.get(country) ?? { taxEur: 0, grossEur: 0 }
      if (e.type === "dividend") c.grossEur += e.amountEur
      else c.taxEur += -e.amountEur
      byCountry.set(country, c)
    }

    const gross = sum((e) => e.type === "dividend", (e) => e.amountEur)
    const tax = sum((e) => e.type === "dividend_tax", (e) => -e.amountEur)

    out.push({
      year,
      ongoing: year === lastYear,
      startValueEur: round2(startValue),
      startSecuritiesEur: round2(startValue - startCash),
      startCashEur: round2(startCash),
      endValueEur: round2(endValue),
      netFlowEur: round2(netFlow),
      depositsEur: round2(sum((e) => e.type === "deposit", (e) => e.amountEur)),
      withdrawalsEur: round2(sum((e) => e.type === "withdrawal", (e) => -e.amountEur)),
      resultEur: round2(endValue - startValue - netFlow),
      returnPct: twr(points.map((p) => ({ date: p.d, valueEur: p.v, flowEur: p.f }))),
      realizedEur: round2(sum((e) => e.type === "sell", (e) => sells.get(e.id)?.realizedEur ?? 0)),
      dividendGrossEur: round2(gross),
      dividendTaxByCountry: [...byCountry.entries()]
        .map(([country, c]) => ({ country, taxEur: round2(c.taxEur), grossEur: round2(c.grossEur) }))
        .filter((c) => c.grossEur !== 0 || c.taxEur !== 0)
        .sort((a, b) => b.grossEur - a.grossEur),
      dividendNetEur: round2(gross - tax),
      transactionCostsEur: round2(sum((e) => e.type === "buy" || e.type === "sell", (e) => e.feeEur)),
      otherCostsEur: round2(sum((e) => e.type === "fee", (e) => -e.amountEur)),
      interestEur: round2(sum((e) => e.type === "interest", (e) => e.amountEur)),
      buys: ev.filter((e) => e.type === "buy").length,
      sells: ev.filter((e) => e.type === "sell").length,
    })
  }
  return out.reverse()
}
