import { describe, expect, it } from "vitest"
import type { LedgerEvent } from "@/lib/core"
import { dividendPayments, estimateNextDividend, last12Months, totalsByYear } from "./analysis"

const ev = (id: string, date: string, type: LedgerEvent["type"], amountEur: number, instrumentId = "ko"): LedgerEvent => ({
  id, date, type, amountEur, instrumentId, quantity: 0, price: null, currency: "EUR", feeEur: 0,
})

describe("dividendPayments", () => {
  const payments = dividendPayments([
    ev("1", "2026-04-01", "dividend", 10),
    ev("2", "2026-04-01", "dividend_tax", -1.5),
    ev("3", "2025-12-01", "dividend", 8),
    ev("4", "2026-05-01", "buy", -500),
    // correctie: geboekt en teruggeboekt op dezelfde dag
    ev("5", "2026-06-01", "dividend", 3),
    ev("6", "2026-06-01", "dividend", -3),
  ])

  it("combineert dividend en bronbelasting per uitkering, nieuwste eerst", () => {
    expect(payments).toEqual([
      { date: "2026-04-01", instrumentId: "ko", grossEur: 10, taxEur: 1.5, netEur: 8.5 },
      { date: "2025-12-01", instrumentId: "ko", grossEur: 8, taxEur: 0, netEur: 8 },
    ])
  })

  it("totalen per jaar en per maand", () => {
    expect(totalsByYear(payments)).toEqual([
      { year: 2026, netEur: 8.5, count: 1 },
      { year: 2025, netEur: 8, count: 1 },
    ])
    const months = last12Months(payments, "2026-11-15")
    expect(months).toHaveLength(12)
    expect(months[0]).toEqual({ month: "2025-12", netEur: 8 })
    expect(months.find((m) => m.month === "2026-04")!.netEur).toBe(8.5)
    expect(months[11].month).toBe("2026-11")
  })
})

describe("estimateNextDividend", () => {
  it("kwartaaldividend: volgende datum = laatste + 3 maanden", () => {
    const est = estimateNextDividend(
      [
        { date: "2025-11-28", amount: 0.5 },
        { date: "2026-02-27", amount: 0.5 },
        { date: "2026-05-29", amount: 0.51 },
        { date: "2026-08-28", amount: 0.51 },
      ],
      "2026-11-15",
    )
    expect(est).toEqual({ frequency: 4, nextExDate: "2026-11-28", amountPerShare: 0.51, annualPerShare: 2.02 })
  })

  it("schuift door als de verwachte datum al voorbij is", () => {
    const est = estimateNextDividend([{ date: "2025-12-10", amount: 1 }, { date: "2026-06-10", amount: 1 }], "2026-07-01")
    expect(est?.frequency).toBe(2)
    expect(est?.nextExDate).toBe("2026-12-10")
  })

  it("geen schatting als er al lang niets is uitgekeerd of zonder historie", () => {
    expect(estimateNextDividend([{ date: "2024-03-01", amount: 1 }], "2026-11-15")).toBeNull()
    expect(estimateNextDividend([], "2026-11-15")).toBeNull()
  })
})
