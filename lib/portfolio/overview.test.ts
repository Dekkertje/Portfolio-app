import { describe, expect, it } from "vitest"
import type { LedgerEvent } from "@/lib/core"
import { buildComposition, buildOverview, type OverviewInstrument, type OverviewQuote } from "./overview"

const ev = (e: Partial<LedgerEvent> & Pick<LedgerEvent, "id" | "date" | "type" | "amountEur">): LedgerEvent => ({
  instrumentId: null,
  quantity: 0,
  price: null,
  currency: "EUR",
  feeEur: 0,
  ...e,
})

const instruments = new Map<string, OverviewInstrument>([
  ["aapl", { id: "aapl", name: "APPLE INC.", isin: "US0378331005", kind: "stock", symbol: "AAPL" }],
  ["gone", { id: "gone", name: "OUD FONDS", isin: "NL0000000001", kind: "stock", symbol: null }],
])

describe("buildOverview", () => {
  const events = [
    ev({ id: "d1", date: "2026-11-02", type: "deposit", amountEur: 3000 }),
    ev({ id: "b1", date: "2026-11-02", type: "buy", instrumentId: "aapl", quantity: 10, currency: "USD", amountEur: -1800 }),
    ev({ id: "b2", date: "2026-11-02", type: "buy", instrumentId: "gone", quantity: 5, amountEur: -500 }),
    ev({ id: "s2", date: "2026-11-04", type: "sell", instrumentId: "gone", quantity: 5, amountEur: 600 }),
  ]
  const quotes = new Map<string, OverviewQuote>([
    ["aapl", { instrumentId: "aapl", price: 220, previousClose: 200, currency: "USD", quotedAt: "2026-11-06T21:00:00Z", marketState: "CLOSED" }],
  ])
  const market = {
    prices: [
      ["aapl", "2026-11-02", 180, "USD"],
      ["aapl", "2026-11-05", 200, "USD"],
      ["gone", "2026-11-02", 100, "EUR"],
    ] as [string, string, number, string][],
    fx: [["USD", "2026-11-01", 1]] as [string, string, number][],
  }

  const o = buildOverview({ events, instruments, quotes, market, today: "2026-11-06" })

  it("waardeert met de actuele koers en telt cash mee", () => {
    expect(o.totals.securitiesEur).toBe(2200)
    expect(o.totals.cashEur).toBe(1300)
    expect(o.totals.valueEur).toBe(3500)
    expect(o.totals.totalReturnEur).toBe(500) // 3500 − 3000 inleg
    expect(o.totals.unrealizedEur).toBe(400)
    expect(o.totals.realizedEur).toBe(100)
  })

  it("rekent het dagresultaat uit tegen de vorige slotkoers", () => {
    expect(o.totals.dayChangeEur).toBe(200)
    expect(o.totals.dayChangePct).toBeCloseTo(200 / 2000, 10)
    expect(o.positions[0]).toMatchObject({ instrumentId: "aapl", dayChangeEur: 200, weight: 1 })
  })

  it("scheidt open en gesloten posities", () => {
    expect(o.positions.map((p) => p.instrumentId)).toEqual(["aapl"])
    expect(o.closed).toEqual([expect.objectContaining({ instrumentId: "gone", realizedEur: 100 })])
  })

  it("bouwt een dagreeks met netto inleg en de actuele koers voor vandaag", () => {
    expect(o.series.map((p) => p.d)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"])
    expect(o.series[0]).toEqual({ d: "2026-11-02", v: 3000, n: 3000, f: 3000 })
    expect(o.series.at(-1)!.v).toBe(3500)
    expect(o.series.every((p) => p.n === 3000)).toBe(true)
  })
})

describe("buildComposition", () => {
  const pos = (instrumentId: string, valueEur: number) =>
    ({ instrumentId, valueEur, name: instrumentId, isin: "", kind: "", symbol: null, quantity: 1, price: null, currency: null, costEur: 0,
       unrealizedEur: null, unrealizedPct: null, dayChangeEur: null, dayChangePct: null, realizedEur: 0, dividendsEur: 0, weight: 0, stale: false })
  const instruments = new Map<string, OverviewInstrument>([
    ["nvda", { id: "nvda", name: "NVIDIA", isin: "", kind: "stock", symbol: "NVDA", sector: "technology", country: "United States" }],
    ["qqq", { id: "qqq", name: "NASDAQ ETF", isin: "", kind: "etf", symbol: "EQQQ", sectorWeights: { technology: 0.5, communication_services: 0.3, consumer_cyclical: 0.2 } }],
    ["x", { id: "x", name: "ONBEKEND", isin: "", kind: "stock", symbol: null }],
  ])
  const c = buildComposition([pos("nvda", 600), pos("qqq", 400), pos("x", 100)], instruments, 100, null)

  it("verdeelt naar soort inclusief cash", () => {
    expect(c.byKind.map((k) => [k.key, k.valueEur])).toEqual([["stock", 700], ["etf", 400], ["cash", 100]])
    expect(c.byKind.reduce((s, k) => s + k.weight, 0)).toBeCloseTo(1, 10)
  })

  it("kijkt door in ETF's en rapporteert de dekking", () => {
    const w = Object.fromEntries(c.bySector.map((s) => [s.key, s.weight]))
    expect(w.technology).toBeCloseTo(800 / 1000, 10) // 600 + 0,5 × 400
    expect(w.communication_services).toBeCloseTo(120 / 1000, 10)
    expect(w.energy).toBe(0)
    expect(c.bySector).toHaveLength(11)
    expect(c.sectorCoverage).toBeCloseTo(1000 / 1100, 10)
  })

  it("aandelen per land; ETF's als aparte groep", () => {
    expect(c.byCountry.map((k) => [k.key, k.valueEur])).toEqual([["United States", 600], ["funds", 400], ["unknown", 100]])
    expect(c.byCountry.reduce((s, k) => s + k.weight, 0)).toBeCloseTo(1, 10)
  })
})
