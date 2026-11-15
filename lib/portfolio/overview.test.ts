import { describe, expect, it } from "vitest"
import type { LedgerEvent } from "@/lib/core"
import { buildOverview, type OverviewInstrument, type OverviewQuote } from "./overview"

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
