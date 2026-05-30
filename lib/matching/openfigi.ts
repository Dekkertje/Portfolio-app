// OpenFIGI exchCode → Yahoo Finance suffix
const EXCH_TO_SUFFIX: Record<string, string> = {
  US: "",   // NYSE / NASDAQ (generic)
  UN: "",   // NYSE
  UW: "",   // NASDAQ NMS
  UQ: "",   // NASDAQ SC
  UR: "",   // NYSE Arca
  NA: ".AS", // Euronext Amsterdam
  GY: ".DE", // Frankfurt / Xetra
  LN: ".L",  // London
  FP: ".PA", // Euronext Paris
  BB: ".BR", // Euronext Brussels
  IM: ".MI", // Borsa Italiana
  SM: ".MC", // Madrid
  SW: ".SW", // SIX Swiss Exchange
  FH: ".HE", // Helsinki
  SS: ".ST", // Stockholm
  NO: ".OL", // Oslo
  DC: ".CO", // Copenhagen
  PL: ".LS", // Lisbon
  AV: ".VI", // Vienna
  T:  ".T",  // Tokyo
  HK: ".HK", // Hong Kong
  AU: ".AX", // Australia
  CT: ".TO", // Toronto
}

type FigiRecord = {
  figi: string
  ticker: string
  name: string
  exchCode: string
  marketSector: string
  currency?: string
}

export type FigiResult = {
  ticker: string
  yahoo_symbol: string
  name: string
  exchCode: string
}

export async function lookupByIsin(
  isin: string,
  preferredCurrency?: string | null
): Promise<FigiResult | null> {
  const apiKey = process.env.OPENFIGI_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch("https://api.openfigi.com/v3/mapping", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OPENFIGI-APIKEY": apiKey,
      },
      body: JSON.stringify([{ idType: "ID_ISIN", idValue: isin }]),
      signal: AbortSignal.timeout(6000),
    })

    if (!res.ok) return null

    const results: { data?: FigiRecord[]; error?: string }[] = await res.json()
    const records = (results[0]?.data ?? []).filter(
      r => r.marketSector === "Equity" && r.ticker && r.exchCode
    )

    if (records.length === 0) return null

    // Prefer record matching the broker's currency
    const pick = (preferredCurrency
      ? records.find(r => r.currency === preferredCurrency)
      : null) ?? records[0]

    const suffix = EXCH_TO_SUFFIX[pick.exchCode] ?? ""
    return {
      ticker: pick.ticker,
      yahoo_symbol: `${pick.ticker}${suffix}`,
      name: pick.name,
      exchCode: pick.exchCode,
    }
  } catch {
    return null
  }
}
