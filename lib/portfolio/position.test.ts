import { describe, expect, it } from "vitest"
import type { LedgerEvent } from "@/lib/core"
import { buildPositionDetail } from "./position"

const ev = (e: Partial<LedgerEvent> & Pick<LedgerEvent, "id" | "date" | "type" | "amountEur">): LedgerEvent => ({
  instrumentId: "nvda", quantity: 0, price: null, currency: "EUR", feeEur: 0, ...e,
})

describe("buildPositionDetail", () => {
  const d = buildPositionDetail({
    instrumentId: "nvda",
    instrument: { id: "nvda", name: "NVIDIA", isin: "US67066G1040", symbol: "NVDA", kind: "stock", sector: "technology", country: "United States", currency: "USD" },
    events: [
      ev({ id: "b1", date: "2026-11-02", type: "buy", quantity: 10, amountEur: -1004, feeEur: 4 }),
      ev({ id: "s1", date: "2026-11-04", type: "sell", quantity: 5, amountEur: 600 }),
      ev({ id: "dv", date: "2026-11-05", type: "dividend", amountEur: 1.2 }),
      ev({ id: "x", date: "2026-11-03", type: "buy", instrumentId: "other", quantity: 1, amountEur: -50 }),
    ],
    closes: [["2026-11-02", 100, "USD"], ["2026-11-04", 110, "USD"]],
    fx: [["USD", "2026-11-01", 1], ["USD", "2026-11-04", 0.9]],
    quote: { price: 120, previousClose: 110, currency: "USD" },
    today: "2026-11-06",
  })

  it("rekent koersen om naar EUR met de koers van die dag", () => {
    expect(d.series).toEqual([
      { d: "2026-11-02", p: 100 },
      { d: "2026-11-03", p: 100 },
      { d: "2026-11-04", p: 99 },
      { d: "2026-11-05", p: 99 },
      { d: "2026-11-06", p: 108 },
    ])
  })

  it("berekent kostprijs, resultaat en dagwijziging voor alleen dit instrument", () => {
    expect(d.quantity).toBe(5)
    expect(d.costEur).toBe(502)
    expect(d.avgCostEur).toBeCloseTo(100.4, 10)
    expect(d.valueEur).toBe(540)
    expect(d.unrealizedEur).toBe(38)
    expect(d.realizedEur).toBe(98)
    expect(d.dividendsEur).toBe(1.2)
    expect(d.totalReturnEur).toBe(137.2)
    expect(d.dayChangeEur).toBe(45) // 5 × (120 − 110) × 0,9
    expect(d.trades.map(({ d, type, quantity, priceEur }) => ({ d, type, quantity, priceEur }))).toEqual([
      { d: "2026-11-02", type: "buy", quantity: 10, priceEur: 100.4 },
      { d: "2026-11-04", type: "sell", quantity: 5, priceEur: 120 },
    ])
    expect(d.events.map((e) => e.id)).toEqual(["dv", "s1", "b1"])
  })

  it("geeft per trade het resultaat", () => {
    const [b, s] = d.trades
    // verkoop: 600 opbrengst − 5 × 100,4 gemiddelde kostprijs
    expect(s).toMatchObject({ id: "s1", realizedEur: 98, sinceEur: null })
    expect(s.returnPct).toBeCloseTo(98 / 502, 10)
    // koop: 5 van de 10 stuks verkocht (FIFO), dus 5 × 108 (120 USD × 0,9) − de helft van 1004
    expect(b).toMatchObject({ id: "b1", realizedEur: null, openQuantity: 5, sinceEur: 38 })
    expect(b.returnPct).toBeCloseTo(540 / 502 - 1, 10)
  })
})

describe("tradesWithResults (FIFO voor aankopen)", () => {
  const base = { instrument: { id: "x", name: "X", isin: "X", symbol: null, kind: "stock", sector: null, country: null, currency: "EUR" }, closes: [["2026-01-01", 10, "EUR"]] as [string, number, string][], fx: [], today: "2026-03-01" }
  const d = buildPositionDetail({
    ...base,
    instrumentId: "x",
    events: [
      ev({ id: "b1", date: "2026-01-01", type: "buy", instrumentId: "x", quantity: 10, amountEur: -100 }),
      ev({ id: "b2", date: "2026-01-02", type: "buy", instrumentId: "x", quantity: 10, amountEur: -120 }),
      ev({ id: "sp", date: "2026-01-03", type: "split", instrumentId: "x", amountEur: 0, splitRatio: 2 }),
      ev({ id: "s1", date: "2026-01-04", type: "sell", instrumentId: "x", quantity: 30, amountEur: 200 }),
    ],
    quote: { price: 8, previousClose: 8, currency: "EUR" },
  })

  it("eerste aankoop is volledig verkocht, tweede voor de helft", () => {
    const [b1, b2] = d.trades
    expect(b1).toMatchObject({ id: "b1", openQuantity: 0, sinceEur: null, returnPct: null })
    // b2: 20 stuks na split, 10 nog open → 10 × 8 − de helft van 120
    expect(b2).toMatchObject({ id: "b2", openQuantity: 10, sinceEur: 20 })
  })
})

describe("FIFO bij een daytrade", () => {
  // ids bewust zo dat de verkoop alfabetisch vóór de koop van dezelfde dag komt
  const d = buildPositionDetail({
    instrumentId: "x",
    instrument: { id: "x", name: "X", isin: "X", symbol: null, kind: "stock", sector: null, country: null, currency: "EUR" },
    events: [
      ev({ id: "z-buy-old", date: "2026-01-01", type: "buy", instrumentId: "x", quantity: 5, amountEur: -50 }),
      ev({ id: "b-buy", date: "2026-01-02", type: "buy", instrumentId: "x", quantity: 10, amountEur: -100 }),
      ev({ id: "a-sell", date: "2026-01-02", type: "sell", instrumentId: "x", quantity: 10, amountEur: 110 }),
    ],
    closes: [["2026-01-01", 10, "EUR"]],
    fx: [],
    quote: { price: 10, previousClose: 10, currency: "EUR" },
    today: "2026-01-05",
  })

  it("open stuks volgens FIFO tellen op tot de positie", () => {
    const open = d.trades.filter((t) => t.type === "buy").reduce((s, t) => s + (t.openQuantity ?? 0), 0)
    expect(open).toBe(d.quantity)
    expect(d.quantity).toBe(5)
    expect(d.trades.find((t) => t.id === "z-buy-old")!.openQuantity).toBe(0)
    expect(d.trades.find((t) => t.id === "b-buy")!.openQuantity).toBe(5)
  })
})
