import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// GET /api/diagnose-prices?portfolio_id=xxx
// Shows which positions have prices and which don't
export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const portfolio_id = searchParams.get("portfolio_id")

    if (!portfolio_id) {
      return NextResponse.json({ error: "portfolio_id required" }, { status: 400 })
    }

    // Get all unique positions from transactions
    const { data: transactions } = await supabase
      .from("transactions")
      .select("product, isin")
      .eq("portfolio_id", portfolio_id)

    // Get manual positions
    const { data: manualPositions } = await supabase
      .from("manual_positions")
      .select("product_name, isin, yahoo_symbol")
      .eq("portfolio_id", portfolio_id)

    // Get latest prices
    const { data: prices } = await supabase
      .from("prices")
      .select("product, price, price_date, source")

    // Get ticker mappings
    const { data: tickerMappings } = await supabase
      .from("ticker_mappings")
      .select("product_name, isin, yahoo_symbol, is_approved")
      .eq("is_approved", true)

    // Build unique positions list
    const positionsMap = new Map()

    // Add from transactions
    transactions?.forEach(t => {
      const key = `${t.product}__${t.isin || 'NO_ISIN'}`
      if (!positionsMap.has(key)) {
        positionsMap.set(key, {
          product: t.product,
          isin: t.isin,
          source: 'imported',
          yahoo_symbol: null
        })
      }
    })

    // Add from manual positions
    manualPositions?.forEach(mp => {
      const key = `${mp.product_name}__${mp.isin || mp.yahoo_symbol || 'NO_ISIN'}`
      if (!positionsMap.has(key)) {
        positionsMap.set(key, {
          product: mp.product_name,
          isin: mp.isin,
          source: 'manual',
          yahoo_symbol: mp.yahoo_symbol
        })
      }
    })

    // Check each position
    const diagnosis = []

    for (const [key, pos] of positionsMap.entries()) {
      // Check if has price
      const latestPrice = prices?.find(p => p.product === pos.product)
      
      // Check if has ticker mapping
      const mapping = tickerMappings?.find(tm => 
        tm.isin === pos.isin || tm.product_name === pos.product
      )

      // Diagnosis
      const status = {
        product: pos.product,
        isin: pos.isin || 'NULL',
        source: pos.source,
        has_price: !!latestPrice,
        price: latestPrice?.price || null,
        price_age_days: latestPrice ? 
          Math.floor((Date.now() - new Date(latestPrice.price_date).getTime()) / (1000 * 60 * 60 * 24)) : 
          null,
        has_ticker_mapping: !!mapping,
        yahoo_symbol: mapping?.yahoo_symbol || pos.yahoo_symbol || 'UNKNOWN',
        needs_mapping: !mapping && !pos.yahoo_symbol,
        status: getStatus(latestPrice, mapping, pos)
      }

      diagnosis.push(status)
    }

    // Group by status
    const summary = {
      total_positions: diagnosis.length,
      with_prices: diagnosis.filter(d => d.has_price).length,
      without_prices: diagnosis.filter(d => !d.has_price).length,
      needs_ticker_mapping: diagnosis.filter(d => d.needs_mapping).length,
      stale_prices: diagnosis.filter(d => d.price_age_days && d.price_age_days > 7).length,
    }

    return NextResponse.json({
      summary,
      positions: diagnosis.sort((a, b) => {
        // Sort: problems first
        if (a.status !== b.status) {
          const order: Record<string, number> = {
            '❌ NO PRICE': 0,
            '⚠️ STALE': 1,
            '⚠️ NO MAPPING': 2,
            '✅ OK': 3
          }
          return (order[a.status] || 999) - (order[b.status] || 999)
        }
        return a.product.localeCompare(b.product)
      })
    })

  } catch (error: any) {
    console.error("Diagnose prices error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function getStatus(latestPrice: any, mapping: any, pos: any): string {
  if (!latestPrice) {
    if (!mapping && !pos.yahoo_symbol) {
      return '⚠️ NO MAPPING'
    }
    return '❌ NO PRICE'
  }
  
  const agedays = Math.floor((Date.now() - new Date(latestPrice.price_date).getTime()) / (1000 * 60 * 60 * 24))
  if (agedays > 7) {
    return '⚠️ STALE'
  }
  
  return '✅ OK'
}
