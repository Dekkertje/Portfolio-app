/**
 * Detail van één positie: koersverloop in EUR, aan- en verkopen als markeringen,
 * kostprijs, resultaat en alle bijbehorende events. Puur, geen I/O.
 */

import { buildState, makeSeriesLookup, weekdays, type Currency, type IsoDate, type LedgerEvent } from "@/lib/core"

export type PositionDetail = {
  instrument: {
    id: string
    name: string
    isin: string
    symbol: string | null
    kind: string
    sector: string | null
    country: string | null
    currency: Currency | null
  }
  quantity: number
  costEur: number
  avgCostEur: number | null
  priceEur: number | null
  price: number | null
  valueEur: number
  unrealizedEur: number | null
  unrealizedPct: number | null
  realizedEur: number
  dividendsEur: number
  feesEur: number
  dayChangeEur: number | null
  dayChangePct: number | null
  /** Ongerealiseerd + gerealiseerd + dividend − (kosten zitten al in kostprijs/opbrengst) */
  totalReturnEur: number | null
  /** Koers in EUR per werkdag sinds het eerste event */
  series: { d: IsoDate; p: number }[]
  trades: { d: IsoDate; type: "buy" | "sell"; quantity: number; priceEur: number }[]
  events: LedgerEvent[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function buildPositionDetail(input: {
  instrumentId: string
  instrument: PositionDetail["instrument"]
  events: LedgerEvent[]
  closes: [IsoDate, number, Currency][]
  fx: [Currency, IsoDate, number][]
  quote: { price: number; previousClose: number | null; currency: Currency } | null
  today: IsoDate
}): PositionDetail {
  const { instrumentId, events, today, quote } = input
  const mine = events.filter((e) => e.instrumentId === instrumentId)
  const p = buildState(mine).positions.get(instrumentId)

  const close = makeSeriesLookup(input.closes.map(([d, c]) => ["x", d, c] as const))
  const closeCurrency = input.closes.at(-1)?.[2] ?? quote?.currency ?? "EUR"
  const fx = makeSeriesLookup(input.fx)
  const toEur = (amount: number, currency: Currency, date: IsoDate) => {
    if (currency === "EUR") return amount
    const r = fx(currency, date)
    return r == null ? null : amount * r
  }

  const first = mine.reduce<IsoDate | null>((m, e) => (!m || e.date < m ? e.date : m), null)
  const series: PositionDetail["series"] = []
  if (first) {
    for (const d of weekdays(first, today)) {
      const c = d === today && quote ? quote.price : close("x", d)
      const eur = c == null ? null : toEur(c, d === today && quote ? quote.currency : closeCurrency, d)
      if (eur != null) series.push({ d, p: Math.round(eur * 1e4) / 1e4 })
    }
  }

  const quantity = p?.quantity ?? 0
  const costEur = p?.costBasisEur ?? 0
  const priceEur = quote ? toEur(quote.price, quote.currency, today) : (series.at(-1)?.p ?? null)
  const valueEur = priceEur != null ? quantity * priceEur : costEur
  const unrealized = priceEur != null && quantity > 0 ? valueEur - costEur : null
  const rate = quote ? toEur(1, quote.currency, today) : null
  const dayChangeEur = quote?.previousClose && rate != null && quantity > 0 ? quantity * (quote.price - quote.previousClose) * rate : null

  return {
    instrument: input.instrument,
    quantity,
    costEur: round2(costEur),
    avgCostEur: quantity > 0 ? costEur / quantity : null,
    priceEur,
    price: quote?.price ?? null,
    valueEur: round2(valueEur),
    unrealizedEur: unrealized == null ? null : round2(unrealized),
    unrealizedPct: unrealized == null || costEur <= 0 ? null : unrealized / costEur,
    realizedEur: round2(p?.realizedEur ?? 0),
    dividendsEur: round2(p?.dividendsEur ?? 0),
    feesEur: round2(p?.feesEur ?? 0),
    dayChangeEur: dayChangeEur == null ? null : round2(dayChangeEur),
    dayChangePct: quote?.previousClose ? quote.price / quote.previousClose - 1 : null,
    totalReturnEur: quantity > 0 && unrealized == null ? null : round2((unrealized ?? 0) + (p?.realizedEur ?? 0) + (p?.dividendsEur ?? 0)),
    series,
    trades: mine
      .filter((e): e is LedgerEvent & { type: "buy" | "sell" } => (e.type === "buy" || e.type === "sell") && e.quantity > 0)
      .map((e) => ({ d: e.date, type: e.type, quantity: e.quantity, priceEur: Math.abs(e.amountEur) / e.quantity })),
    events: [...mine].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
  }
}
