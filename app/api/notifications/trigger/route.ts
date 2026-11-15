import { NextResponse } from "next/server"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import webpush from "web-push"
import { Resend } from "resend"
import { isAuthorizedCron } from "@/lib/cron"
import { money } from "@/lib/format"
import { displayName } from "@/lib/names"
import { refreshStaleQuotes } from "@/lib/prices/refresh"

function initWebPush() {
  if (process.env.VAPID_SUBJECT && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    )
  }
}

function getResend() {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
}

type Rule = {
  id: string
  user_id: string
  name: string | null
  rule_type: string
  ticker: string | null
  isin: string | null
  threshold: number | null
  window_hours: number
  channels: string[]
  cooldown_min: number
  is_active: boolean
}

// GET /api/notifications/trigger — called by Vercel Cron
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  initWebPush()
  const resend = getResend()
  const supabase = createServiceSupabaseClient()

  // 1. Fetch all active price/pct rules (digest handled separately)
  const { data: rules } = await supabase
    .from("notification_rules")
    .select("*")
    .eq("is_active", true)
    .in("rule_type", ["price_above", "price_below", "pct_change_up", "pct_change_down"])

  if (!rules?.length) return NextResponse.json({ triggered: 0 })

  // 2. Actuele koersen voor de tickers in de regels (eerst verversen: de koers-cron draait pas 's avonds)
  const tickers = [...new Set(rules.map((r: Rule) => r.ticker).filter((t): t is string => Boolean(t)))]
  const { data: instruments } = await supabase.from("instruments").select("id, yahoo_symbol, name").in("yahoo_symbol", tickers)
  const nameBySymbol = new Map((instruments ?? []).map((i) => [i.yahoo_symbol as string, displayName(i.name as string)]))
  const idBySymbol = new Map((instruments ?? []).map((i) => [i.yahoo_symbol as string, i.id as string]))
  await refreshStaleQuotes(supabase, [...idBySymbol].map(([symbol, id]) => ({ id, symbol })), 10).catch(() => 0)
  const { data: quotes } = await supabase
    .from("latest_quotes")
    .select("instrument_id, price, previous_close, currency")
    .in("instrument_id", [...idBySymbol.values()])

  const quoteById = new Map((quotes ?? []).map((q) => [q.instrument_id as string, q]))
  const priceMap: Record<string, { current: number; prev: number; currency: string }> = {}
  for (const [symbol, id] of idBySymbol) {
    const q = quoteById.get(id)
    if (q) priceMap[symbol] = { current: Number(q.price), prev: Number(q.previous_close ?? q.price), currency: q.currency }
  }

  let triggered = 0

  for (const rule of rules as Rule[]) {
    if (!rule.ticker || !priceMap[rule.ticker]) continue

    const { current, prev, currency } = priceMap[rule.ticker]
    const changePct = prev > 0 ? ((current - prev) / prev) * 100 : 0
    const fmt = (n: number) => money(n, currency)
    const label = nameBySymbol.get(rule.ticker) ?? rule.ticker

    let shouldFire = false
    let title = ""
    let body = ""

    if (rule.rule_type === "price_above" && rule.threshold != null && current >= rule.threshold) {
      shouldFire = true
      title = `${label} boven ${fmt(rule.threshold)}`
      body = `${label} staat op ${fmt(current)}. Jouw drempel van ${fmt(rule.threshold)} is bereikt.`
    } else if (rule.rule_type === "price_below" && rule.threshold != null && current <= rule.threshold) {
      shouldFire = true
      title = `${label} onder ${fmt(rule.threshold)}`
      body = `${label} staat op ${fmt(current)}. Koers is onder jouw drempel van ${fmt(rule.threshold)} gedaald.`
    } else if (rule.rule_type === "pct_change_up" && rule.threshold != null && changePct >= rule.threshold) {
      shouldFire = true
      title = `${label} +${changePct.toFixed(1)}% vandaag`
      body = `${label} is vandaag ${changePct.toFixed(1)}% gestegen. Huidige koers: ${fmt(current)}.`
    } else if (rule.rule_type === "pct_change_down" && rule.threshold != null && changePct <= -rule.threshold) {
      shouldFire = true
      title = `${label} ${changePct.toFixed(1)}% vandaag`
      body = `${label} is vandaag ${Math.abs(changePct).toFixed(1)}% gedaald. Huidige koers: ${fmt(current)}.`
    }

    if (!shouldFire) continue

    // Cooldown check: skip if a recent event was already sent for this rule
    const cooldownSince = new Date(Date.now() - rule.cooldown_min * 60 * 1000).toISOString()
    const { count } = await supabase
      .from("notification_events")
      .select("*", { count: "exact", head: true })
      .eq("rule_id", rule.id)
      .gte("sent_at", cooldownSince)

    if ((count ?? 0) > 0) continue

    // Dispatch to each channel
    for (const channel of rule.channels) {
      await dispatch(supabase, resend, rule, channel, title, body, { current_price: current, change_pct: changePct })
    }
    triggered++
  }

  return NextResponse.json({ triggered })
}

async function dispatch(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  resend: Resend | null,
  rule: Rule,
  channel: string,
  title: string,
  body: string,
  payload: Record<string, unknown>,
) {
  // Always store in-app event
  await supabase.from("notification_events").insert({
    rule_id: rule.id,
    user_id: rule.user_id,
    ticker: rule.ticker,
    channel,
    title,
    body,
    payload,
  })

  if (channel === "push") {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", rule.user_id)

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, icon: "/icons/icon-192x192.png" }),
        )
      } catch (err: unknown) {
        // Remove expired subscriptions
        if ((err as { statusCode?: number }).statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
        }
      }
    }
  }

  if (channel === "email") {
    const { data: userData } = await supabase.auth.admin.getUserById(rule.user_id)
    const email = userData?.user?.email
    if (!email || !resend) return

    await resend.emails.send({
      from: "DekkerTracker <noreply@dekkertracker.nl>",
      to: email,
      subject: title,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#0b0b0b;margin-bottom:8px">${title}</h2>
          <p style="color:#334155">${body}</p>
          <hr style="border-color:#e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:12px">DekkerTracker — Persoonlijk beleggingsdashboard</p>
        </div>
      `,
    })
  }
}
