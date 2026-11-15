"use client"

import { useState } from "react"
import { Bell, BellRing, Loader2, Plus, Trash2 } from "lucide-react"
import type { NotificationRule, NotificationsResponse } from "@/app/api/v2/notifications/route"
import { money, timeAgo } from "@/lib/format"
import { displayName } from "./PositionList"
import { Sheet } from "./Sheet"
import { Card, SectionTitle, Segmented, Skeleton } from "./ui"

export type NotificationsApi = {
  create: (rule: Pick<NotificationRule, "rule_type" | "ticker" | "threshold" | "channels" | "name">) => Promise<void>
  toggle: (id: string, active: boolean) => Promise<void>
  remove: (id: string) => Promise<void>
}

type RuleType = NotificationRule["rule_type"]

const TYPES: { value: RuleType; label: string }[] = [
  { value: "price_above", label: "Boven" },
  { value: "price_below", label: "Onder" },
  { value: "pct_change_up", label: "Stijgt %" },
  { value: "pct_change_down", label: "Daalt %" },
]

function describe(rule: NotificationRule, positions: NotificationsResponse["positions"]): string {
  const pos = positions.find((p) => p.ticker === rule.ticker)
  const name = pos ? displayName(pos.name) : rule.ticker ?? "?"
  const t = rule.threshold ?? 0
  const price = pos?.currency ? money(t, pos.currency) : String(t)
  switch (rule.rule_type) {
    case "price_above": return `${name} komt boven ${price}`
    case "price_below": return `${name} zakt onder ${price}`
    case "pct_change_up": return `${name} stijgt ${t}% op een dag`
    case "pct_change_down": return `${name} daalt ${t}% op een dag`
  }
}

export function NotificationsView({
  data,
  loading,
  error,
  refresh,
  api,
}: {
  data: NotificationsResponse | null
  loading: boolean
  error: string | null
  refresh: () => void
  api: NotificationsApi
}) {
  const [creating, setCreating] = useState(false)

  return (
    <div className="flex flex-col gap-5 pt-6 lg:pt-10">
      <header className="flex items-center justify-between gap-3 px-1">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight lg:text-[32px]">Notificaties</h1>
          <p className="text-[13px] text-muted">Een seintje als een koers je drempel raakt</p>
        </div>
        {data && data.positions.length > 0 && (
          <button onClick={() => setCreating(true)} className="flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-medium text-surface">
            <Plus size={17} /> Nieuw
          </button>
        )}
      </header>

      {loading && !data && <Skeleton className="h-64 rounded-3xl" />}
      {error && !data && <Card className="p-6 text-sm text-ink-2">{error}</Card>}

      {data && (
        <div className="grid gap-5 lg:grid-cols-[1fr_380px] [&>*]:min-w-0">
          <Card className="p-4 sm:p-6">
            <SectionTitle>Regels</SectionTitle>
            {data.rules.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-accent-wash text-accent">
                  <BellRing size={22} />
                </span>
                <p className="font-medium text-ink">Nog geen regels</p>
                <p className="mt-1 max-w-xs text-sm text-ink-2">Bijvoorbeeld: een melding als ASML boven € 1.400 komt of Nvidia 5% daalt.</p>
                {data.positions.length > 0 && (
                  <button onClick={() => setCreating(true)} className="mt-5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-surface">
                    Eerste regel maken
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {data.rules.map((r) => (
                  <RuleRow key={r.id} rule={r} label={describe(r, data.positions)} api={api} onChanged={refresh} />
                ))}
              </ul>
            )}
            <p className="mt-4 px-1 text-xs text-muted">Regels worden elke werkdag rond 17:00 gecontroleerd, met de koers van dat moment.</p>
          </Card>

          <Card className="p-4 sm:p-6">
            <SectionTitle>Recente meldingen</SectionTitle>
            {data.events.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted">Nog geen meldingen verstuurd</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.events.map((e) => (
                  <li key={e.id} className="flex gap-3 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2">
                      <Bell size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-ink">{e.title}</p>
                      <p className="text-[13px] text-ink-2">{e.body}</p>
                      <p className="mt-0.5 text-[12px] text-muted">{timeAgo(e.sent_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {creating && data && (
        <NewRuleSheet
          positions={data.positions}
          onClose={() => setCreating(false)}
          onCreate={async (rule) => {
            await api.create(rule)
            setCreating(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}

function RuleRow({ rule, label, api, onChanged }: { rule: NotificationRule; label: string; api: NotificationsApi; onChanged: () => void }) {
  const [active, setActive] = useState(rule.is_active)
  const [confirm, setConfirm] = useState(false)
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className={`text-[14px] font-medium ${active ? "text-ink" : "text-muted"}`}>{label}</p>
        <p className="text-[12px] text-muted">{rule.channels.map((c) => (c === "email" ? "e-mail" : c === "push" ? "push" : "in de app")).join(" · ")}</p>
      </div>
      <button
        role="switch"
        aria-checked={active}
        aria-label={active ? "Regel uitzetten" : "Regel aanzetten"}
        onClick={async () => {
          setActive(!active)
          await api.toggle(rule.id, !active)
        }}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${active ? "bg-accent" : "bg-grid"}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${active ? "left-[22px]" : "left-0.5"}`} />
      </button>
      {confirm ? (
        <button
          onClick={async () => {
            await api.remove(rule.id)
            onChanged()
          }}
          className="h-8 shrink-0 rounded-full bg-down-wash px-3 text-[12px] font-medium text-down"
        >
          Verwijderen?
        </button>
      ) : (
        <button onClick={() => setConfirm(true)} aria-label="Regel verwijderen" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
          <Trash2 size={16} />
        </button>
      )}
    </li>
  )
}

function NewRuleSheet({
  positions,
  onClose,
  onCreate,
}: {
  positions: NotificationsResponse["positions"]
  onClose: () => void
  onCreate: (rule: Pick<NotificationRule, "rule_type" | "ticker" | "threshold" | "channels" | "name">) => Promise<void>
}) {
  const [ticker, setTicker] = useState(positions[0]?.ticker ?? "")
  const [type, setType] = useState<RuleType>("price_above")
  const [threshold, setThreshold] = useState("")
  const [email, setEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pos = positions.find((p) => p.ticker === ticker)
  const isPct = type === "pct_change_up" || type === "pct_change_down"
  const value = Number(threshold.replace(",", "."))
  const valid = ticker && value > 0

  return (
    <Sheet title="Nieuwe regel" onClose={onClose}>
      <form
        className="flex flex-col gap-4 px-3 pb-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!valid) return
          setBusy(true)
          setError(null)
          try {
            await onCreate({ rule_type: type, ticker, threshold: value, channels: email ? ["in_app", "email"] : ["in_app"], name: null })
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err))
            setBusy(false)
          }
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">Positie</span>
          <select value={ticker} onChange={(e) => setTicker(e.target.value)} className="h-12 rounded-2xl bg-surface-2 px-4 text-[15px] text-ink outline-none focus:ring-2 focus:ring-accent">
            {positions.map((p) => (
              <option key={p.ticker} value={p.ticker}>
                {displayName(p.name)}
              </option>
            ))}
          </select>
          {pos?.price != null && pos.currency && <span className="px-1 text-[12px] text-muted">Huidige koers {money(pos.price, pos.currency)}</span>}
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">Melding als de koers</span>
          <Segmented label="Soort melding" options={TYPES} value={type} onChange={setType} fill />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">{isPct ? "Procent op één dag" : `Koers (${pos?.currency ?? "EUR"})`}</span>
          <div className="relative flex items-center">
            <input
              inputMode="decimal"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder={isPct ? "5" : pos?.price ? String(Math.round(pos.price)) : "100"}
              className="h-12 w-full rounded-2xl bg-surface-2 px-4 pr-12 text-[15px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
            />
            <span className="pointer-events-none absolute right-4 text-[14px] text-muted">{isPct ? "%" : pos?.currency ?? ""}</span>
          </div>
        </label>

        <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          <span>
            <span className="block text-[14px] font-medium text-ink">Ook per e-mail</span>
            <span className="block text-[12px] text-muted">Meldingen staan altijd in de app</span>
          </span>
          <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
        </label>

        {error && <p className="rounded-2xl bg-down-wash px-3 py-2 text-[13px] text-down">{error}</p>}

        <button type="submit" disabled={!valid || busy} className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-surface disabled:opacity-40">
          {busy && <Loader2 size={18} className="animate-spin" />}
          Regel opslaan
        </button>
      </form>
    </Sheet>
  )
}
