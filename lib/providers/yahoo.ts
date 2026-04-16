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
