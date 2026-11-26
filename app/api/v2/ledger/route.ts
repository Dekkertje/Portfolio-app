import { NextResponse } from "next/server"
import { refreshProfiles } from "@/lib/instruments/profile"
import { addManualEvent, ManualError, type ManualInput } from "@/lib/ledger/manual"
import { ownPortfolio } from "@/lib/portfolio/owner"
import { backfillPrices } from "@/lib/prices/backfill"
import { createRouteHandlerClient, createServiceSupabaseClient } from "@/lib/supabase/server"

export const maxDuration = 30

// POST /api/v2/ledger — handmatige transactie toevoegen
export async function POST(request: Request) {
  const db = createRouteHandlerClient(request)
  const owner = await ownPortfolio(db, true)
  if (!owner?.portfolioId) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 })

  const input = (await request.json().catch(() => null)) as ManualInput | null
  if (!input?.type || !input.date) return NextResponse.json({ error: "Onvolledige transactie" }, { status: 400 })

  const service = createServiceSupabaseClient()
  try {
    const { externalId, instrumentId } = await addManualEvent(service, owner.portfolioId, input)
    // Nieuw of nog niet gevolgd effect: meteen koersen en profiel ophalen
    if (instrumentId) {
      await Promise.all([backfillPrices(service, [instrumentId]).catch(() => null), refreshProfiles(service, { instrumentIds: [instrumentId] }).catch(() => 0)])
    }
    return NextResponse.json({ id: externalId }, { status: 201 })
  } catch (e) {
    if (e instanceof ManualError) return NextResponse.json({ error: e.message }, { status: 422 })
    throw e
  }
}

// DELETE /api/v2/ledger?id=manual:… — alleen handmatige events kunnen weg (imports komen bij herimport toch terug)
export async function DELETE(request: Request) {
  const db = createRouteHandlerClient(request)
  const owner = await ownPortfolio(db)
  if (!owner?.portfolioId) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 })

  const id = new URL(request.url).searchParams.get("id") ?? ""
  if (!id.startsWith("manual:")) return NextResponse.json({ error: "Alleen handmatige transacties kunnen verwijderd worden" }, { status: 400 })

  const { error, count } = await db
    .from("ledger_events")
    .delete({ count: "exact" })
    .eq("portfolio_id", owner.portfolioId)
    .eq("external_id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: "Transactie niet gevonden" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
