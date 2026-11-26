/**
 * Vergelijkingsindexen. Waar mogelijk een accumulerende ETF in EUR: die bevat
 * herbelegd dividend en valutaeffect, net als jouw eigen rendement. De AEX is
 * de koersindex (zonder dividend) en staat daarom zo gelabeld.
 */
export const BENCHMARKS = [
  { key: "msci_world", label: "MSCI World", symbol: "IWDA.AS", note: "iShares Core MSCI World (acc, EUR)" },
  { key: "all_world", label: "FTSE All-World", symbol: "VWCE.DE", note: "Vanguard FTSE All-World (acc, EUR)" },
  { key: "sp500", label: "S&P 500", symbol: "SXR8.DE", note: "iShares Core S&P 500 (acc, EUR)" },
  { key: "nasdaq100", label: "Nasdaq-100", symbol: "SXRV.DE", note: "iShares Nasdaq 100 (acc, EUR)" },
  { key: "aex", label: "AEX", symbol: "^AEX", note: "AEX-koersindex, zonder dividend" },
] as const

export type BenchmarkKey = (typeof BENCHMARKS)[number]["key"]

export const benchmarkByKey = (key: string) => BENCHMARKS.find((b) => b.key === key)
