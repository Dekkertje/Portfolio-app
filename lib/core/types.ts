/**
 * Domeinmodel van de portfolio-kern.
 *
 * Alles wat er op de rekening gebeurt is één LedgerEvent. Posities, cash,
 * rendement en historie worden hier uitsluitend uit afgeleid — er is geen
 * tweede bron van waarheid. Handmatige posities en cash zijn ook gewoon events.
 */

/** ISO-datum, YYYY-MM-DD */
export type IsoDate = string

/** ISO 4217 valutacode, bijv. "EUR", "USD", "GBP" (GBp/pence wordt vóór de kern naar GBP omgezet) */
export type Currency = string

export type LedgerEventType =
  | "buy"
  | "sell"
  | "dividend"      // bruto dividend
  | "dividend_tax"  // ingehouden bronbelasting
  | "fee"           // losse kosten (aansluitkosten, connectivity fee, ...)
  | "interest"
  | "deposit"
  | "withdrawal"
  | "split"

export type LedgerEvent = {
  id: string
  date: IsoDate
  type: LedgerEventType
  instrumentId: string | null
  /** Aantal stuks (altijd positief) — buy/sell */
  quantity: number
  /** Koers per stuk in `currency` — buy/sell, informatief */
  price: number | null
  currency: Currency
  /**
   * Cash-effect op de rekening in EUR, met teken: koop < 0, verkoop > 0,
   * dividend > 0, belasting/kosten < 0, storting > 0, opname < 0.
   * Bij buy/sell inclusief transactiekosten (zoals DEGIRO's "Totaal").
   */
  amountEur: number
  /** Transactiekosten in EUR (≥ 0), al verwerkt in amountEur — informatief */
  feeEur: number
  /** Alleen bij split: nieuwe stuks per oude stuk (2 = 2-voor-1, 0.1 = 1-voor-10) */
  splitRatio?: number
}

export type PositionState = {
  instrumentId: string
  quantity: number
  /** Kostprijs van de huidige stuks in EUR (gemiddelde-kostprijsmethode, incl. kosten) */
  costBasisEur: number
  realizedEur: number
  dividendsEur: number   // netto: bruto dividend minus bronbelasting
  feesEur: number
}

export type PortfolioState = {
  positions: Map<string, PositionState>
  /** Cash-saldo in EUR volgens het grootboek */
  cashEur: number
  /** Stortingen minus opnames */
  netDepositsEur: number
  /** Losse kosten en rente die niet bij een positie horen */
  otherCostsEur: number
  interestEur: number
  /** Of er stortingen/opnames in het grootboek staan (rekeningoverzicht geïmporteerd) */
  tracksCash: boolean
}

export type Quote = { price: number; currency: Currency }

/** Wisselkoers: hoeveel EUR is 1 eenheid van `currency` op de gevraagde dag */
export type FxLookup = (currency: Currency) => number | null

export type ValuedPosition = PositionState & {
  price: number | null
  currency: Currency | null
  marketValueEur: number | null
  unrealizedEur: number | null
  /** Ongerealiseerd + gerealiseerd + dividend */
  totalReturnEur: number | null
}

export type PortfolioValuation = {
  positions: ValuedPosition[]
  securitiesValueEur: number
  costBasisEur: number
  unrealizedEur: number
  realizedEur: number
  dividendsEur: number
  cashEur: number
  /** Effecten + cash als het rekeningoverzicht er is, anders alleen effecten */
  totalValueEur: number
  /** Posities zonder bruikbare koers of FX-koers — gewaardeerd tegen kostprijs */
  missingQuotes: string[]
}
