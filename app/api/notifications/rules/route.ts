import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("notification_rules")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rules: data })
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Max 20 rules per user
  const { count } = await supabase
    .from("notification_rules")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
  if ((count ?? 0) >= 20)
    return NextResponse.json({ error: "Maximaal 20 regels per gebruiker" }, { status: 429 })

  // Alleen bekende velden overnemen; de rest van de body negeren
  const body = (await request.json()) as Record<string, unknown>
  const ALLOWED = ["name", "rule_type", "ticker", "isin", "threshold", "window_hours", "channels", "cooldown_min", "is_active"] as const
  const row: Record<string, unknown> = { user_id: user.id }
  for (const key of ALLOWED) if (key in body) row[key] = body[key]
  if (!["price_above", "price_below", "pct_change_up", "pct_change_down"].includes(String(row.rule_type))) {
    return NextResponse.json({ error: "Onbekend type melding" }, { status: 400 })
  }
  const { data, error } = await supabase
    .from("notification_rules")
    .insert(row)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data }, { status: 201 })
}
