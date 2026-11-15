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
    expect(d.trades).toEqual([
      { d: "2026-11-02", type: "buy", quantity: 10, priceEur: 100.4 },
      { d: "2026-11-04", type: "sell", quantity: 5, priceEur: 120 },
    ])
    expect(d.events.map((e) => e.id)).toEqual(["dv", "s1", "b1"])
  })
})
