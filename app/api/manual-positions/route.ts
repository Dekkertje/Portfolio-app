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

    return NextResponse.json({ positions: data || [] })
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
