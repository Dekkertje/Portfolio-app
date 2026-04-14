/**
 * Exchange identification and Yahoo Finance symbol suffix mapping.
 *
 * DEGIRO uses its own short codes (AMS, NAS, XETRA, …).
 * Yahoo Finance uses exchange-specific suffixes (.AS, .DE, …) or no suffix (US markets).
 *
 * Approach:
 *   1. Normalise the broker code → MIC (ISO 10383)
 *   2. Derive Yahoo suffix from the MIC
 */

// ─── Broker code → MIC ─────────────────────────────────────────────────────

export const BROKER_TO_MIC: Record<string, string> = {
  // Amsterdam
  AMS:    "XAMS",
  XAMS:   "XAMS",
  EAM:    "XAMS",

  // Frankfurt / Xetra
  XETRA:  "XETR",
  ETR:    "XETR",
  FRA:    "XETR",
  GER:    "XETR",

  // NASDAQ
  NAS:    "XNAS",
  NASDAQ: "XNAS",
  NDQ:    "XNAS",

  // NYSE
  NYSE:   "XNYS",
  NYS:    "XNYS",

  // London
  LSE:    "XLON",
  LON:    "XLON",

  // Paris
  EPA:    "XPAR",
  PAR:    "XPAR",

  // Brussels
  EBR:    "XBRU",
  BRU:    "XBRU",

  // Milan
  BIT:    "XMIL",
  MIL:    "XMIL",

  // Madrid
  BME:    "XMAD",
  MAD:    "XMAD",

  // Zurich
  SWX:    "XSWX",
  VTX:    "XSWX",

  // Helsinki
  HEL:    "XHEL",

  // Stockholm
  STO:    "XSTO",
  OMX:    "XSTO",

  // Oslo
  OSL:    "XOSL",

  // Copenhagen
  CSE:    "XCSE",
  KFB:    "XCSE",

  // Lisbon
  ELI:    "XLIS",

  // Vienna
  VSE:    "XWBO",

  // Toronto
  TSX:    "XTSE",

  // Tokyo
  TYO:    "XTKS",

  // Hong Kong
  HKEX:   "XHKG",
  HKG:    "XHKG",

  // Australia
  ASX:    "XASX",
}

// ─── MIC → Yahoo Finance suffix ────────────────────────────────────────────

export const MIC_TO_YAHOO_SUFFIX: Record<string, string> = {
  XAMS: ".AS",   // Euronext Amsterdam
  XETR: ".DE",   // Frankfurt / Xetra
  XLON: ".L",    // London Stock Exchange
  XPAR: ".PA",   // Euronext Paris
  XBRU: ".BR",   // Euronext Brussels
  XMIL: ".MI",   // Borsa Italiana
  XMAD: ".MC",   // Madrid
  XSWX: ".SW",   // SIX Swiss Exchange
  XHEL: ".HE",   // Helsinki
  XSTO: ".ST",   // Stockholm
  XOSL: ".OL",   // Oslo
  XCSE: ".CO",   // Copenhagen
  XLIS: ".LS",   // Lisbon
  XWBO: ".VI",   // Vienna
  XTSE: ".TO",   // Toronto
  XTKS: ".T",    // Tokyo
  XHKG: ".HK",   // Hong Kong
  XASX: ".AX",   // Australia
  // US markets — no suffix
  XNAS: "",
  XNYS: "",
}

// ─── European MICs (used for ADR filtering) ─────────────────────────────────

export const EUROPEAN_MICS = new Set([
  "XAMS", "XETR", "XLON", "XPAR", "XBRU",
  "XMIL", "XMAD", "XSWX", "XHEL", "XSTO",
  "XOSL", "XCSE", "XLIS", "XWBO",
])

// ─── Public helpers ─────────────────────────────────────────────────────────

/**
 * Normalise any broker/exchange code to a MIC.
 * Returns the input uppercased if no mapping is found (passthrough).
 */
export function normaliseMic(brokerCode: string): string {
  return BROKER_TO_MIC[brokerCode.toUpperCase()] ?? brokerCode.toUpperCase()
}

/**
 * Returns the Yahoo Finance symbol suffix for a given broker exchange code.
 *
 * @example
 * getYahooSuffix("AMS")   // ".AS"
 * getYahooSuffix("NASDAQ") // ""
 * getYahooSuffix("XETRA") // ".DE"
 */
export function getYahooSuffix(brokerCode: string): string {
  const mic = normaliseMic(brokerCode)
  return MIC_TO_YAHOO_SUFFIX[mic] ?? ""
}

/**
 * Build a Yahoo Finance symbol from a ticker and an exchange code.
 *
 * @example
 * buildYahooSymbol("ASML", "AMS")  // "ASML.AS"
 * buildYahooSymbol("AAPL", "NAS")  // "AAPL"
 */
export function buildYahooSymbol(ticker: string, brokerCode?: string): string {
  if (!brokerCode) return ticker
  return `${ticker}${getYahooSuffix(brokerCode)}`
}

/**
 * Returns true when the exchange code maps to a European listing.
 */
export function isEuropeanExchange(brokerCode?: string): boolean {
  if (!brokerCode) return false
  return EUROPEAN_MICS.has(normaliseMic(brokerCode))
}
