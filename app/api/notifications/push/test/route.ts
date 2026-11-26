import { NextResponse } from "next/server"
import webpush from "web-push"
import { createRouteHandlerClient, createServiceSupabaseClient } from "@/lib/supabase/server"

// POST /api/notifications/push/test — stuurt een testmelding naar al je aangemelde apparaten
export async function POST(request: Request) {
  const db = createRouteHandlerClient(request)
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 })

  const { VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (!VAPID_SUBJECT || !NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "Pushmeldingen zijn niet ingesteld op de server (VAPID-sleutels ontbreken)" }, { status: 503 })
  }
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  const { data: subs } = await db.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", auth.user.id)
  if (!subs?.length) return NextResponse.json({ error: "Dit account heeft nog geen apparaat aangemeld" }, { status: 404 })

  const service = createServiceSupabaseClient()
  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: "DekkerTracker", body: "Pushmeldingen werken. Je krijgt hier een seintje als een koers je drempel raakt.", url: "/notificaties" }),
      )
      sent++
    } catch (err) {
      // Verlopen abonnement opruimen
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await service.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
    }
  }
  return NextResponse.json({ sent })
}
