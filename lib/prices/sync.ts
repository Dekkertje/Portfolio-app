/**
 * Bepaalt welke koersen en wisselkoersen opgehaald moeten worden en zet de
 * Yahoo-resultaten om naar rijen voor daily_prices, latest_quotes en fx_rates.
 * Bevat geen database-code: zie store.ts voor lezen/schrijven.
 */

import type { Currency, IsoDate } from "@/lib/core/types"
import { fetchChart, fxSymbol, type ChartResult } from "./yahoo-chart"

/** Laatste dagen altijd opnieuw ophalen: Yahoo corrigeert recente slotkoersen soms nog */
const OVERLAP_DAYS = 7
const CONCURRENCY = 4

export type InstrumentSyncStatus = {
  instrumentId: string
  symbol: string
  firstEventDate: IsoDate
  lastPriceDate: IsoDate | null
}

export type FxSyncStatus = { currency: Currency; lastRateDate: IsoDate | null }

export type DailyPriceRow = { instrument_id: string; price_date: IsoDate; close: number; currency: Currency; source: string }
export type LatestQuoteRow = {
  instrument_id: string
  price: number
  previous_close: number | null
  currency: Currency
  market_state: string | null
  quoted_at: string
  source: string
}
export type FxRateRow = { base_currency: Currency; quote_currency: Currency; rate: number; rate_date: IsoDate; source: string }

export type PriceUpdates = {
  daily: DailyPriceRow[]
  quotes: LatestQuoteRow[]
  fx: FxRateRow[]
  errors: string[]
}

export type ChartFetcher = (symbol: string, from: IsoDate) => Promise<ChartResult | null>

export function minusDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(date + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Ophaal-startdatum: vanaf de laatste bekende koers (met overlap), anders een week vóór het eerste event. */
export function syncFrom(lastKnown: IsoDate | null, firstNeeded: IsoDate): IsoDate {
  return lastKnown ? minusDays(lastKnown, OVERLAP_DAYS) : minusDays(firstNeeded, OVERLAP_DAYS)
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

export async function collectPriceUpdates(
  instruments: InstrumentSyncStatus[],
  fxStatus: FxSyncStatus[],
  fetcher: ChartFetcher = fetchChart,
): Promise<PriceUpdates> {
  const updates: PriceUpdates = { daily: [], quotes: [], fx: [], errors: [] }
  const currencies = new Set<Currency>(fxStatus.map((f) => f.currency))

  await pool(instruments, CONCURRENCY, async (inst) => {
    try {
      const chart = await fetcher(inst.symbol, syncFrom(inst.lastPriceDate, inst.firstEventDate))
      if (!chart) {
        updates.errors.push(`${inst.symbol}: onbekend bij Yahoo`)
        return
      }
      if (chart.currency !== "EUR") currencies.add(chart.currency)
      for (const c of chart.closes) {
        updates.daily.push({ instrument_id: inst.instrumentId, price_date: c.date, close: c.close, currency: chart.currency, source: "yahoo" })
      }
      if (chart.quote) {
        updates.quotes.push({
          instrument_id: inst.instrumentId,
          price: chart.quote.price,
          previous_close: chart.quote.previousClose,
          currency: chart.currency,
          market_state: chart.quote.marketState,
          quoted_at: chart.quote.quotedAt,
          source: "yahoo",
        })
      }
    } catch (e) {
      updates.errors.push(`${inst.symbol}: ${e instanceof Error ? e.message : String(e)}`)
    }
  })

  const earliest = instruments.reduce<IsoDate | null>((min, i) => (!min || i.firstEventDate < min ? i.firstEventDate : min), null)
  if (!earliest) return updates

  const lastFx = new Map(fxStatus.map((f) => [f.currency, f.lastRateDate]))
  await pool([...currencies], CONCURRENCY, async (currency) => {
    try {
      const chart = await fetcher(fxSymbol(currency), syncFrom(lastFx.get(currency) ?? null, earliest))
      if (!chart) {
        updates.errors.push(`${fxSymbol(currency)}: onbekend bij Yahoo`)
        return
      }
      for (const c of chart.closes) {
        updates.fx.push({ base_currency: currency, quote_currency: "EUR", rate: c.close, rate_date: c.date, source: "yahoo" })
      }
      // De actuele koers als koers van vandaag, zodat de waardering van vandaag een FX-koers heeft
      if (chart.quote && !chart.closes.some((c) => c.date === chart.quote!.quoteDate)) {
        updates.fx.push({ base_currency: currency, quote_currency: "EUR", rate: chart.quote.price, rate_date: chart.quote.quoteDate, source: "yahoo" })
      }
    } catch (e) {
      updates.errors.push(`${fxSymbol(currency)}: ${e instanceof Error ? e.message : String(e)}`)
    }
  })

  return updates
}
