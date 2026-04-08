import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: userData, error: authError } = await supabase.auth.getUser()

    if (authError || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: alerts, error } = await supabase
      .from("price_alerts")
      .select("*")
      .eq("user_id", userData.user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ alerts: alerts || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: userData, error: authError } = await supabase.auth.getUser()

    if (authError || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { product, isin, alert_type, target_value } = body

    if (!product || !alert_type || target_value === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { data, error } = await supabase.from("price_alerts").insert({
      user_id: userData.user.id,
      product,
      isin: isin || null,
      alert_type,
      target_value,
      is_active: true,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const alertId = searchParams.get("id")

    if (!alertId) {
      return NextResponse.json({ error: "Alert ID required" }, { status: 400 })
    }

    const { error } = await supabase
      .from("price_alerts")
      .update({ is_active: false })
      .eq("id", alertId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

