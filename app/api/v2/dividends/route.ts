import { NextResponse } from "next/server"
import { buildState, makeSeriesLookup, type Currency, type IsoDate } from "@/lib/core"
import { dividendPayments, estimateNextDividend, last12Months, totalsByYear, type DividendEstimate } from "@/lib/dividends/analysis"
import { fetchDividendHistory } from "@/lib/dividends/yahoo"
import { loadLedger } from "@/lib/ledger/repository"
import { createRouteHandlerClient } from "@/lib/supabase/server"

export const maxDuration = 30

export type UpcomingDividend = DividendEstimate & {
  instrumentId: string
  name: string
  quantity: number
  currency: Currency
  /** Verwachte bruto uitkering (aantal × laatste bedrag × huidige koers naar EUR) */
  expectedEur: number | null
  /** Verwacht bruto op jaarbasis voor deze positie */
  expectedYearEur: number | null
}

export type DividendsResponse = {
  payments: { date: IsoDate; instrumentId: string; name: string; grossEur: number; taxEur: number; netEur: number }[]
  byYear: { year: number; netEur: number; count: number }[]
  months: { month: string; netEur: number }[]
  byInstrument: { instrumentId: string; name: string; netEur: number; open: boolean }[]
  upcoming: UpcomingDividend[]
  /** Verwachte bruto dividend komende 12 maanden, op basis van de huidige posities */
  expectedYearEur: number
}

// GET /api/v2/dividends — ontvangen dividend uit het grootboek + verwachte uitkeringen
export async function GET(request: Request) {
  const db = createRouteHandlerClient(request)
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 })

  const { data: portfolio } = await db
    .from("portfolios")
    .select("id")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!portfolio) return NextResponse.json({ empty: true })

  const { events, instruments } = await loadLedger(db, portfolio.id)
  const today = new Date().toISOString().slice(0, 10)
  const name = (id: string) => instruments.get(id)?.name ?? id

  const payments = dividendPayments(events)
  const state = buildState(events)

  const perInstrument = new Map<string, number>()
  for (const p of payments) perInstrument.set(p.instrumentId, (perInstrument.get(p.instrumentId) ?? 0) + p.netEur)

  // Komende uitkeringen voor open posities met een Yahoo-symbool
  const open = [...state.positions.values()].filter((p) => p.quantity > 0 && instruments.get(p.instrumentId)?.yahoo_symbol)
  const { data: fxRows } = await db
    .from("fx_rates")
    .select("base_currency, rate_date, rate")
    .eq("quote_currency", "EUR")
    .gte("rate_date", new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10))
  const fx = makeSeriesLookup((fxRows ?? []).map((r) => [r.base_currency as string, r.rate_date as string, Number(r.rate)] as const))

  const upcoming = (
    await Promise.all(
      open.map(async (p): Promise<UpcomingDividend | null> => {
        const inst = instruments.get(p.instrumentId)!
        const hist = await fetchDividendHistory(inst.yahoo_symbol!)
        if (!hist) return null
        const est = estimateNextDividend(hist.history, today)
        if (!est) return null
        const rate = hist.currency === "EUR" ? 1 : fx(hist.currency, today)
        return {
          ...est,
          instrumentId: p.instrumentId,
          name: inst.name,
          quantity: p.quantity,
          currency: hist.currency,
          expectedEur: rate == null ? null : Math.round(p.quantity * est.amountPerShare * rate * 100) / 100,
          expectedYearEur: rate == null ? null : Math.round(p.quantity * est.annualPerShare * rate * 100) / 100,
        }
      }),
    )
  )
    .filter((u): u is UpcomingDividend => u !== null)
    .sort((a, b) => a.nextExDate.localeCompare(b.nextExDate))

  const expectedYearEur = upcoming.reduce((sum, u) => sum + (u.expectedYearEur ?? 0), 0)

  const response: DividendsResponse = {
    payments: payments.map((p) => ({ ...p, name: name(p.instrumentId) })),
    byYear: totalsByYear(payments),
    months: last12Months(payments, today),
    byInstrument: [...perInstrument.entries()]
      .map(([instrumentId, netEur]) => ({
        instrumentId,
        name: name(instrumentId),
        netEur: Math.round(netEur * 100) / 100,
        open: (state.positions.get(instrumentId)?.quantity ?? 0) > 0,
      }))
      .sort((a, b) => b.netEur - a.netEur),
    upcoming,
    expectedYearEur: Math.round(expectedYearEur * 100) / 100,
  }
  return NextResponse.json(response, { headers: { "Cache-Control": "private, no-store" } })
}
