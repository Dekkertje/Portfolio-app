import { describe, expect, it } from "vitest"
import type { LedgerEvent } from "@/lib/core"
import { yearlySummaries } from "./yearly"

const ev = (e: Partial<LedgerEvent> & Pick<LedgerEvent, "id" | "date" | "type" | "amountEur">): LedgerEvent => ({
  instrumentId: null, quantity: 0, price: null, currency: "EUR", feeEur: 0, ...e,
})

describe("yearlySummaries", () => {
  const events = [
    ev({ id: "d1", date: "2025-12-01", type: "deposit", amountEur: 1100 }),
    ev({ id: "b1", date: "2025-12-01", type: "buy", instrumentId: "asml", quantity: 1, amountEur: -1002, feeEur: 2 }),
    ev({ id: "dv", date: "2026-04-01", type: "dividend", instrumentId: "asml", amountEur: 20 }),
    ev({ id: "tx", date: "2026-04-01", type: "dividend_tax", instrumentId: "asml", amountEur: -3 }),
    ev({ id: "dv2", date: "2026-05-01", type: "dividend", instrumentId: "aapl", amountEur: 10 }),
    ev({ id: "tx2", date: "2026-05-01", type: "dividend_tax", instrumentId: "aapl", amountEur: -1.5 }),
    ev({ id: "fee", date: "2026-06-01", type: "fee", amountEur: -2.5 }),
    ev({ id: "s1", date: "2026-07-01", type: "sell", instrumentId: "asml", quantity: 1, amountEur: 1198, feeEur: 2 }),
    ev({ id: "w1", date: "2026-08-01", type: "withdrawal", amountEur: -500 }),
  ]
  const series = [
    { d: "2025-12-01", v: 1100, f: 1100 },
    { d: "2025-12-31", v: 1150, f: 0 },
    { d: "2026-01-02", v: 1160, f: 0 },
    { d: "2026-08-01", v: 820, f: -500 },
    { d: "2026-11-20", v: 830, f: 0 },
  ]
  const years = yearlySummaries({
    events,
    series,
    isinOf: (id) => (id === "asml" ? "NL0010273215" : "US0378331005"),
    tracksCash: true,
    today: "2026-11-20",
  })

  it("geeft per jaar een overzicht, nieuwste eerst", () => {
    expect(years.map((y) => [y.year, y.ongoing])).toEqual([[2026, true], [2025, false]])
  })

  it("waarde op 1 januari met effecten en cash apart", () => {
    const y = years[0]
    expect(y.startValueEur).toBe(1150)
    expect(y.startCashEur).toBe(98) // 1100 − 1002
    expect(y.startSecuritiesEur).toBe(1052)
    expect(y.endValueEur).toBe(830)
  })

  it("resultaat, geldstromen, gerealiseerd en kosten", () => {
    const y = years[0]
    expect(y.netFlowEur).toBe(-500)
    expect(y.withdrawalsEur).toBe(500)
    expect(y.resultEur).toBe(180) // 830 − 1150 + 500
    expect(y.realizedEur).toBe(196) // 1198 − 1002
    expect(y.transactionCostsEur).toBe(2)
    expect(y.otherCostsEur).toBe(2.5)
  })

  it("dividend met ingehouden belasting per land", () => {
    const y = years[0]
    expect(y.dividendGrossEur).toBe(30)
    expect(y.dividendNetEur).toBe(25.5)
    expect(y.dividendTaxByCountry).toEqual([
      { country: "NL", taxEur: 3, grossEur: 20 },
      { country: "US", taxEur: 1.5, grossEur: 10 },
    ])
  })
})
