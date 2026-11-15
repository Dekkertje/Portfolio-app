import type {
  FxLookup,
  IsoDate,
  LedgerEvent,
  PortfolioState,
  PortfolioValuation,
  PositionState,
  Quote,
  ValuedPosition,
} from "./types"

// Restjes kleiner dan dit (afrondingsruis, fractionele stukken) gelden als "positie gesloten"
const QTY_EPSILON = 1e-9

/** Vaste volgorde binnen één dag: eerst geld erin, dan splits, kopen, verkopen, de rest. */
const TYPE_ORDER: Record<LedgerEvent["type"], number> = {
  deposit: 0,
  split: 1,
  buy: 2,
  sell: 3,
  dividend: 4,
  dividend_tax: 5,
  interest: 6,
  fee: 7,
  withdrawal: 8,
}

export function sortEvents(events: LedgerEvent[]): LedgerEvent[] {
  return [...events].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
      a.id.localeCompare(b.id),
  )
}

export function emptyState(): PortfolioState {
  return {
    positions: new Map(),
    cashEur: 0,
    netDepositsEur: 0,
    otherCostsEur: 0,
    interestEur: 0,
    tracksCash: false,
  }
}

function position(state: PortfolioState, instrumentId: string): PositionState {
  let p = state.positions.get(instrumentId)
  if (!p) {
    p = { instrumentId, quantity: 0, costBasisEur: 0, realizedEur: 0, dividendsEur: 0, feesEur: 0 }
    state.positions.set(instrumentId, p)
  }
  return p
}

function requireInstrument(e: LedgerEvent): string {
  if (!e.instrumentId) throw new Error(`Event ${e.id} (${e.type}) mist instrumentId`)
  return e.instrumentId
}

/** Verwerkt één event in de state (muteert). Events moeten in volgorde van sortEvents komen. */
export function applyEvent(state: PortfolioState, e: LedgerEvent): void {
  state.cashEur += e.amountEur

  switch (e.type) {
    case "buy": {
      const p = position(state, requireInstrument(e))
      p.quantity += e.quantity
      p.costBasisEur += -e.amountEur
      p.feesEur += e.feeEur
      break
    }
    case "sell": {
      const p = position(state, requireInstrument(e))
      const sold = Math.min(e.quantity, p.quantity)
      const avgCost = p.quantity > 0 ? p.costBasisEur / p.quantity : 0
      const costOfSale = avgCost * sold
      p.quantity -= sold
      p.costBasisEur -= costOfSale
      p.realizedEur += e.amountEur - costOfSale
      p.feesEur += e.feeEur
      if (p.quantity < QTY_EPSILON) {
        p.quantity = 0
        p.costBasisEur = 0
      }
      break
    }
    case "split": {
      const p = position(state, requireInstrument(e))
      if (!e.splitRatio || e.splitRatio <= 0) throw new Error(`Split ${e.id} zonder geldige splitRatio`)
      p.quantity *= e.splitRatio
      break
    }
    case "dividend":
    case "dividend_tax": {
      if (e.instrumentId) position(state, e.instrumentId).dividendsEur += e.amountEur
      else state.otherCostsEur += -e.amountEur
      break
    }
    case "fee":
      if (e.instrumentId) position(state, e.instrumentId).feesEur += -e.amountEur
      state.otherCostsEur += -e.amountEur
      break
    case "interest":
      state.interestEur += e.amountEur
      break
    case "deposit":
    case "withdrawal":
      state.netDepositsEur += e.amountEur
      state.tracksCash = true
      break
  }
}

/** Bouwt de portfoliostate op uit het grootboek, optioneel tot en met `upTo`. */
export function buildState(events: LedgerEvent[], upTo?: IsoDate): PortfolioState {
  const state = emptyState()
  for (const e of sortEvents(events)) {
    if (upTo && e.date > upTo) break
    applyEvent(state, e)
  }
  return state
}

/** Waardeert de state met actuele koersen. Ontbreekt een koers, dan telt de positie tegen kostprijs. */
export function valuePortfolio(
  state: PortfolioState,
  quotes: Map<string, Quote>,
  fx: FxLookup,
): PortfolioValuation {
  const positions: ValuedPosition[] = []
  const missingQuotes: string[] = []
  let securitiesValueEur = 0
  let costBasisEur = 0
  let unrealizedEur = 0
  let realizedEur = 0
  let dividendsEur = 0

  for (const p of state.positions.values()) {
    realizedEur += p.realizedEur
    dividendsEur += p.dividendsEur

    const quote = quotes.get(p.instrumentId)
    const rate = quote ? (quote.currency === "EUR" ? 1 : fx(quote.currency)) : null
    const marketValueEur = quote && rate != null ? p.quantity * quote.price * rate : null
    const unrealized = marketValueEur != null ? marketValueEur - p.costBasisEur : null

    if (p.quantity > 0) {
      if (marketValueEur == null) missingQuotes.push(p.instrumentId)
      securitiesValueEur += marketValueEur ?? p.costBasisEur
      costBasisEur += p.costBasisEur
      unrealizedEur += unrealized ?? 0
    }

    positions.push({
      ...p,
      price: quote?.price ?? null,
      currency: quote?.currency ?? null,
      marketValueEur: p.quantity > 0 ? marketValueEur : 0,
      unrealizedEur: p.quantity > 0 ? unrealized : 0,
      totalReturnEur:
        p.quantity > 0 && unrealized == null ? null : (p.quantity > 0 ? unrealized! : 0) + p.realizedEur + p.dividendsEur,
    })
  }

  return {
    positions,
    securitiesValueEur,
    costBasisEur,
    unrealizedEur,
    realizedEur,
    dividendsEur,
    cashEur: state.cashEur,
    totalValueEur: securitiesValueEur + (state.tracksCash ? state.cashEur : 0),
    missingQuotes,
  }
}
