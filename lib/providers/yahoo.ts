/**
 * Yahoo Finance provider.
 *
 * All Yahoo Finance HTTP calls are centralised here so that:
 *   - Rate limiting and retries live in one place
 *   - The API surface is typed
 *   - Future providers can implement the same interface
 *
 * Yahoo Finance does not require an API key for the endpoints used here,
 * but may impose rate limits (~2 000 req/h on the free tier).
 */

const BASE_V8  = "https://query1.finance.yahoo.com/v8/finance"
const BASE_V10 = "https://query1.finance.yahoo.com/v10/finance"

const HEADERS = { "User-Agent": "Mozilla/5.0" }

// ─── Public types ─────────────────────────────────────────────────────────────

export type YahooQuote = {
  symbol:           string
  price:            number
  openPrice:        number       // today's market open price
  previousClose:    number       // yesterday's close (fallback if no open available)
  dailyChange:      number       // price − previousClose
  currency:         string       // as reported by Yahoo (USD, EUR, GBp, …)
  priceDate:        string       // YYYY-MM-DD
  marketState:      string       // REGULAR | PRE | POST | CLOSED
}

export type YahooDividendInfo = {
  annualDividendRate: number     // trailing 12-month, in native currency
  dividendYield:      number     // as a fraction, e.g. 0.0215
}

export type YahooSearchResult = {
  symbol:    string
  shortname: string
  longname?: string
  exchDisp:  string
  typeDisp:  string
  score:     number
}

// ─── Fetch with retry ─────────────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  retries = 2,
  delayMs = 300
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: HEADERS })
    if (res.ok) return res

    // 429 Too Many Requests: back off and retry
    if (res.status === 429 && attempt < retries) {
      await new Promise(r => setTimeout(r, delayMs * (attempt + 1)))
      continue
    }

    throw new YahooError(res.status, url)
  }
  throw new YahooError(0, url)
}

export class YahooError extends Error {
  constructor(public readonly status: number, url: string) {
    super(`Yahoo Finance request failed (HTTP ${status}): ${url}`)
  }
}

// ─── Price / quote ────────────────────────────────────────────────────────────

/**
 * Fetch the latest quote for a Yahoo Finance symbol.
 *
 * Uses the 1-day intraday chart (interval=5m, range=1d) so we get:
 *   - regularMarketPrice  → current price
 *   - first candle open   → today's actual opening price (reliable)
 *   - meta.previousClose  → yesterday's close (fallback for open when market not yet opened)
 *
 * Returns null when the symbol is not found or has no price data.
 */
export async function getQuote(symbol: string): Promise<YahooQuote | null> {
  // Primary: intraday chart (5m/1d) — gives us the first-candle open price
  const chartResult = await fetchChartQuote(symbol)
  if (chartResult) return chartResult

  // Fallback: v7 quote endpoint — less likely to be rate-limited
  return fetchV7Quote(symbol)
}

async function fetchChartQuote(symbol: string): Promise<YahooQuote | null> {
  const url = `${BASE_V8}/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d`

  let res: Response
  try {
    res = await fetchWithRetry(url)
  } catch {
    return null
  }

  let json: unknown
  try { json = await res.json() } catch { return null }

  const result = (json as any)?.chart?.result?.[0]
  const meta   = result?.meta

  if (!meta) return null

  const price = meta.regularMarketPrice as number | undefined
  if (!price || price <= 0) return null

  const priceDate = new Date((meta.regularMarketTime as number) * 1000)
    .toISOString()
    .split("T")[0]

  const dailyChange   = (meta.regularMarketChange as number | undefined) ?? 0
  const previousClose = (meta.previousClose ?? meta.chartPreviousClose ?? price - dailyChange) as number

  // Opening price = official regularMarketOpen (auction price at market open).
  // The first 5m candle can be a pre-market candle with a very different price,
  // which would produce wildly incorrect day-change values.
  const regularOpen = meta.regularMarketOpen as number | undefined
  const openPrice   = (regularOpen && regularOpen > 0) ? regularOpen : previousClose

  return {
    symbol,
    price,
    openPrice,
    previousClose,
    dailyChange,
    currency:    (meta.currency as string) ?? "USD",
    priceDate,
    marketState: (meta.marketState as string) ?? "CLOSED",
  }
}

async function fetchV7Quote(symbol: string): Promise<YahooQuote | null> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`

  let res: Response
  try {
    res = await fetchWithRetry(url)
  } catch {
    return null
  }

  let json: unknown
  try { json = await res.json() } catch { return null }

  const q = (json as any)?.quoteResponse?.result?.[0]
  if (!q) return null

  const price = q.regularMarketPrice as number | undefined
  if (!price || price <= 0) return null

  const priceDate = new Date((q.regularMarketTime as number) * 1000)
    .toISOString()
    .split("T")[0]

  const previousClose = (q.regularMarketPreviousClose ?? q.regularMarketOpen ?? price) as number
  const openPrice     = (q.regularMarketOpen ?? previousClose) as number
  const dailyChange   = (q.regularMarketChange ?? price - previousClose) as number

  return {
    symbol,
    price,
    openPrice,
    previousClose,
    dailyChange,
    currency:    (q.currency as string) ?? "USD",
    priceDate,
    marketState: (q.marketState as string) ?? "CLOSED",
  }
}

/**
 * Fetch dividend information from the quoteSummary endpoint.
 * Returns null when no dividend data is available.
 */
export async function getDividendInfo(symbol: string): Promise<YahooDividendInfo | null> {
  const url =
    `${BASE_V10}/quoteSummary/${encodeURIComponent(symbol)}` +
    `?modules=summaryDetail,defaultKeyStatistics`

  let res: Response
  try {
    res = await fetchWithRetry(url)
  } catch {
    return null
  }

  const json         = await res.json()
  const result       = json?.quoteSummary?.result?.[0]
  const summary      = result?.summaryDetail
  const keyStats     = result?.defaultKeyStatistics

  const annualRate =
    summary?.trailingAnnualDividendRate?.raw ??
    keyStats?.trailingAnnualDividendRate?.raw

  const dividendYield =
    summary?.trailingAnnualDividendYield?.raw ?? 0

  if (!annualRate || annualRate <= 0) return null

  return { annualDividendRate: annualRate, dividendYield }
}

// ─── FX rate ──────────────────────────────────────────────────────────────────

/**
 * Fetch the latest FX rate for a currency pair from Yahoo Finance.
 *
 * Yahoo FX symbol format: "EURUSD=X" gives EUR/USD (i.e. how many USD per 1 EUR).
 *
 * @returns rate as `quote per 1 base`, or null on failure.
 */
export async function getFXRateFromYahoo(
  base: string,
  quote: string
): Promise<number | null> {
  const symbol = `${base}${quote}=X`
  const url    = `${BASE_V8}/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`

  let res: Response
  try {
    res = await fetchWithRetry(url)
  } catch {
    return null
  }

  const json  = await res.json()
  const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice as number | undefined

  return price && price > 0 ? price : null
}

// ─── Symbol search ────────────────────────────────────────────────────────────

/**
 * Search Yahoo Finance for securities matching a query string.
 * Useful for the "manual ticker" input in the import review screen.
 */
export async function searchSymbol(query: string): Promise<YahooSearchResult[]> {
  const url = `${BASE_V10}/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0`

  let res: Response
  try {
    res = await fetchWithRetry(url)
  } catch {
    return []
  }

  const json    = await res.json()
  const quotes  = (json?.quotes as any[]) ?? []

  return quotes
    .filter(q => q.symbol && q.quoteType !== "OPTION")
    .map(q => ({
      symbol:    q.symbol,
      shortname: q.shortname ?? q.symbol,
      longname:  q.longname,
      exchDisp:  q.exchDisp ?? "",
      typeDisp:  q.typeDisp ?? "",
      score:     q.score ?? 0,
    }))
}

// ─── Historical chart data ────────────────────────────────────────────────────

export type YahooChartPoint = {
  date:  string   // YYYY-MM-DD
  price: number
}

export type YahooChartRange = "1wk" | "1mo" | "3mo" | "6mo" | "1y" | "5y"

/**
 * Fetch daily closing prices for a symbol over a given range.
 * Used by the position detail chart.
 */
export async function getHistoricalChart(
  symbol: string,
  range: YahooChartRange = "1y"
): Promise<YahooChartPoint[]> {
  const interval = range === "1wk" ? "1d" : range === "1mo" ? "1d" : "1d"
  const url = `${BASE_V8}/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`

  let res: Response
  try {
    res = await fetchWithRetry(url)
  } catch {
    return []
  }

  let json: unknown
  try { json = await res.json() } catch { return [] }

  const result    = (json as any)?.chart?.result?.[0]
  const timestamps: number[] = result?.timestamp ?? []
  const closes: number[]     = result?.indicators?.quote?.[0]?.close ?? []

  return timestamps
    .map((ts, i) => ({
      date:  new Date(ts * 1000).toISOString().split("T")[0],
      price: closes[i] ?? null,
    }))
    .filter(p => p.price !== null && p.price > 0) as YahooChartPoint[]
}

// ─── Detailed quote summary ───────────────────────────────────────────────────

export type YahooDetailedMetrics = {
  name:            string
  exchange:        string
  currency:        string
  quoteType:       string
  // Price
  currentPrice:    number
  dayChange:       number
  dayChangePercent: number
  dayHigh:         number | null
  dayLow:          number | null
  volume:          number | null
  avgVolume:       number | null
  // Valuation
  marketCap:       number | null
  trailingPE:      number | null
  forwardPE:       number | null
  priceToBook:     number | null
  // Earnings
  trailingEps:     number | null
  forwardEps:      number | null
  // Range
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow:  number | null
  // Risk
  beta:            number | null
  // Dividend
  dividendRate:    number | null
  dividendYield:   number | null
  // Analyst consensus
  recommendationKey:    string | null   // "strong_buy" | "buy" | "hold" | "underperform" | "sell"
  targetMeanPrice:      number | null
  targetHighPrice:      number | null
  targetLowPrice:       number | null
  numberOfAnalysts:     number | null
  // Analyst count breakdown
  strongBuy:  number
  buy:        number
  hold:       number
  sell:       number
  strongSell: number
}

export async function getDetailedMetrics(symbol: string): Promise<YahooDetailedMetrics | null> {
  // yahoo-finance2 handles the auth crumb automatically
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const yf2Pkg = require("yahoo-finance2")
  const yf2 = new yf2Pkg.default({ suppressNotices: ["yahooSurvey"] })

  let result: any
  try {
    result = await yf2.quoteSummary(symbol, {
      modules: ["price", "summaryDetail", "defaultKeyStatistics", "financialData", "recommendationTrend"],
    })
  } catch {
    return null
  }

  if (!result) return null

  const price     = result.price                    ?? {}
  const summary   = result.summaryDetail            ?? {}
  const keyStats  = result.defaultKeyStatistics     ?? {}
  const financial = result.financialData            ?? {}
  const trend     = result.recommendationTrend?.trend?.[0] ?? {}

  const n = (v: unknown): number | null => (typeof v === "number" ? v : null)

  return {
    name:             price.longName ?? price.shortName ?? symbol,
    exchange:         price.fullExchangeName ?? price.exchangeName ?? price.exchange ?? "",
    currency:         price.currency ?? "USD",
    quoteType:        price.quoteType ?? "",
    currentPrice:     n(price.regularMarketPrice)          ?? 0,
    dayChange:        n(price.regularMarketChange)         ?? 0,
    dayChangePercent: (n(price.regularMarketChangePercent) ?? 0) * 100,
    dayHigh:          n(price.regularMarketDayHigh),
    dayLow:           n(price.regularMarketDayLow),
    volume:           n(price.regularMarketVolume),
    avgVolume:        n(summary.averageVolume) ?? n(summary.averageDailyVolume10Day),
    marketCap:        n(price.marketCap) ?? n(summary.marketCap),
    trailingPE:       n(summary.trailingPE),
    forwardPE:        n(summary.forwardPE),
    priceToBook:      n(keyStats.priceToBook),
    trailingEps:      n(keyStats.trailingEps),
    forwardEps:       n(keyStats.forwardEps),
    fiftyTwoWeekHigh: n(summary.fiftyTwoWeekHigh),
    fiftyTwoWeekLow:  n(summary.fiftyTwoWeekLow),
    beta:             n(summary.beta) ?? n(keyStats.beta),
    dividendRate:     n(summary.dividendRate) ?? n(summary.trailingAnnualDividendRate),
    dividendYield:    n(summary.dividendYield) ?? n(summary.trailingAnnualDividendYield),
    recommendationKey:    financial.recommendationKey ?? null,
    targetMeanPrice:      n(financial.targetMeanPrice),
    targetHighPrice:      n(financial.targetHighPrice),
    targetLowPrice:       n(financial.targetLowPrice),
    numberOfAnalysts:     n(financial.numberOfAnalystOpinions),
    strongBuy:  trend.strongBuy  ?? 0,
    buy:        trend.buy        ?? 0,
    hold:       trend.hold       ?? 0,
    sell:       trend.sell       ?? 0,
    strongSell: trend.strongSell ?? 0,
  }
}

// ─── News ─────────────────────────────────────────────────────────────────────

export type YahooNewsItem = {
  title:     string
  publisher: string
  link:      string
  publishedAt: string    // ISO date string
  thumbnail: string | null
}

export async function getPositionNews(symbol: string, count = 8): Promise<YahooNewsItem[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=0&newsCount=${count}&enableFuzzyQuery=false`

  let res: Response
  try {
    res = await fetchWithRetry(url)
  } catch {
    return []
  }

  let json: unknown
  try { json = await res.json() } catch { return [] }

  const articles: any[] = (json as any)?.news ?? []

  return articles.map(a => ({
    title:       a.title ?? "",
    publisher:   a.publisher ?? "",
    link:        a.link ?? "",
    publishedAt: new Date((a.providerPublishTime ?? 0) * 1000).toISOString(),
    thumbnail:   a.thumbnail?.resolutions?.[0]?.url ?? null,
  }))
}

// ─── ETF pence correction ─────────────────────────────────────────────────────

/**
 * London-listed ETFs and investment trusts are often quoted in GBp (pence),
 * meaning a price of 5 230 is actually £52.30.  This helper detects that case
 * and converts to the major currency unit.
 *
 * Rule: if the Yahoo currency is "GBp" (note lowercase p), divide by 100.
 */
export function normalisePencePrice(price: number, yahooCurrency: string): number {
  return yahooCurrency === "GBp" ? price / 100 : price
}
