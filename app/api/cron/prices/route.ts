import { NextResponse } from "next/server"
import { isAuthorizedCron } from "@/lib/cron"
import { refreshProfiles } from "@/lib/instruments/profile"
import { syncBenchmarks } from "@/lib/prices/benchmarks"
import { collectPriceUpdates } from "@/lib/prices/sync"
import { loadSyncStatus, savePriceUpdates } from "@/lib/prices/store"
import { createServiceSupabaseClient } from "@/lib/supabase/server"

export const maxDuration = 60

// GET /api/cron/prices — dagelijks via Vercel Cron: slotkoersen, actuele koersen en FX bijwerken
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = createServiceSupabaseClient()
  const status = await loadSyncStatus(db)
  const updates = await collectPriceUpdates(status.instruments, status.fx)
  await savePriceUpdates(db, updates)
  // Sector/land/soort ververst zichzelf eens per 30 dagen per instrument
  const profiles = await refreshProfiles(db).catch(() => 0)
  const benchmarks = await syncBenchmarks(db).catch((e) => ({ rows: 0, errors: [String(e)] }))

  return NextResponse.json({
    instruments: status.instruments.length,
    dailyPrices: updates.daily.length,
    quotes: updates.quotes.length,
    fxRates: updates.fx.length,
    profiles,
    benchmarks: benchmarks.rows,
    errors: [...updates.errors, ...benchmarks.errors],
  })
}
