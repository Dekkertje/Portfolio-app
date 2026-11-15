import type { Currency, IsoDate } from "@/lib/core"

const MINOR: Record<string, { currency: Currency; divisor: number }> = {
  GBp: { currency: "GBP", divisor: 100 },
  GBX: { currency: "GBP", divisor: 100 },
  ZAc: { currency: "ZAR", divisor: 100 },
}

/** Dividenduitkeringen per aandeel van de laatste twee jaar (noteringsvaluta). Null bij een fout. */
export async function fetchDividendHistory(symbol: string): Promise<{ currency: Currency; history: { date: IsoDate; amount: number }[] } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1mo&events=div`
  try {
    // Uitkeringshistorie verandert hooguit eens per kwartaal: zes uur cachen
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 21_600 } })
    if (!res.ok) return null
    const json = (await res.json()) as {
      chart?: { result?: { meta?: { currency?: string; gmtoffset?: number }; events?: { dividends?: Record<string, { date: number; amount: number }> } }[] }
    }
    const r = json.chart?.result?.[0]
    if (!r) return null
    const minor = MINOR[r.meta?.currency ?? ""]
    const offset = r.meta?.gmtoffset ?? 0
    const history = Object.values(r.events?.dividends ?? {}).map((d) => ({
      date: new Date((d.date + offset) * 1000).toISOString().slice(0, 10),
      amount: d.amount / (minor?.divisor ?? 1),
    }))
    return { currency: minor?.currency ?? r.meta?.currency ?? "USD", history }
  } catch {
    return null
  }
}
