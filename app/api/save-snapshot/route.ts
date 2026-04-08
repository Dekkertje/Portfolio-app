import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()
    const { portfolio_id, total_value, total_cost, total_return, total_return_pct, position_count } = body

    if (!portfolio_id) {
      return NextResponse.json({ error: "Portfolio ID required" }, { status: 400 })
    }

    // Check if snapshot already exists for today
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase
      .from("portfolio_snapshots")
      .select("id")
      .eq("portfolio_id", portfolio_id)
      .eq("snapshot_date", today)
      .single()

    if (existing) {
      // Update existing snapshot
      const { error } = await supabase
        .from("portfolio_snapshots")
        .update({
          total_value,
          total_cost,
          total_return,
          total_return_pct,
          position_count,
        })
        .eq("id", existing.id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: "Snapshot bijgewerkt" })
    }

    // Create new snapshot
    const { error } = await supabase.from("portfolio_snapshots").insert({
      portfolio_id,
      snapshot_date: today,
      total_value,
      total_cost,
      total_return,
      total_return_pct,
      position_count,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Snapshot opgeslagen" })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const portfolio_id = searchParams.get("portfolio_id")
    const period = searchParams.get("period") || "1M"

    if (!portfolio_id) {
      return NextResponse.json({ error: "Portfolio ID required" }, { status: 400 })
    }

    // Calculate date range based on period
    const endDate = new Date()
    const startDate = new Date()

    switch (period) {
      case '1W':
        startDate.setDate(endDate.getDate() - 7)
        break
      case '1M':
        startDate.setMonth(endDate.getMonth() - 1)
        break
      case '3M':
        startDate.setMonth(endDate.getMonth() - 3)
        break
      case '6M':
        startDate.setMonth(endDate.getMonth() - 6)
        break
      case '1Y':
        startDate.setFullYear(endDate.getFullYear() - 1)
        break
      case 'YTD':
        startDate.setMonth(0, 1) // January 1st
        break
      case 'ALL':
        startDate.setFullYear(endDate.getFullYear() - 5) // 5 years back
        break
      default:
        startDate.setMonth(endDate.getMonth() - 1)
    }

    const { data, error } = await supabase
      .from("portfolio_snapshots")
      .select("*")
      .eq("portfolio_id", portfolio_id)
      .gte("snapshot_date", startDate.toISOString().split('T')[0])
      .lte("snapshot_date", endDate.toISOString().split('T')[0])
      .order("snapshot_date", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ snapshots: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

