import { applyEvent, emptyState, sortEvents } from "./portfolio"
import type { Currency, IsoDate, LedgerEvent, PortfolioState, Quote } from "./types"

export type DailyPoint = {
  date: IsoDate
  /** Effecten (+ cash als het rekeningoverzicht er is) in EUR */
  valueEur: number
  costBasisEur: number
  /** Externe geldstroom op deze dag, positief = geld erin (zie externalFlow) */
  flowEur: number
  /** Cumulatief gerealiseerd + dividend t/m deze dag */
  realizedEur: number
  dividendsEur: number
}

export type HistoryInput = {
  events: LedgerEvent[]
  /** Op te bouwen dagen, oplopend (bijv. alle handelsdagen) */
  dates: IsoDate[]
  /** Slotkoers (ongecorrigeerd!) van instrument op of vóór `date`, of null */
  priceAt: (instrumentId: string, date: IsoDate) => Quote | null
  /** EUR per 1 eenheid `currency` op of vóór `date`, of null */
  fxAt: (currency: Currency, date: IsoDate) => number | null
}

/**
 * Externe geldstroom van een event, gezien vanuit "het portfolio".
 *
 * - Met rekeningoverzicht (tracksCash): alleen stortingen/opnames gaan de grens
 *   over; kopen, dividend en kosten zijn interne verschuivingen tussen cash en effecten.
 * - Zonder rekeningoverzicht bestaat het portfolio alleen uit effecten: een koop
 *   is geld erin, een verkoop of dividend is geld eruit, kosten zijn geld erin.
 */
export function externalFlow(e: LedgerEvent, tracksCash: boolean): number {
  if (tracksCash) return e.type === "deposit" || e.type === "withdrawal" ? e.amountEur : 0
  if (e.type === "split" || e.type === "deposit" || e.type === "withdrawal") return 0
  return -e.amountEur
}

function valueSecurities(
  state: PortfolioState,
  date: IsoDate,
  priceAt: HistoryInput["priceAt"],
  fxAt: HistoryInput["fxAt"],
): { valueEur: number; costBasisEur: number; realizedEur: number; dividendsEur: number } {
  let valueEur = 0
  let costBasisEur = 0
  let realizedEur = 0
  let dividendsEur = 0
  for (const p of state.positions.values()) {
    realizedEur += p.realizedEur
    dividendsEur += p.dividendsEur
    if (p.quantity <= 0) continue
    costBasisEur += p.costBasisEur
    const q = priceAt(p.instrumentId, date)
    const rate = q ? (q.currency === "EUR" ? 1 : fxAt(q.currency, date)) : null
    valueEur += q && rate != null ? p.quantity * q.price * rate : p.costBasisEur
  }
  return { valueEur, costBasisEur, realizedEur, dividendsEur }
}

/** Reconstrueert de dagwaarde van het portfolio uit grootboek × koers × FX van díe dag. */
export function buildDailySeries({ events, dates, priceAt, fxAt }: HistoryInput): DailyPoint[] {
  const sorted = sortEvents(events)
  const tracksCash = sorted.some((e) => e.type === "deposit" || e.type === "withdrawal")
  const state = emptyState()
  const out: DailyPoint[] = []
  let i = 0

  for (const date of dates) {
    let flowEur = 0
    while (i < sorted.length && sorted[i].date <= date) {
      applyEvent(state, sorted[i])
      flowEur += externalFlow(sorted[i], tracksCash)
      i++
    }
    const v = valueSecurities(state, date, priceAt, fxAt)
    out.push({
      date,
      valueEur: v.valueEur + (tracksCash ? state.cashEur : 0),
      costBasisEur: v.costBasisEur,
      flowEur,
      realizedEur: v.realizedEur,
      dividendsEur: v.dividendsEur,
    })
  }
  return out
}
