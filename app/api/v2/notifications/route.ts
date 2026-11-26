import { NextResponse } from "next/server"
import { buildState } from "@/lib/core"
import { loadLedger } from "@/lib/ledger/repository"
import { createRouteHandlerClient } from "@/lib/supabase/server"

export type NotificationRule = {
  id: string
  name: string | null
  rule_type: "price_above" | "price_below" | "pct_change_up" | "pct_change_down"
  ticker: string | null
  threshold: number | null
  channels: string[]
  cooldown_min: number
  is_active: boolean
  created_at: string
}

export type NotificationEvent = { id: string; ticker: string | null; title: string; body: string; is_read: boolean; sent_at: string }

export type NotificationsResponse = {
  rules: NotificationRule[]
  events: NotificationEvent[]
  /** Open posities en volglijst-effecten met een Yahoo-symbool, om een regel voor aan te maken */
  positions: { ticker: string; name: string; price: number | null; currency: string | null }[]
}

// GET /api/v2/notifications — regels, recente meldingen en de posities waarvoor je een regel kunt maken
export async function GET(request: Request) {
  const db = createRouteHandlerClient(request)
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 })

  const [{ data: rules }, { data: events }, { data: portfolio }] = await Promise.all([
    db.from("notification_rules").select("id, name, rule_type, ticker, threshold, channels, cooldown_min, is_active, created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }),
    db.from("notification_events").select("id, ticker, title, body, is_read, sent_at").eq("user_id", auth.user.id).order("sent_at", { ascending: false }).limit(30),
    db.from("portfolios").select("id").eq("user_id", auth.user.id).order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ])

  let positions: NotificationsResponse["positions"] = []
  if (portfolio) {
    const { events: ledger, instruments } = await loadLedger(db, portfolio.id)
    const open = [...buildState(ledger).positions.values()].filter((p) => p.quantity > 0)
    const withSymbol = open.map((p) => instruments.get(p.instrumentId)).filter((i) => i?.yahoo_symbol)
    const { data: quotes } = await db.from("latest_quotes").select("instrument_id, price, currency").in("instrument_id", withSymbol.map((i) => i!.id))
    const quoteById = new Map((quotes ?? []).map((q) => [q.instrument_id as string, q]))
    positions = withSymbol
      .map((i) => ({ ticker: i!.yahoo_symbol!, name: i!.name, price: quoteById.get(i!.id)?.price ?? null, currency: quoteById.get(i!.id)?.currency ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  // Effecten op de volglijst kun je ook volgen met een regel
  const { data: watch } = await db
    .from("watchlist")
    .select("instrument_id, instruments(name, yahoo_symbol)")
    .eq("user_id", auth.user.id)
  type W = { instrument_id: string; instruments: { name: string; yahoo_symbol: string | null } | null }
  const watched = ((watch ?? []) as unknown as W[]).filter((w) => w.instruments?.yahoo_symbol && !positions.some((p) => p.ticker === w.instruments!.yahoo_symbol))
  if (watched.length) {
    const { data: wq } = await db.from("latest_quotes").select("instrument_id, price, currency").in("instrument_id", watched.map((w) => w.instrument_id))
    const byId = new Map((wq ?? []).map((q) => [q.instrument_id as string, q]))
    positions = [
      ...positions,
      ...watched.map((w) => ({ ticker: w.instruments!.yahoo_symbol!, name: w.instruments!.name, price: byId.get(w.instrument_id)?.price ?? null, currency: byId.get(w.instrument_id)?.currency ?? null })),
    ].sort((a, b) => a.name.localeCompare(b.name))
  }

  return NextResponse.json(
    { rules: (rules ?? []) as NotificationRule[], events: (events ?? []) as NotificationEvent[], positions } satisfies NotificationsResponse,
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
