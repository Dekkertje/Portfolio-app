import { buildState, type LedgerEvent } from "@/lib/core"
import { latestBalance, parseDegiroAccount, type DegiroImportResult } from "./degiro"

export type ImportPreview = {
  period: { from: string; to: string } | null
  total: number
  newEvents: number
  counts: Partial<Record<LedgerEvent["type"], number>>
  hasAccount: boolean
  instruments: { isin: string; name: string; open: boolean; known: boolean; symbol: string | null }[]
  warnings: string[]
  /** Cash volgens het bestand vs. het laatste saldo dat DEGIRO toont */
  reconciliation: { ledgerCash: number; degiroBalance: number } | null
}

/** Samenvatting van een import vóór het opslaan. Puur: bestaande events en bekende instrumenten worden aangeleverd. */
export function buildImportPreview(input: DegiroImportResult & {
  existing: Set<string>
  known: Map<string, string | null>
  account?: string
}): ImportPreview {
  const { events, instruments, warnings, existing, known, account } = input
  const state = buildState(events)

  const counts: ImportPreview["counts"] = {}
  for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1
  const dates = events.map((e) => e.date).sort()

  let reconciliation: ImportPreview["reconciliation"] = null
  if (account) {
    const balance = latestBalance(parseDegiroAccount(account))
    if (balance != null) reconciliation = { ledgerCash: Math.round(state.cashEur * 100) / 100, degiroBalance: balance }
  }

  const open = new Set([...state.positions.values()].filter((p) => p.quantity > 0).map((p) => p.instrumentId))

  return {
    period: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
    total: events.length,
    newEvents: events.filter((e) => !existing.has(e.id)).length,
    counts,
    hasAccount: Boolean(account),
    instruments: [...instruments.values()]
      .map((i) => ({ isin: i.isin, name: i.name, open: open.has(i.isin), known: known.has(i.isin), symbol: known.get(i.isin) ?? null }))
      // Nieuwe effecten eerst (die wil je controleren), dan open posities
      .sort((a, b) => Number(a.known) - Number(b.known) || Number(b.open) - Number(a.open) || a.name.localeCompare(b.name)),
    warnings,
    reconciliation,
  }
}
