import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()
    const { 
      portfolio_id, 
      yahoo_symbol, 
      product_name, 
      quantity, 
      average_price, 
      purchase_date,
      notes 
    } = body

    if (!portfolio_id || !yahoo_symbol || !product_name || !quantity || !average_price || !purchase_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("manual_positions")
      .insert({
        portfolio_id,
        yahoo_symbol,
        product_name,
        quantity: parseFloat(quantity),
        average_price: parseFloat(average_price),
        currency: "EUR",
        purchase_date,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("Error creating manual position:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const portfolio_id = searchParams.get("portfolio_id")

    if (!portfolio_id) {
      return NextResponse.json({ error: "Portfolio ID required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("manual_positions")
      .select("*")
      .eq("portfolio_id", portfolio_id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Enrich with current prices from Yahoo Finance
    const enrichedPositions = await Promise.all(
      (data || []).map(async (position) => {
        try {
          // Fetch current price from Yahoo Finance
          const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${position.yahoo_symbol}?interval=1d&range=1d`
          const yahooRes = await fetch(yahooUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          })

          if (yahooRes.ok) {
            const yahooData = await yahooRes.json()
            const quote = yahooData?.chart?.result?.[0]?.meta
            const currentPrice = quote?.regularMarketPrice || quote?.previousClose || 0

            return {
              ...position,
              current_price: currentPrice,
              current_value: currentPrice * position.quantity,
              unrealized_pnl: (currentPrice * position.quantity) - (position.average_price * position.quantity),
              unrealized_pnl_pct: position.average_price > 0
                ? ((currentPrice - position.average_price) / position.average_price) * 100
                : 0
            }
          }
        } catch (err) {
          console.error(`Error fetching price for ${position.yahoo_symbol}:`, err)
        }

        // Return position without price data if fetch failed
        return {
          ...position,
          current_price: 0,
          current_value: 0,
          unrealized_pnl: 0,
          unrealized_pnl_pct: 0
        }
      })
    )

    return NextResponse.json({ positions: enrichedPositions })
  } catch (error: any) {
    console.error("Error fetching manual positions:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Position ID required" }, { status: 400 })
    }

    const { error } = await supabase
      .from("manual_positions")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting manual position:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
