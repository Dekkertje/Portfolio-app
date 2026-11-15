import { NextResponse } from "next/server"
import { degiroToLedger } from "@/lib/import/degiro"
import { buildImportPreview } from "@/lib/import/preview"
import { matchInstruments } from "@/lib/instruments/match"
import { refreshProfiles } from "@/lib/instruments/profile"
import { existingExternalIds, saveImport } from "@/lib/ledger/repository"
import { backfillPrices } from "@/lib/prices/backfill"
import { createRouteHandlerClient, createServiceSupabaseClient } from "@/lib/supabase/server"

export const maxDuration = 60

type Db = ReturnType<typeof createRouteHandlerClient>

async function userPortfolio(db: Db, create: boolean): Promise<{ userId: string; portfolioId: string | null } | null> {
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return null
  const { data: portfolio } = await db
    .from("portfolios")
    .select("id")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (portfolio || !create) return { userId: auth.user.id, portfolioId: portfolio?.id ?? null }
  const { data: created, error } = await db.from("portfolios").insert({ user_id: auth.user.id, name: "Mijn Portfolio" }).select("id").single()
  if (error) throw new Error(`Portfolio aanmaken mislukt: ${error.message}`)
  return { userId: auth.user.id, portfolioId: created.id }
}

// GET /api/v2/import — eerdere imports
export async function GET(request: Request) {
  const db = createRouteHandlerClient(request)
  const owner = await userPortfolio(db, false)
  if (!owner) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 })
  if (!owner.portfolioId) return NextResponse.json({ batches: [] })

  const { data } = await db
    .from("import_batches")
    .select("id, source, file_names, event_count, inserted_count, created_at")
    .eq("portfolio_id", owner.portfolioId)
    .order("created_at", { ascending: false })
    .limit(10)
  return NextResponse.json({ batches: data ?? [] })
}

/**
 * POST /api/v2/import — body: { transactions: string, account?: string, fileNames: string[], dryRun?: boolean }
 * dryRun geeft een voorvertoning zonder iets op te slaan.
 */
export async function POST(request: Request) {
  const db = createRouteHandlerClient(request)
  const body = (await request.json().catch(() => null)) as {
    transactions?: string
    account?: string
    fileNames?: string[]
    dryRun?: boolean
  } | null
  if (!body?.transactions) return NextResponse.json({ error: "Transacties-bestand ontbreekt" }, { status: 400 })

  const owner = await userPortfolio(db, !body.dryRun)
  if (!owner) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 })

  let parsed: ReturnType<typeof degiroToLedger>
  try {
    parsed = degiroToLedger({ transactions: body.transactions, account: body.account })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Bestand niet te lezen" }, { status: 422 })
  }

  if (body.dryRun) {
    return NextResponse.json(await preview(db, owner.portfolioId, parsed, body.account))
  }

  const service = createServiceSupabaseClient()
  const saved = await saveImport(service, {
    portfolioId: owner.portfolioId!,
    source: "degiro",
    fileNames: (body.fileNames ?? []).slice(0, 4),
    ...parsed,
  })

  // Nieuwe effecten koppelen aan een Yahoo-symbool en meteen koersen ophalen
  const { data: instrumentRows } = await service.from("instruments").select("id").in("isin", [...parsed.instruments.keys()])
  const ids = (instrumentRows ?? []).map((r) => r.id as string)
  const matched = await matchInstruments(service, ids).catch(() => [])
  const [prices] = await Promise.all([
    backfillPrices(service, ids).catch((e) => ({ prices: 0, errors: [String(e)] })),
    refreshProfiles(service, { instrumentIds: ids }).catch(() => 0),
  ])

  return NextResponse.json({
    inserted: saved.inserted,
    total: saved.total,
    matched: matched.filter((m) => m.status !== "unmatched"),
    unmatched: matched.filter((m) => m.status === "unmatched"),
    prices: prices.prices,
  })
}

async function preview(db: Db, portfolioId: string | null, parsed: ReturnType<typeof degiroToLedger>, account?: string) {
  const existing = portfolioId ? await existingExternalIds(db, portfolioId) : new Set<string>()
  const { data: knownRows } = await db.from("instruments").select("isin, yahoo_symbol").in("isin", [...parsed.instruments.keys()])
  const known = new Map((knownRows ?? []).map((r) => [r.isin as string, r.yahoo_symbol as string | null]))
  return buildImportPreview({ ...parsed, existing, known, account })
}

export type { ImportPreview } from "@/lib/import/preview"
export type ImportResult = {
  inserted: number
  total: number
  matched: { id: string; name: string; symbol: string | null; status: string }[]
  unmatched: { id: string; name: string; isin: string }[]
  prices: number
}
export type ImportBatch = { id: string; source: string; file_names: string[]; event_count: number; inserted_count: number; created_at: string }
