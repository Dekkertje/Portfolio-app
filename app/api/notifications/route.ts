import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@/lib/supabase/server"

// GET /api/notifications — fetch latest 20, unread count
export async function GET(request: Request) {
  const supabase = createRouteHandlerClient(request)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const unread = (data ?? []).filter(n => !n.is_read).length
  return NextResponse.json({ notifications: data ?? [], unread })
}

// PATCH /api/notifications — mark as read
// Body: { id } or { all: true }
export async function PATCH(request: Request) {
  const supabase = createRouteHandlerClient(request)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { id?: string; all?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  if (body.all) {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false)
  } else if (body.id) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", body.id).eq("user_id", user.id)
  }

  return NextResponse.json({ ok: true })
}
