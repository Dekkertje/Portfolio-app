import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@/lib/supabase/server"

// Returns the user's open positions with their Yahoo ticker symbols
export async function GET(request: Request) {
  const supabase = createRouteHandlerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Get user's portfolio
  const { data: portfolio } = await supabase
    .from("portfolios").select("id").eq("user_id", user.id).limit(1).maybeSingle()
  if (!portfolio) return NextResponse.json({ positions: [] })

  // Get all transactions to find unique products/ISINs
  const { data: transactions } = await supabase
    .from("transactions")
    .select("product, isin, quantity, transaction_type")
    .eq("portfolio_id", portfolio.id)
    .not("transaction_type", "ilike", "%dividend%")

  if (!transactions?.length) return NextResponse.json({ positions: [] })

  // Calculate open positions (qty > 0)
  const qty: Record<string, number> = {}
  const meta: Record<string, { product: string; isin: string | null }> = {}
  for (const tx of transactions) {
    const key = tx.isin ?? tx.product
    if (!meta[key]) meta[key] = { product: tx.product, isin: tx.isin }
    const q = Math.abs(Number(tx.quantity) || 0)
    if (tx.transaction_type === "buy")  qty[key] = (qty[key] ?? 0) + q
    if (tx.transaction_type === "sell") qty[key] = (qty[key] ?? 0) - q
  }

  const openKeys = Object.entries(qty)
    .filter(([, q]) => q > 0.0001)
    .map(([key]) => key)

  const openIsins = openKeys.map(k => meta[k]?.isin).filter(Boolean) as string[]
  const openProducts = openKeys.map(k => meta[k]?.product).filter(Boolean) as string[]

  // Look up tickers from ticker_mappings
  const results: { ticker: string; product: string }[] = []
  const seen = new Set<string>()

  if (openIsins.length) {
    const { data: mappings } = await supabase
      .from("ticker_mappings")
      .select("isin, product_name, yahoo_symbol")
      .in("isin", openIsins)
      .not("yahoo_symbol", "is", null)

    for (const m of mappings ?? []) {
      if (m.yahoo_symbol && !seen.has(m.yahoo_symbol)) {
        seen.add(m.yahoo_symbol)
        results.push({ ticker: m.yahoo_symbol, product: m.product_name ?? m.yahoo_symbol })
      }
    }
  }

  // Also include manual positions
  const { data: manual } = await supabase
    .from("manual_positions")
    .select("product_name, yahoo_symbol, quantity")
    .eq("portfolio_id", portfolio.id)
    .gt("quantity", 0)

  for (const m of manual ?? []) {
    if (m.yahoo_symbol && !seen.has(m.yahoo_symbol)) {
      seen.add(m.yahoo_symbol)
      results.push({ ticker: m.yahoo_symbol, product: m.product_name })
    }
  }

  return NextResponse.json({
    positions: results.sort((a, b) => a.product.localeCompare(b.product))
  })
}
