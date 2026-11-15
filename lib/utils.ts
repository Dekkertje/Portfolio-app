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
 * Detect transaction type based on local value, with total_eur as fallback.
 * DEGIRO CSVs occasionally omit the local-currency value (e.g. cash transactions),
 * so we use total_eur sign when localValue is zero.
 */
export function detectTransactionType(localValue: number, totalEur?: number): string {
  if (localValue < 0) return "buy"
  if (localValue > 0) return "sell"
  // Fallback: use total_eur sign (negative = money left account = buy)
  if (totalEur !== undefined && totalEur < 0) return "buy"
  if (totalEur !== undefined && totalEur > 0) return "sell"
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

export type BenchmarkType = 'sp500' | 'nasdaq100' | 'aex' | 'msci_world'

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

