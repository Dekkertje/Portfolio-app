import { describe, expect, it } from "vitest"
import { buildDailySeries, buildState, flowsFromSeries, twr, valuePortfolio, xirr } from "./index"
import type { LedgerEvent, Quote } from "./types"

let seq = 0
function ev(partial: Partial<LedgerEvent> & Pick<LedgerEvent, "date" | "type" | "amountEur">): LedgerEvent {
  return {
    id: `e${String(++seq).padStart(4, "0")}`,
    instrumentId: null,
    quantity: 0,
    price: null,
    currency: "EUR",
    feeEur: 0,
    ...partial,
  }
}

const buy = (date: string, id: string, qty: number, totalEur: number, feeEur = 0) =>
  ev({ date, type: "buy", instrumentId: id, quantity: qty, amountEur: -totalEur, feeEur })
const sell = (date: string, id: string, qty: number, proceedsEur: number, feeEur = 0) =>
  ev({ date, type: "sell", instrumentId: id, quantity: qty, amountEur: proceedsEur, feeEur })

describe("buildState", () => {
  it("gemiddelde kostprijs incl. kosten en gerealiseerd resultaat bij gedeeltelijke verkoop", () => {
    const s = buildState([
      buy("2024-01-02", "ASML", 10, 1002, 2),
      buy("2024-02-01", "ASML", 10, 1202, 2),
      sell("2024-03-01", "ASML", 5, 649, 1),
    ])
    const p = s.positions.get("ASML")!
    expect(p.quantity).toBe(15)
    expect(p.costBasisEur).toBeCloseTo(1653, 6)
    expect(p.realizedEur).toBeCloseTo(649 - 551, 6)
    expect(p.feesEur).toBe(5)
  })

  it("volledig verkopen zet kostprijs op nul; herkoop begint opnieuw", () => {
    const s = buildState([
      buy("2024-01-02", "X", 10, 1000),
      sell("2024-02-01", "X", 10, 1500),
      buy("2024-03-01", "X", 5, 400),
    ])
    const p = s.positions.get("X")!
    expect(p.quantity).toBe(5)
    expect(p.costBasisEur).toBe(400)
    expect(p.realizedEur).toBe(500)
  })

  it("koop en verkoop op dezelfde dag worden in de juiste volgorde verwerkt", () => {
    // ids bewust zo dat de verkoop alfabetisch vóór de koop zou komen
    const s = buildState([
      { ...sell("2024-01-02", "X", 10, 1100), id: "a" },
      { ...buy("2024-01-02", "X", 10, 1000), id: "b" },
    ])
    expect(s.positions.get("X")!.realizedEur).toBe(100)
  })

  it("split verdubbelt stuks, kostprijs blijft gelijk", () => {
    const s = buildState([
      buy("2024-01-02", "NVDA", 10, 5000),
      ev({ date: "2024-06-10", type: "split", instrumentId: "NVDA", amountEur: 0, splitRatio: 10 }),
    ])
    const p = s.positions.get("NVDA")!
    expect(p.quantity).toBe(100)
    expect(p.costBasisEur).toBe(5000)
  })

  it("dividend is netto na bronbelasting", () => {
    const s = buildState([
      buy("2024-01-02", "KO", 10, 600),
      ev({ date: "2024-04-01", type: "dividend", instrumentId: "KO", amountEur: 4.6 }),
      ev({ date: "2024-04-01", type: "dividend_tax", instrumentId: "KO", amountEur: -0.69 }),
    ])
    expect(s.positions.get("KO")!.dividendsEur).toBeCloseTo(3.91, 6)
  })

  it("houdt cash en netto inleg bij als er stortingen zijn", () => {
    const s = buildState([
      ev({ date: "2024-01-01", type: "deposit", amountEur: 5000 }),
      buy("2024-01-02", "X", 10, 1002, 2),
      ev({ date: "2024-01-31", type: "fee", amountEur: -2.5 }),
    ])
    expect(s.tracksCash).toBe(true)
    expect(s.netDepositsEur).toBe(5000)
    expect(s.cashEur).toBeCloseTo(3995.5, 6)
  })

  it("upTo negeert latere events", () => {
    const events = [buy("2024-01-02", "X", 10, 1000), buy("2024-05-01", "X", 10, 1000)]
    expect(buildState(events, "2024-03-01").positions.get("X")!.quantity).toBe(10)
  })
})

describe("valuePortfolio", () => {
  it("rekent vreemde valuta om en valt terug op kostprijs bij ontbrekende koers", () => {
    const s = buildState([buy("2024-01-02", "AAPL", 10, 1500), buy("2024-01-02", "UNKNOWN", 1, 100)])
    const quotes = new Map<string, Quote>([["AAPL", { price: 200, currency: "USD" }]])
    const v = valuePortfolio(s, quotes, (c) => (c === "USD" ? 0.9 : null))

    expect(v.positions.find((p) => p.instrumentId === "AAPL")!.marketValueEur).toBeCloseTo(1800, 6)
    expect(v.securitiesValueEur).toBeCloseTo(1900, 6)
    expect(v.unrealizedEur).toBeCloseTo(300, 6)
    expect(v.missingQuotes).toEqual(["UNKNOWN"])
    expect(v.totalValueEur).toBeCloseTo(1900, 6) // geen stortingen → cash telt niet mee
  })

  it("telt cash mee als het rekeningoverzicht er is", () => {
    const s = buildState([ev({ date: "2024-01-01", type: "deposit", amountEur: 2000 }), buy("2024-01-02", "X", 10, 1000)])
    const v = valuePortfolio(s, new Map([["X", { price: 110, currency: "EUR" }]]), () => null)
    expect(v.totalValueEur).toBeCloseTo(1100 + 1000, 6)
  })
})

describe("rendement", () => {
  it("TWR negeert stortingen", () => {
    const points = [
      { date: "2024-01-01", valueEur: 1000, flowEur: 1000 },
      { date: "2024-01-02", valueEur: 1100, flowEur: 0 },
      { date: "2024-01-03", valueEur: 2200, flowEur: 1100 },
      { date: "2024-01-04", valueEur: 2420, flowEur: 0 },
    ]
    expect(twr(points)).toBeCloseTo(0.21, 10)
  })

  it("XIRR over een (schrikkel)jaar", () => {
    const r = xirr([
      { date: "2024-01-01", amount: -1000 },
      { date: "2025-01-01", amount: 1100 },
    ])
    expect(r).toBeCloseTo(Math.pow(1.1, 365 / 366) - 1, 6)
  })

  it("XIRR geeft null zonder positieve en negatieve stromen", () => {
    expect(xirr([{ date: "2024-01-01", amount: -1000 }])).toBeNull()
  })
})

describe("buildDailySeries", () => {
  const prices: Record<string, Record<string, number>> = {
    X: { "2024-01-02": 100, "2024-01-03": 110, "2024-01-04": 121 },
  }
  const priceAt = (id: string, date: string): Quote | null =>
    prices[id]?.[date] != null ? { price: prices[id][date], currency: "EUR" } : null

  it("zonder rekeningoverzicht: aankopen zijn instroom, dagkoers bepaalt waarde", () => {
    const series = buildDailySeries({
      events: [buy("2024-01-02", "X", 10, 1000), buy("2024-01-03", "X", 10, 1100)],
      dates: ["2024-01-02", "2024-01-03", "2024-01-04"],
      priceAt,
      fxAt: () => null,
    })
    expect(series.map((p) => p.valueEur)).toEqual([1000, 2200, 2420])
    expect(series.map((p) => p.flowEur)).toEqual([1000, 1100, 0])
    expect(series[2].costBasisEur).toBe(2100)
    expect(twr(series)).toBeCloseTo(0.21, 10)
  })

  it("met rekeningoverzicht: alleen stortingen zijn instroom, cash telt mee", () => {
    const series = buildDailySeries({
      events: [
        ev({ date: "2024-01-02", type: "deposit", amountEur: 1500 }),
        buy("2024-01-02", "X", 10, 1000),
        ev({ date: "2024-01-04", type: "dividend", instrumentId: "X", amountEur: 10 }),
      ],
      dates: ["2024-01-02", "2024-01-03", "2024-01-04"],
      priceAt,
      fxAt: () => null,
    })
    expect(series.map((p) => p.valueEur)).toEqual([1500, 1600, 1720])
    expect(series.map((p) => p.flowEur)).toEqual([1500, 0, 0])
    expect(series[2].dividendsEur).toBe(10)

    const flows = flowsFromSeries(series)
    expect(flows).toEqual([
      { date: "2024-01-02", amount: -1500 },
      { date: "2024-01-04", amount: 1720 },
    ])
  })
})
