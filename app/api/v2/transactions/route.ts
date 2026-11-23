import { NextResponse } from "next/server"
import { sellResults, type LedgerEvent } from "@/lib/core"
import { loadLedger } from "@/lib/ledger/repository"
import { createRouteHandlerClient } from "@/lib/supabase/server"

export type TransactionRow = Omit<LedgerEvent, "instrumentId"> & {
  instrumentId: string | null
  name: string | null
  symbol: string | null
  /** Alleen bij verkopen: resultaat t.o.v. de gemiddelde kostprijs */
  realizedEur?: number
  returnPct?: number | null
}
export type TransactionsResponse = { transactions: TransactionRow[] }

// GET /api/v2/transactions — het volledige grootboek, nieuwste eerst
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
  if (!events.length) return NextResponse.json({ empty: true })

  const sells = sellResults(events)
  const transactions: TransactionRow[] = events
    .map((e) => {
      const inst = e.instrumentId ? instruments.get(e.instrumentId) : undefined
      const sell = sells.get(e.id)
      return {
        ...e,
        name: inst?.name ?? null,
        symbol: inst?.yahoo_symbol ?? null,
        ...(sell ? { realizedEur: Math.round(sell.realizedEur * 100) / 100, returnPct: sell.returnPct } : {}),
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

  return NextResponse.json({ transactions } satisfies TransactionsResponse, { headers: { "Cache-Control": "private, no-store" } })
}
