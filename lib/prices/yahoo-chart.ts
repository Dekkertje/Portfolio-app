/**
 * Yahoo v8 chart-endpoint: in één request de dagslotkoersen én de actuele koers.
 *
 * Belangrijk: Yahoo's "close" is altijd gecorrigeerd voor splits (en "adjclose"
 * ook voor dividend). Het grootboek rekent met de stuks van díe dag, dus hier
 * worden de slotkoersen teruggerekend naar de echte koers van dat moment.
 */

import type { Currency, IsoDate } from "@/lib/core/types"

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart"
const HEADERS = { "User-Agent": "Mozilla/5.0" }

export type ChartResult = {
  symbol: string
  /** Genormaliseerd: GBp/GBX → GBP, ZAc → ZAR (koersen gedeeld door 100) */
  currency: Currency
  /** Ongecorrigeerde slotkoersen, oplopend op datum (datum in de tijdzone van de beurs) */
  closes: { date: IsoDate; close: number }[]
  quote: {
    price: number
    /** Slot van de laatste handelsdag vóór de quote-datum */
    previousClose: number | null
    quoteDate: IsoDate
    quotedAt: string
    marketState: string | null
  } | null
}

const MINOR_UNITS: Record<string, { currency: Currency; divisor: number }> = {
  GBp: { currency: "GBP", divisor: 100 },
  GBX: { currency: "GBP", divisor: 100 },
  ZAc: { currency: "ZAR", divisor: 100 },
  ILA: { currency: "ILS", divisor: 100 },
}

type YahooChartJson = {
  chart?: {
    result?: {
      meta?: {
        currency?: string
        regularMarketPrice?: number
        regularMarketTime?: number
        gmtoffset?: number
        marketState?: string
      }
      timestamp?: number[]
      events?: { splits?: Record<string, { date: number; numerator: number; denominator: number }> }
      indicators?: { quote?: { close?: (number | null)[] }[] }
    }[]
    error?: { description?: string } | null
  }
}

function toDate(unixSeconds: number, gmtoffset: number): IsoDate {
  return new Date((unixSeconds + gmtoffset) * 1000).toISOString().slice(0, 10)
}

/** Pure verwerking van een chart-response; los getest. */
export function parseChart(symbol: string, json: YahooChartJson): ChartResult | null {
  const r = json.chart?.result?.[0]
  const meta = r?.meta
  if (!r || !meta) return null

  const gmtoffset = meta.gmtoffset ?? 0
  const minor = MINOR_UNITS[meta.currency ?? ""]
  const divisor = minor?.divisor ?? 1
  const currency = minor?.currency ?? meta.currency ?? "USD"

  const splits = Object.values(r.events?.splits ?? {})
    .filter((s) => s.numerator > 0 && s.denominator > 0)
    .map((s) => ({ date: toDate(s.date, gmtoffset), ratio: s.numerator / s.denominator }))

  // Factor om een split-gecorrigeerde koers op `date` terug te rekenen: product van
  // alle splits die ná die dag plaatsvonden.
  const unadjust = (date: IsoDate) => splits.reduce((f, s) => (s.date > date ? f * s.ratio : f), 1)

  const raw = r.indicators?.quote?.[0]?.close ?? []
  const byDate = new Map<IsoDate, number>()
  ;(r.timestamp ?? []).forEach((ts, i) => {
    const c = raw[i]
    if (c == null || !isFinite(c) || c <= 0) return
    const date = toDate(ts, gmtoffset)
    // Laatste waarde per datum wint (Yahoo voegt soms een lopende intraday-bar toe)
    byDate.set(date, (c * unadjust(date)) / divisor)
  })
  const closes = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, close]) => ({ date, close }))

  let quote: ChartResult["quote"] = null
  if (meta.regularMarketPrice && meta.regularMarketPrice > 0 && meta.regularMarketTime) {
    const quoteDate = toDate(meta.regularMarketTime, gmtoffset)
    const prev = closes.filter((c) => c.date < quoteDate).at(-1)
    quote = {
      price: meta.regularMarketPrice / divisor,
      previousClose: prev?.close ?? null,
      quoteDate,
      quotedAt: new Date(meta.regularMarketTime * 1000).toISOString(),
      marketState: meta.marketState ?? null,
    }
  }

  return { symbol, currency, closes, quote }
}

/**
 * Haalt dagkoersen op vanaf `from` (inclusief) tot nu, plus de actuele koers.
 * Geeft null als het symbool niet bestaat; gooit bij netwerk-/rate-limitfouten.
 */
export async function fetchChart(symbol: string, from: IsoDate): Promise<ChartResult | null> {
  const period1 = Math.floor(Date.parse(from + "T00:00:00Z") / 1000) - 86_400
  const period2 = Math.floor(Date.now() / 1000) + 86_400
  const url = `${BASE}/${encodeURIComponent(symbol)}?interval=1d&period1=${period1}&period2=${period2}&events=split`

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: HEADERS, cache: "no-store" })
    if (res.status === 404) return null
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt))
      continue
    }
    if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`)
    const result = parseChart(symbol, (await res.json()) as YahooChartJson)
    if (result) result.closes = result.closes.filter((c) => c.date >= from)
    return result
  }
}

/** Yahoo-symbool voor de wisselkoers "EUR per 1 `currency`". */
export const fxSymbol = (currency: Currency) => `${currency}EUR=X`
