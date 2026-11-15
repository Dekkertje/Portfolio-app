import type { SupabaseClient } from "@supabase/supabase-js"
import { loadSyncStatus, savePriceUpdates } from "./store"
import { collectPriceUpdates } from "./sync"

/**
 * Haalt direct koersen op voor de gegeven instrumenten (bijv. na een import),
 * zodat het overzicht niet op de nachtelijke cron hoeft te wachten.
 */
export async function backfillPrices(service: SupabaseClient, instrumentIds: string[]): Promise<{ prices: number; errors: string[] }> {
  if (!instrumentIds.length) return { prices: 0, errors: [] }
  const wanted = new Set(instrumentIds)
  const status = await loadSyncStatus(service)
  const instruments = status.instruments.filter((i) => wanted.has(i.instrumentId))
  if (!instruments.length) return { prices: 0, errors: [] }
  const updates = await collectPriceUpdates(instruments, status.fx)
  await savePriceUpdates(service, updates)
  return { prices: updates.daily.length, errors: updates.errors }
}
