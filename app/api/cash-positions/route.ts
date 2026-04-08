import { NextResponse } from "next/server"
import { supabaseServer as supabase } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { portfolio_id, currency, amount, description } = body

    if (!portfolio_id || !currency || amount === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Upsert - update if exists, insert if not
    const { data, error } = await supabase
      .from("cash_positions")
      .upsert({
        portfolio_id,
        currency,
        amount: parseFloat(amount),
        description: description || null,
      }, {
        onConflict: 'portfolio_id,currency'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("Error saving cash position:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const portfolio_id = searchParams.get("portfolio_id")

    if (!portfolio_id) {
      return NextResponse.json({ error: "Portfolio ID required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("cash_positions")
      .select("*")
      .eq("portfolio_id", portfolio_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ positions: data || [] })
  } catch (error: any) {
    console.error("Error fetching cash positions:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Position ID required" }, { status: 400 })
    }

    const { error } = await supabase
      .from("cash_positions")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting cash position:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
