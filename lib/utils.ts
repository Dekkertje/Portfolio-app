/**
 * Format a number as EUR currency
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format a number with 2 decimal places
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Get initials from a name (max 2 characters)
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

/**
 * Parse European number format (1.234,56 -> 1234.56)
 */
export function parseEuropeanNumber(value: string | undefined): number {
  if (!value) return 0

  return Number(
    value
      .replace(/\u00a0/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
      .trim()
  )
}

/**
 * Parse DEGIRO date format (dd-mm-yyyy -> yyyy-mm-dd)
 */
export function parseDegiroDate(value: string | undefined): string | null {
  if (!value) return null

  const parts = value.split("-")
  if (parts.length !== 3) return null

  const [day, month, year] = parts
  return `${year}-${month}-${day}`
}

/**
 * Detect transaction type based on local value
 */
export function detectTransactionType(localValue: number): string {
  if (localValue < 0) return "buy"
  if (localValue > 0) return "sell"
  return "unknown"
}

/**
 * Determines if a product is an ETF based on common keywords
 * Uses word boundary matching to avoid false positives (e.g., "NETFLIX" contains "ETF")
 */
export function isETF(productName: string): boolean {
  const upperProduct = productName.toUpperCase()
  const etfPattern = /\bETF\b|\bUCITS\b|\bTRACKER\b|\bINDEX[- ]?FUND\b/
  return etfPattern.test(upperProduct)
}

/**
 * Determines if a product is a cryptocurrency based on common names/keywords.
 * DEGIRO lists crypto as e.g. "BITCOIN" / "BTC/EUR" / "ETHEREUM" / "ETH/EUR".
 */
export function isCrypto(productName: string, isin?: string | null): boolean {
  const upper = productName.toUpperCase()
  // Known DEGIRO crypto product name patterns
  const cryptoPattern = /\b(BITCOIN|BTC|ETHEREUM|ETH|XRP|RIPPLE|SOLANA|SOL|CARDANO|ADA|POLKADOT|DOT|DOGECOIN|DOGE|LITECOIN|LTC|CHAINLINK|LINK|POLYGON|MATIC|AVALANCHE|AVAX|UNISWAP|UNI|CRYPTO|COIN)\b/
  if (cryptoPattern.test(upper)) return true
  // DEGIRO crypto ISINs often start with XD or have no ISIN (use symbol like BTC/EUR)
  if (isin && /^XD/i.test(isin)) return true
  return false
}

/**
 * Maps a DEGIRO crypto product name / ISIN to a Yahoo Finance symbol (e.g. "BTC-EUR").
 * Returns null when no mapping is known.
 *
 * DEGIRO ISIN format for crypto: "XD.BTC.EUR" — the ticker sits between the first two dots.
 * Yahoo Finance crypto format: "{TICKER}-EUR"
 */
export function getCryptoYahooSymbol(productName: string, isin?: string | null): string | null {
  // DEGIRO ISIN format: "XD.{TICKER}.{CURRENCY}" — extract both parts
  if (isin) {
    const isinMatch = isin.match(/^XD\.([A-Z0-9]+)\.([A-Z]+)$/i)
    if (isinMatch) {
      const ticker   = isinMatch[1].toUpperCase()
      const currency = isinMatch[2].toUpperCase()
      return `${ticker}-${currency}`
    }
  }

  const upper = productName.toUpperCase()

  // Detect currency suffix from product name (e.g. "XRP XRP USD" → "USD")
  const currency = upper.includes(" USD") || upper.endsWith("/USD") || upper.endsWith("-USD")
    ? "USD"
    : "EUR"

  const NAME_TO_TICKER: Record<string, string> = {
    BITCOIN:   "BTC",
    ETHEREUM:  "ETH",
    RIPPLE:    "XRP",
    XRP:       "XRP",
    SOLANA:    "SOL",
    CARDANO:   "ADA",
    POLKADOT:  "DOT",
    DOGECOIN:  "DOGE",
    LITECOIN:  "LTC",
    CHAINLINK: "LINK",
    POLYGON:   "MATIC",
    AVALANCHE: "AVAX",
    UNISWAP:   "UNI",
    COSMOS:    "ATOM",
    STELLAR:   "XLM",
    TRON:      "TRX",
    SHIBA:     "SHIB",
    PEPE:      "PEPE",
  }

  for (const [name, ticker] of Object.entries(NAME_TO_TICKER)) {
    if (upper.includes(name)) return `${ticker}-${currency}`
  }

  // Fallback: product is already a "XXX/USD", "XXX-EUR" etc. style symbol
  const slashMatch = upper.match(/^([A-Z]{2,8})[/-](EUR|USD)$/)
  if (slashMatch) return `${slashMatch[1]}-${slashMatch[2]}`

  return null
}

/**
 * Format a number as a percentage with sign
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(decimals)}%`
}

/**
 * Get sector based on product name or ISIN
 * This is a simple mapping - ideally this would come from an API
 */
export function getSector(product: string, isin?: string | null): string {
  const upperProduct = product.toUpperCase()

  // Semiconductors
  if (upperProduct.includes("ASML") || upperProduct.includes("SEMICONDUCTOR") ||
      upperProduct.includes("INTEL") || upperProduct.includes("TSM") ||
      upperProduct.includes("NVIDIA") || upperProduct.includes("AMD") ||
      upperProduct.includes("MARVELL")) {
    return "Semiconductors"
  }

  // Software & Cloud
  if (upperProduct.includes("MONGODB") || upperProduct.includes("SALESFORCE") ||
      upperProduct.includes("ORACLE") || upperProduct.includes("SAP") ||
      upperProduct.includes("SERVICENOW")) {
    return "Software & Cloud"
  }

  // Social Media & Entertainment
  if (upperProduct.includes("META") || upperProduct.includes("FACEBOOK") ||
      upperProduct.includes("NETFLIX") || upperProduct.includes("SPOTIFY") ||
      upperProduct.includes("DISNEY")) {
    return "Media & Entertainment"
  }

  // Cybersecurity
  if (upperProduct.includes("CROWDSTRIKE") || upperProduct.includes("PALO ALTO") ||
      upperProduct.includes("FORTINET") || upperProduct.includes("ZSCALER")) {
    return "Cybersecurity"
  }

  // Data Analytics & AI
  if (upperProduct.includes("PALANTIR") || upperProduct.includes("SNOWFLAKE") ||
      upperProduct.includes("DATABRICKS")) {
    return "Data Analytics"
  }

  // Technology (General)
  if (upperProduct.includes("ALPHABET") || upperProduct.includes("GOOGLE") ||
      upperProduct.includes("APPLE") || upperProduct.includes("MICROSOFT") ||
      upperProduct.includes("SOFI") || upperProduct.includes("TECH")) {
    return "Technology"
  }

  // Financial Services
  if (upperProduct.includes("ABN AMRO") || upperProduct.includes("ING GROEP") ||
      upperProduct.includes("ASR NEDERLAND") || upperProduct.includes("BANK") ||
      upperProduct.includes("FINANCIAL") || upperProduct.includes("INSURANCE") ||
      upperProduct.includes("FINTECH")) {
    return "Financial Services"
  }

  // Energy & Sustainability
  if (upperProduct.includes("FASTNED") || upperProduct.includes("ENPHASE") ||
      upperProduct.includes("SOLAR") || upperProduct.includes("RENEWABL")) {
    return "Energy"
  }

  // Consumer
  if (upperProduct.includes("AMAZON") || upperProduct.includes("TESLA") ||
      upperProduct.includes("NIKE") || upperProduct.includes("CONSUMER")) {
    return "Consumer"
  }

  // Healthcare
  if (upperProduct.includes("HEALTH") || upperProduct.includes("PHARMA") ||
      upperProduct.includes("MEDICAL") || upperProduct.includes("BIO")) {
    return "Healthcare"
  }

  // Crypto
  if (isCrypto(product, isin)) return "Crypto"

  // ETFs/Index Funds - check if it's an ETF
  if (isETF(product)) {
    if (upperProduct.includes("NASDAQ") || upperProduct.includes("QQQ")) {
      return "Tech ETF"
    }
    if (upperProduct.includes("S&P") || upperProduct.includes("SPY") || upperProduct.includes("VOO")) {
      return "Index ETF"
    }
    if (upperProduct.includes("DIVIDEND") || upperProduct.includes("HIGH YIELD")) {
      return "Dividend ETF"
    }
    return "ETF"
  }

  return "Other"
}

/**
 * Get date range for period filter
 */
export function getDateRangeForPeriod(period: string): { startDate: Date; endDate: Date } {
  const now = new Date()
  const endDate = new Date(now)
  let startDate = new Date(now)

  switch (period) {
    case '1D':
      startDate.setDate(now.getDate() - 1)
      break
    case '1W':
      startDate.setDate(now.getDate() - 7)
      break
    case '1M':
      startDate.setMonth(now.getMonth() - 1)
      break
    case '3M':
      startDate.setMonth(now.getMonth() - 3)
      break
    case '6M':
      startDate.setMonth(now.getMonth() - 6)
      break
    case '1Y':
      startDate.setFullYear(now.getFullYear() - 1)
      break
    case 'YTD':
      startDate = new Date(now.getFullYear(), 0, 1) // January 1st of current year
      break
    case 'ALL':
      startDate = new Date(2020, 0, 1) // Start from 2020 or any early date
      break
    default:
      startDate.setMonth(now.getMonth() - 1)
  }

  return { startDate, endDate }
}

/**
 * Generate simulated performance data for period
 * NOTE: This simulates portfolio growth. The actual period return calculation
 * should use real historical prices from the prices table in production.
 */
export function generatePerformanceData(
  totalCost: number,
  totalValue: number,
  period: string,
  customStartDate?: string,
  customEndDate?: string
): { date: string; value: number; invested: number; pnl: number }[] {
  let startDate: Date
  let endDate: Date

  // Handle custom date range
  if (period === 'CUSTOM' && customStartDate && customEndDate) {
    startDate = new Date(customStartDate)
    endDate = new Date(customEndDate)
  } else {
    const range = getDateRangeForPeriod(period)
    startDate = range.startDate
    endDate = range.endDate
  }

  const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  // Determine data points based on period
  let dataPoints = 12
  if (period === '1D') dataPoints = 24 // hourly
  else if (period === '1W') dataPoints = 7
  else if (period === '1M') dataPoints = 30
  else if (period === '3M') dataPoints = 90
  else if (period === '6M') dataPoints = 26 // weekly
  else if (period === '1Y') dataPoints = 52 // weekly
  else if (period === 'YTD') {
    const yearStart = new Date(new Date().getFullYear(), 0, 1)
    const daysSinceYearStart = Math.floor((endDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24))
    dataPoints = Math.max(12, Math.min(daysSinceYearStart, 52))
  }

  const stepSize = Math.max(1, Math.floor(daysDiff / dataPoints))

  // Calculate total return percentage
  const totalReturnPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) : 0

  // For short periods (1D, 1W), simulate more modest returns
  // For longer periods, use the actual total return
  let periodReturnPct = totalReturnPct

  if (period === '1D') {
    // Typical daily stock market movement: -2% to +2%
    periodReturnPct = 0.005 // 0.5% daily return simulation
  } else if (period === '1W') {
    // Typical weekly movement: -5% to +5%
    periodReturnPct = 0.015 // 1.5% weekly return simulation
  } else if (period === '1M') {
    // Typical monthly movement
    periodReturnPct = 0.03 // 3% monthly return simulation
  } else if (period === '3M') {
    // Scale based on total return
    periodReturnPct = totalReturnPct * 0.3
  } else if (period === '6M') {
    periodReturnPct = totalReturnPct * 0.5
  }

  const data: { date: string; value: number; invested: number; pnl: number }[] = []

  // Start value should be based on current value minus the period return
  const endValue = totalValue
  const startValue = endValue / (1 + periodReturnPct)

  for (let i = 0; i <= dataPoints; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(startDate.getDate() + (i * stepSize))

    // Linear interpolation from start to end value for the period
    const progress = i / dataPoints
    const interpolatedValue = startValue + (endValue - startValue) * progress

    // Add realistic volatility
    const volatility = interpolatedValue * 0.02 * Math.sin(i * 0.5)
    const finalValue = interpolatedValue + volatility

    let dateStr = ''
    if (period === '1D') {
      dateStr = `${currentDate.getHours()}:00`
    } else if (period === '1W' || period === '1M') {
      dateStr = currentDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
    } else {
      dateStr = currentDate.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
    }

    const v = Math.max(0, finalValue)
    data.push({
      date:     dateStr,
      value:    v,
      invested: totalCost,
      pnl:      v - totalCost,
    })
  }

  return data
}

export type BenchmarkType = 'sp500' | 'nasdaq100' | 'aex' | 'msci_world'

export type BenchmarkData = {
  date: string
  portfolio: number
  benchmark: number
}

/**
 * Generate benchmark performance data for comparison
 * In production, this would fetch real data from an API
 */
export function generateBenchmarkData(
  period: string,
  benchmarkType: BenchmarkType = 'sp500'
): BenchmarkData[] {
  const { startDate, endDate } = getDateRangeForPeriod(period)
  const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  let dataPoints = 12
  if (period === '1D') dataPoints = 24
  else if (period === '1W') dataPoints = 7
  else if (period === '1M') dataPoints = 30
  else if (period === '3M') dataPoints = 90
  else if (period === '6M') dataPoints = 26
  else if (period === '1Y') dataPoints = 52
  else if (period === 'YTD') {
    const yearStart = new Date(new Date().getFullYear(), 0, 1)
    const daysSinceYearStart = Math.floor((endDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24))
    dataPoints = Math.max(12, Math.min(daysSinceYearStart, 52))
  }

  const stepSize = Math.max(1, Math.floor(daysDiff / dataPoints))

  const data: BenchmarkData[] = []

  // Historical average annual returns for different indices
  // These are used to simulate period-specific returns
  const annualReturns: Record<BenchmarkType, number> = {
    sp500: 0.10,      // S&P 500: ~10% annually
    nasdaq100: 0.13,  // NASDAQ-100: ~13% annually (more tech-heavy, higher growth)
    aex: 0.08,        // AEX: ~8% annually (Dutch market)
    msci_world: 0.09, // MSCI World: ~9% annually (global diversification)
  }

  // Volatility factors (how much the simulated price moves)
  const volatilityFactors: Record<BenchmarkType, number> = {
    sp500: 0.02,
    nasdaq100: 0.03,  // Higher volatility for tech-heavy index
    aex: 0.025,
    msci_world: 0.02,
  }

  const benchmarkAnnualReturn = annualReturns[benchmarkType]
  const volatility = volatilityFactors[benchmarkType]

  // Scale the annual return to the period
  let periodReturn = benchmarkAnnualReturn
  if (period === '1D') periodReturn = benchmarkAnnualReturn / 252 // ~252 trading days/year
  else if (period === '1W') periodReturn = benchmarkAnnualReturn / 52
  else if (period === '1M') periodReturn = benchmarkAnnualReturn / 12
  else if (period === '3M') periodReturn = benchmarkAnnualReturn / 4
  else if (period === '6M') periodReturn = benchmarkAnnualReturn / 2
  else if (period === 'YTD') {
    const daysSinceYearStart = Math.floor((endDate.getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24))
    periodReturn = benchmarkAnnualReturn * (daysSinceYearStart / 365)
  }

  for (let i = 0; i <= dataPoints; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(startDate.getDate() + (i * stepSize))

    const progress = i / dataPoints

    // Simulate portfolio with moderate volatility (higher growth than benchmark)
    const portfolioGrowth = 1 + (periodReturn * 1.2 * progress) + (volatility * 1.5 * Math.sin(i * 0.7))

    // Simulate benchmark
    const benchmarkGrowth = 1 + (periodReturn * progress) + (volatility * Math.sin(i * 0.5))

    let dateStr = ''
    if (period === '1D') {
      dateStr = `${currentDate.getHours()}:00`
    } else if (period === '1W' || period === '1M') {
      dateStr = currentDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
    } else {
      dateStr = currentDate.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
    }

    data.push({
      date: dateStr,
      portfolio: portfolioGrowth * 100,
      benchmark: benchmarkGrowth * 100,
    })
  }

  return data
}

/**
 * Get display name for benchmark type
 */
export function getBenchmarkName(benchmark: BenchmarkType): string {
  const names: Record<BenchmarkType, string> = {
    sp500: 'S&P 500',
    nasdaq100: 'NASDAQ-100',
    aex: 'AEX',
    msci_world: 'MSCI World',
  }
  return names[benchmark]
}

/**
 * Calculate dividend yield
 */
export function calculateDividendYield(annualDividend: number, currentPrice: number): number {
  if (currentPrice <= 0) return 0
  return (annualDividend / currentPrice) * 100
}

/**
 * Calculate annual dividend income for a position
 */
export function calculateAnnualDividendIncome(
  annualDividendPerShare: number,
  quantity: number
): number {
  return annualDividendPerShare * quantity
}

/**
 * Format dividend frequency
 */
export function formatDividendFrequency(frequency: string | null): string {
  if (!frequency || frequency === 'none') return 'Geen'

  const mapping: Record<string, string> = {
    'annual': 'Jaarlijks',
    'quarterly': 'Kwartaal',
    'monthly': 'Maandelijks',
  }

  return mapping[frequency] || frequency
}

