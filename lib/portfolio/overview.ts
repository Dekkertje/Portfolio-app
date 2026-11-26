/**
 * Stelt het portfolio-overzicht samen uit grootboek + koersen. Puur (geen I/O),
 * zodat de API-route alleen nog data hoeft op te halen.
 */

import {
  buildDailySeries,
  buildState,
  flowsFromSeries,
  makeSeriesLookup,
  valuePortfolio,
  weekdays,
  xirr,
  type Currency,
  type IsoDate,
  type LedgerEvent,
  type Quote,
} from "@/lib/core"
import { yearlySummaries, type YearSummary } from "./yearly"

export type OverviewInstrument = {
  id: string
  name: string
  isin: string
  kind: string
  symbol: string | null
  sector?: string | null
  country?: string | null
  /** Look-through sectorverdeling voor ETF's/fondsen */
  sectorWeights?: Record<string, number> | null
}

export type Benchmark = { label: string; weights: Record<string, number> }

export type Composition = {
  /** Aandeel in de totale waarde (incl. cash als het rekeningoverzicht er is) */
  byKind: { key: string; valueEur: number; weight: number }[]
  /** Alle sectoren, als aandeel van het deel waarvan de sector bekend is (som = 1) */
  bySector: { key: string; valueEur: number; weight: number }[]
  /** Welk deel van de effectenwaarde een bekende sector heeft (0–1) */
  sectorCoverage: number
  benchmark: Benchmark | null
}

export type OverviewQuote = {
  instrumentId: string
  price: number
  previousClose: number | null
  currency: Currency
  quotedAt: string
  marketState: string | null
}

export type MarketData = {
  prices: [string, IsoDate, number, Currency][]
  fx: [Currency, IsoDate, number][]
}

export type OverviewPosition = {
  instrumentId: string
  name: string
  isin: string
  kind: string
  symbol: string | null
  quantity: number
  price: number | null
  currency: Currency | null
  valueEur: number
  costEur: number
  unrealizedEur: number | null
  unrealizedPct: number | null
  dayChangeEur: number | null
  dayChangePct: number | null
  realizedEur: number
  dividendsEur: number
  /** Aandeel in de effectenwaarde, 0–1 */
  weight: number
  /** Geen actuele koers: gewaardeerd tegen kostprijs */
  stale: boolean
}

export type ClosedPosition = Pick<OverviewPosition, "instrumentId" | "name" | "isin" | "kind" | "realizedEur" | "dividendsEur">

/** Compacte dagreeks: d = datum, v = waarde, n = netto inleg tot en met die dag, f = geldstroom die dag */
export type OverviewPoint = { d: IsoDate; v: number; n: number; f: number }

export type PortfolioOverview = {
  asOf: string | null
  totals: {
    valueEur: number
    securitiesEur: number
    cashEur: number
    costEur: number
    unrealizedEur: number
    realizedEur: number
    dividendsEur: number
    netDepositsEur: number
    /** Waarde − netto inleg: alles wat het portfolio heeft opgeleverd */
    totalReturnEur: number
    dayChangeEur: number
    dayChangePct: number | null
    /** Geldgewogen jaarrendement over de hele looptijd */
    xirr: number | null
  }
  tracksCash: boolean
  positions: OverviewPosition[]
  closed: ClosedPosition[]
  series: OverviewPoint[]
  composition: Composition
  /** Jaaroverzicht per kalenderjaar, nieuwste eerst */
  years: YearSummary[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function buildOverview(input: {
  events: LedgerEvent[]
  instruments: Map<string, OverviewInstrument>
  quotes: Map<string, OverviewQuote>
  market: MarketData
  today: IsoDate
  benchmark?: Benchmark | null
}): PortfolioOverview {
  const { events, instruments, quotes, market, today } = input
  const close = makeSeriesLookup(market.prices.map(([id, d, c]) => [id, d, c] as const))
  const priceCurrency = new Map(market.prices.map(([id, , , cur]) => [id, cur]))
  const fx = makeSeriesLookup(market.fx)
  const fxToday = (c: Currency) => (c === "EUR" ? 1 : fx(c, today))

  // Actuele koers; anders de laatste slotkoers als terugval
  const currentQuotes = new Map<string, Quote>()
  for (const id of instruments.keys()) {
    const q = quotes.get(id)
    if (q) currentQuotes.set(id, { price: q.price, currency: q.currency })
    else {
      const c = close(id, today)
      const cur = priceCurrency.get(id)
      if (c != null && cur) currentQuotes.set(id, { price: c, currency: cur })
    }
  }

  const state = buildState(events)
  const valuation = valuePortfolio(state, currentQuotes, fxToday)

  const positions: OverviewPosition[] = []
  const closed: ClosedPosition[] = []
  let dayChangeEur = 0

  for (const p of valuation.positions) {
    const inst = instruments.get(p.instrumentId)
    const base = {
      instrumentId: p.instrumentId,
      name: inst?.name ?? p.instrumentId,
      isin: inst?.isin ?? "",
      kind: inst?.kind ?? "stock",
      realizedEur: round2(p.realizedEur),
      dividendsEur: round2(p.dividendsEur),
    }
    if (p.quantity <= 0) {
      closed.push(base)
      continue
    }

    const q = quotes.get(p.instrumentId)
    const rate = p.currency ? fxToday(p.currency) : null
    let dayEur: number | null = null
    let dayPct: number | null = null
    if (q?.previousClose && rate != null) {
      dayEur = p.quantity * (q.price - q.previousClose) * rate
      dayPct = q.price / q.previousClose - 1
      dayChangeEur += dayEur
    }
    const valueEur = p.marketValueEur ?? p.costBasisEur

    positions.push({
      ...base,
      symbol: inst?.symbol ?? null,
      quantity: p.quantity,
      price: p.price,
      currency: p.currency,
      valueEur: round2(valueEur),
      costEur: round2(p.costBasisEur),
      unrealizedEur: p.unrealizedEur == null ? null : round2(p.unrealizedEur),
      unrealizedPct: p.unrealizedEur == null || p.costBasisEur <= 0 ? null : p.unrealizedEur / p.costBasisEur,
      dayChangeEur: dayEur == null ? null : round2(dayEur),
      dayChangePct: dayPct,
      weight: valuation.securitiesValueEur > 0 ? valueEur / valuation.securitiesValueEur : 0,
      stale: p.marketValueEur == null,
    })
  }
  positions.sort((a, b) => b.valueEur - a.valueEur)
  closed.sort((a, b) => b.realizedEur + b.dividendsEur - (a.realizedEur + a.dividendsEur))

  // Historie: werkdagen vanaf het eerste event; vandaag met de actuele koersen
  const firstDate = events.reduce<IsoDate | null>((min, e) => (!min || e.date < min ? e.date : min), null)
  const dates = firstDate ? weekdays(firstDate, today) : []
  const daily = buildDailySeries({
    events,
    dates,
    priceAt: (id, date) => {
      if (date === today && currentQuotes.has(id)) return currentQuotes.get(id)!
      const c = close(id, date)
      const cur = priceCurrency.get(id)
      return c != null && cur ? { price: c, currency: cur } : null
    },
    fxAt: (c, date) => (c === "EUR" ? 1 : fx(c, date)),
  })

  let invested = 0
  const series: OverviewPoint[] = daily.map((p) => {
    invested += p.flowEur
    return { d: p.date, v: round2(p.valueEur), n: round2(invested), f: round2(p.flowEur) }
  })

  const netDepositsEur = state.tracksCash ? state.netDepositsEur : invested
  const securitiesBefore = valuation.securitiesValueEur - dayChangeEur
  const asOf = [...quotes.values()].reduce<string | null>((max, q) => (!max || q.quotedAt > max ? q.quotedAt : max), null)

  return {
    asOf,
    totals: {
      valueEur: round2(valuation.totalValueEur),
      securitiesEur: round2(valuation.securitiesValueEur),
      cashEur: round2(state.cashEur),
      costEur: round2(valuation.costBasisEur),
      unrealizedEur: round2(valuation.unrealizedEur),
      realizedEur: round2(valuation.realizedEur),
      dividendsEur: round2(valuation.dividendsEur),
      netDepositsEur: round2(netDepositsEur),
      totalReturnEur: round2(valuation.totalValueEur - netDepositsEur),
      dayChangeEur: round2(dayChangeEur),
      dayChangePct: securitiesBefore > 0 && dayChangeEur !== 0 ? dayChangeEur / securitiesBefore : null,
      xirr: xirr(flowsFromSeries(daily)),
    },
    tracksCash: state.tracksCash,
    positions,
    closed,
    series,
    composition: buildComposition(positions, instruments, state.tracksCash ? state.cashEur : 0, input.benchmark ?? null),
    years: yearlySummaries({
      events,
      series,
      isinOf: (id) => instruments.get(id)?.isin ?? null,
      tracksCash: state.tracksCash,
      today,
    }),
  }
}

const SECTOR_KEYS = [
  "technology", "financial_services", "healthcare", "consumer_cyclical", "communication_services", "industrials",
  "consumer_defensive", "energy", "basic_materials", "realestate", "utilities",
]

/** Verdeling naar soort en (look-through) sector. Cash telt mee bij soort, niet bij sector. */
export function buildComposition(
  positions: OverviewPosition[],
  instruments: Map<string, OverviewInstrument>,
  cashEur: number,
  benchmark: Benchmark | null,
): Composition {
  const kinds = new Map<string, number>()
  const sectors = new Map<string, number>(SECTOR_KEYS.map((k) => [k, 0]))
  let securities = 0
  let known = 0

  for (const p of positions) {
    const inst = instruments.get(p.instrumentId)
    const kind = inst?.kind === "stock" || inst?.kind === "etf" || inst?.kind === "fund" || inst?.kind === "crypto" ? inst.kind : "other"
    kinds.set(kind, (kinds.get(kind) ?? 0) + p.valueEur)
    securities += p.valueEur

    const weights = inst?.sectorWeights
    const total = weights ? Object.values(weights).reduce((s, w) => s + w, 0) : 0
    if (weights && total > 0) {
      for (const [k, w] of Object.entries(weights)) if (sectors.has(k)) sectors.set(k, sectors.get(k)! + (p.valueEur * w) / total)
      known += p.valueEur
    } else if (inst?.sector && sectors.has(inst.sector)) {
      sectors.set(inst.sector, sectors.get(inst.sector)! + p.valueEur)
      known += p.valueEur
    }
  }
  if (cashEur > 0) kinds.set("cash", cashEur)

  const totalValue = securities + Math.max(0, cashEur)
  const order = ["stock", "etf", "fund", "crypto", "other", "cash"]
  return {
    byKind: [...kinds.entries()]
      .filter(([, v]) => v > 0)
      .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
      .map(([key, valueEur]) => ({ key, valueEur: round2(valueEur), weight: totalValue > 0 ? valueEur / totalValue : 0 })),
    bySector: [...sectors.entries()]
      .map(([key, valueEur]) => ({ key, valueEur: round2(valueEur), weight: known > 0 ? valueEur / known : 0 }))
      .sort((a, b) => b.weight - a.weight),
    sectorCoverage: securities > 0 ? known / securities : 0,
    benchmark,
  }
}
