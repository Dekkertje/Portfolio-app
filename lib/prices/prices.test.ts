import { describe, expect, it } from "vitest"
import { collectPriceUpdates, syncFrom } from "./sync"
import { parseChart, type ChartResult } from "./yahoo-chart"

// 2026-07-01 en 2026-07-02 13:30 UTC (NY-open), gmtoffset New York zomertijd
const NY = -14_400
const ts = (date: string) => Date.parse(date + "T13:30:00Z") / 1000

describe("parseChart", () => {
  it("rekent split-gecorrigeerde slotkoersen terug naar de echte koers van die dag", () => {
    const r = parseChart("CRWD", {
      chart: {
        result: [
          {
            meta: { currency: "USD", regularMarketPrice: 200, regularMarketTime: ts("2026-07-06") + 20_000, gmtoffset: NY, marketState: "CLOSED" },
            timestamp: [ts("2026-07-01"), ts("2026-07-02"), ts("2026-07-06")],
            events: { splits: { x: { date: ts("2026-07-02"), numerator: 4, denominator: 1 } } },
            indicators: { quote: [{ close: [193.18, 193.98, 199.38] }] },
          },
        ],
      },
    })!
    expect(r.closes).toEqual([
      { date: "2026-07-01", close: 193.18 * 4 },
      { date: "2026-07-02", close: 193.98 },
      { date: "2026-07-06", close: 199.38 },
    ])
    expect(r.quote).toMatchObject({ price: 200, previousClose: 193.98, quoteDate: "2026-07-06" })
  })

  it("zet pence om naar ponden", () => {
    const r = parseChart("SMH.L", {
      chart: {
        result: [
          {
            meta: { currency: "GBp", regularMarketPrice: 5000, regularMarketTime: ts("2026-07-02"), gmtoffset: 3600 },
            timestamp: [ts("2026-07-01")],
            indicators: { quote: [{ close: [4900] }] },
          },
        ],
      },
    })!
    expect(r.currency).toBe("GBP")
    expect(r.closes[0].close).toBe(49)
    expect(r.quote!.price).toBe(50)
  })

  it("slaat lege slotkoersen over en geeft null zonder resultaat", () => {
    const r = parseChart("X", {
      chart: { result: [{ meta: { currency: "EUR" }, timestamp: [ts("2026-07-01")], indicators: { quote: [{ close: [null] }] } }] },
    })!
    expect(r.closes).toEqual([])
    expect(r.quote).toBeNull()
    expect(parseChart("X", { chart: { result: [] } })).toBeNull()
  })
})

describe("collectPriceUpdates", () => {
  const chart = (symbol: string, currency: string, closes: [string, number][]): ChartResult => ({
    symbol,
    currency,
    closes: closes.map(([date, close]) => ({ date, close })),
    quote: { price: closes.at(-1)![1], previousClose: null, quoteDate: "2026-11-13", quotedAt: "2026-11-13T21:00:00.000Z", marketState: "CLOSED" },
  })

  it("haalt koersen per instrument op en FX voor elke vreemde valuta", async () => {
    const calls: [string, string][] = []
    const updates = await collectPriceUpdates(
      [
        { instrumentId: "nvda", symbol: "NVDA", firstEventDate: "2026-01-10", lastPriceDate: null },
        { instrumentId: "asml", symbol: "ASML.AS", firstEventDate: "2026-02-01", lastPriceDate: "2026-11-10" },
        { instrumentId: "gone", symbol: "GONE", firstEventDate: "2026-02-01", lastPriceDate: null },
      ],
      [],
      async (symbol, from) => {
        calls.push([symbol, from])
        if (symbol === "NVDA") return chart("NVDA", "USD", [["2026-11-12", 190], ["2026-11-13", 195]])
        if (symbol === "ASML.AS") return chart("ASML.AS", "EUR", [["2026-11-13", 1000]])
        if (symbol === "USDEUR=X") return chart("USDEUR=X", "EUR", [["2026-11-12", 0.86], ["2026-11-13", 0.87]])
        return null
      },
    )

    expect(calls).toContainEqual(["NVDA", "2026-01-03"])     // eerste event − 7 dagen
    expect(calls).toContainEqual(["ASML.AS", "2026-11-03"])  // laatste koers − 7 dagen
    expect(calls).toContainEqual(["USDEUR=X", "2026-01-03"]) // vanaf het vroegste event
    expect(updates.daily).toHaveLength(3)
    expect(updates.quotes.map((q) => q.instrument_id).sort()).toEqual(["asml", "nvda"])
    expect(updates.fx).toEqual([
      { base_currency: "USD", quote_currency: "EUR", rate: 0.86, rate_date: "2026-11-12", source: "yahoo" },
      { base_currency: "USD", quote_currency: "EUR", rate: 0.87, rate_date: "2026-11-13", source: "yahoo" },
    ])
    expect(updates.errors).toEqual(["GONE: onbekend bij Yahoo"])
  })

  it("een fout bij één symbool stopt de rest niet", async () => {
    const updates = await collectPriceUpdates(
      [
        { instrumentId: "a", symbol: "A", firstEventDate: "2026-01-01", lastPriceDate: null },
        { instrumentId: "b", symbol: "B", firstEventDate: "2026-01-01", lastPriceDate: null },
      ],
      [],
      async (symbol) => {
        if (symbol === "A") throw new Error("HTTP 500")
        return chart("B", "EUR", [["2026-11-13", 10]])
      },
    )
    expect(updates.daily).toHaveLength(1)
    expect(updates.errors).toEqual(["A: HTTP 500"])
  })

  it("syncFrom", () => {
    expect(syncFrom(null, "2026-03-10")).toBe("2026-03-03")
    expect(syncFrom("2026-03-10", "2020-01-01")).toBe("2026-03-03")
  })
})
