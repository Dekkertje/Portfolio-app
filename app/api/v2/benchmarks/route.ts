import { NextResponse } from "next/server"
import { benchmarkByKey } from "@/lib/benchmarks"
import { createRouteHandlerClient } from "@/lib/supabase/server"

const PAGE = 1000

export type BenchmarkSeries = { key: string; label: string; note: string; closes: [string, number][] }

// GET /api/v2/benchmarks?key=msci_world&from=YYYY-MM-DD — slotkoersen van een vergelijkingsindex
export async function GET(request: Request) {
  const db = createRouteHandlerClient(request)
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 })

  const url = new URL(request.url)
  const b = benchmarkByKey(url.searchParams.get("key") ?? "")
  if (!b) return NextResponse.json({ error: "Onbekende index" }, { status: 400 })
  const from = url.searchParams.get("from") ?? "2018-01-01"

  const closes: [string, number][] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db
      .from("benchmark_prices")
      .select("price_date, close")
      .eq("symbol", b.symbol)
      .gte("price_date", from)
      .order("price_date")
      .range(offset, offset + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const r of data ?? []) closes.push([r.price_date, Number(r.close)])
    if (!data || data.length < PAGE) break
  }

  const body: BenchmarkSeries = { key: b.key, label: b.label, note: b.note, closes }
  return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=3600" } })
}
