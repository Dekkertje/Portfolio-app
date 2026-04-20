import { NextRequest, NextResponse } from "next/server"
import { createServiceSupabaseClient } from "@/lib/supabase/server"

// GET /api/debug-positions?portfolio_id=...
// Temporary debug endpoint — shows raw position calculation and tx types
export async function GET(req: NextRequest) {
  const portfolioId = req.nextUrl.searchParams.get("portfolio_id")
  if (!portfolioId) return NextResponse.json({ error: "portfolio_id required" }, { status: 400 })

  const supabase = createServiceSupabaseClient()

  const { data: txs } = await supabase
    .from("transactions")
    .select("product, isin, transaction_type, quantity, total_eur")
    .eq("portfolio_id", portfolioId)

  // Count distinct types
  const typeCounts: Record<string, number> = {}
  for (const tx of txs ?? []) {
    const t = tx.transaction_type ?? "(null)"
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }

  // Compute net quantities (same logic as dividend-calendar)
  const posMap = new Map<string, { product: string; isin: string | null; qty: number; buys: number; sells: number }>()
  for (const tx of txs ?? []) {
    const key = `${tx.product}__${tx.isin || ""}`
    const p = posMap.get(key) ?? { product: tx.product, isin: tx.isin || null, qty: 0, buys: 0, sells: 0 }
    const absQty = Math.abs(Number(tx.quantity))
    if (tx.transaction_type === "buy") {
      p.qty += absQty
      p.buys += absQty
    } else if (tx.transaction_type === "sell") {
      p.qty = Math.max(0, p.qty - absQty)
      p.sells += absQty
    }
    posMap.set(key, p)
  }

  const allPositions = [...posMap.values()].sort((a, b) => b.qty - a.qty)
  const openPositions   = allPositions.filter(p => p.qty > 0)
  const closedPositions = allPositions.filter(p => p.qty <= 0 && p.sells > 0)

  // Dividend transactions
  const dividendTxs = (txs ?? []).filter(tx =>
    tx.transaction_type && String(tx.transaction_type).toLowerCase().includes("dividend")
  )

  return NextResponse.json({
    typeCounts,
    openPositions,
    closedPositions: closedPositions.slice(0, 20),
    dividendTransactions: dividendTxs.slice(0, 20),
    totalTransactions: txs?.length ?? 0,
  })
}
