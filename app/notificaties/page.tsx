"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { authFetch } from "@/lib/supabase/client"
import { Bell, Plus, Trash2, Pause, Play, Mail, Smartphone, MonitorSmartphone, ChevronDown } from "lucide-react"
import { useToast } from "@/components/ui/Toast"

type RuleType = "price_above" | "price_below" | "pct_change_up" | "pct_change_down" | "digest" | "dividend"
type Channel = "in_app" | "email" | "push"
type DigestFreq = "daily" | "weekly" | "monthly"

interface Rule {
  id: string
  name: string | null
  rule_type: RuleType
  ticker: string | null
  threshold: number | null
  window_hours: number
  channels: Channel[]
  cooldown_min: number
  is_active: boolean
  digest_freq: DigestFreq | null
  digest_time: string | null
  created_at: string
}

const RULE_LABELS: Record<RuleType, string> = {
  price_above:     "Koers boven",
  price_below:     "Koers onder",
  pct_change_up:   "% stijging",
  pct_change_down: "% daling",
  digest:          "Periodiek overzicht",
  dividend:        "Dividend",
}

const CHANNEL_ICONS: Record<Channel, React.ReactNode> = {
  in_app: <MonitorSmartphone className="h-3.5 w-3.5" />,
  email:  <Mail className="h-3.5 w-3.5" />,
  push:   <Smartphone className="h-3.5 w-3.5" />,
}

const CHANNEL_LABELS: Record<Channel, string> = {
  in_app: "In-app",
  email:  "E-mail",
  push:   "Push",
}

const DEFAULT_FORM = {
  name: "",
  rule_type: "price_above" as RuleType,
  ticker: "",
  threshold: "",
  window_hours: 24,
  channels: ["in_app"] as Channel[],
  cooldown_min: 60,
  digest_freq: "daily" as DigestFreq,
  digest_time: "18:00",
}

export default function NotificatiesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const { showToast } = useToast()

  async function load() {
    setLoading(true)
    const res = await authFetch("/api/notifications/rules")
    if (res.ok) {
      const data = await res.json()
      setRules(data.rules ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    const body: Record<string, unknown> = {
      name:         form.name || null,
      rule_type:    form.rule_type,
      channels:     form.channels,
      cooldown_min: form.cooldown_min,
      is_active:    true,
    }

    if (["price_above","price_below","pct_change_up","pct_change_down","dividend"].includes(form.rule_type)) {
      body.ticker        = form.ticker.toUpperCase()
      body.threshold     = form.rule_type === "dividend" ? null : parseFloat(form.threshold) || null
      body.window_hours  = form.window_hours
    }
    if (form.rule_type === "digest") {
      body.digest_freq = form.digest_freq
      body.digest_time = form.digest_time
    }

    const res = await authFetch("/api/notifications/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      showToast("Notificatieregel aangemaakt", "success")
      setShowForm(false)
      setForm(DEFAULT_FORM)
      load()
    } else {
      const err = await res.json()
      showToast(err.error ?? "Fout bij opslaan", "error")
    }
    setSaving(false)
  }

  async function toggle(rule: Rule) {
    await authFetch(`/api/notifications/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !rule.is_active }),
    })
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
  }

  async function remove(id: string) {
    await authFetch(`/api/notifications/rules/${id}`, { method: "DELETE" })
    setRules(prev => prev.filter(r => r.id !== id))
    showToast("Regel verwijderd", "success")
  }

  function toggleChannel(ch: Channel) {
    setForm(f => ({
      ...f,
      channels: f.channels.includes(ch)
        ? f.channels.filter(c => c !== ch)
        : [...f.channels, ch],
    }))
  }

  function ruleDescription(rule: Rule) {
    if (rule.rule_type === "digest") return `${rule.digest_freq} om ${rule.digest_time ?? "18:00"}`
    if (rule.rule_type === "dividend") return `Dividend alert voor ${rule.ticker}`
    if (rule.rule_type === "price_above") return `${rule.ticker} > €${rule.threshold}`
    if (rule.rule_type === "price_below") return `${rule.ticker} < €${rule.threshold}`
    if (rule.rule_type === "pct_change_up")   return `${rule.ticker} +${rule.threshold}% in ${rule.window_hours}u`
    if (rule.rule_type === "pct_change_down") return `${rule.ticker} -${rule.threshold}% in ${rule.window_hours}u`
    return ""
  }

  const needsTicker = !["digest"].includes(form.rule_type)
  const needsThreshold = !["digest", "dividend"].includes(form.rule_type)
  const needsWindow = ["pct_change_up", "pct_change_down"].includes(form.rule_type)

  return (
    <DashboardLayout>
      <div className="border-b border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0b1120] px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-lime-500/10 border border-lime-500/20 p-2">
              <Bell className="h-6 w-6 text-lime-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Notificaties</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Stel koersalerts en overzichten in</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-xl bg-lime-500 px-4 py-2.5 text-sm font-semibold text-[#060d1a] hover:bg-lime-400 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nieuwe regel
          </button>
        </div>
      </div>

      <div className="px-8 py-6 max-w-3xl space-y-4">

        {/* New rule form */}
        {showForm && (
          <div className="rounded-xl border border-lime-500/30 bg-white dark:bg-[#0b1120] p-6 shadow-sm">
            <h2 className="mb-5 text-base font-semibold text-slate-900 dark:text-slate-100">Nieuwe notificatieregel</h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Naam (optioneel)</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Bijv. ASML koersalert"
                  className="w-full rounded-lg border border-slate-200 dark:border-[#1a2744] bg-slate-50 dark:bg-[#0d1829] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                />
              </div>

              {/* Type */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Type</label>
                <div className="relative">
                  <select
                    value={form.rule_type}
                    onChange={e => setForm(f => ({ ...f, rule_type: e.target.value as RuleType }))}
                    className="w-full appearance-none rounded-lg border border-slate-200 dark:border-[#1a2744] bg-slate-50 dark:bg-[#0d1829] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                  >
                    {Object.entries(RULE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              {/* Ticker */}
              {needsTicker && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Ticker</label>
                  <input
                    type="text"
                    value={form.ticker}
                    onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
                    placeholder="Bijv. ASML.AS, NVDA"
                    className="w-full rounded-lg border border-slate-200 dark:border-[#1a2744] bg-slate-50 dark:bg-[#0d1829] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                  />
                </div>
              )}

              {/* Threshold */}
              {needsThreshold && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {needsWindow ? "Percentage (%)" : "Koersdrempel (€)"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.threshold}
                      onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))}
                      placeholder={needsWindow ? "5" : "950"}
                      className="w-full rounded-lg border border-slate-200 dark:border-[#1a2744] bg-slate-50 dark:bg-[#0d1829] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                    />
                  </div>
                  {needsWindow && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Tijdvenster</label>
                      <div className="relative">
                        <select
                          value={form.window_hours}
                          onChange={e => setForm(f => ({ ...f, window_hours: parseInt(e.target.value) }))}
                          className="w-full appearance-none rounded-lg border border-slate-200 dark:border-[#1a2744] bg-slate-50 dark:bg-[#0d1829] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                        >
                          <option value={1}>1 uur</option>
                          <option value={4}>4 uur</option>
                          <option value={24}>1 dag</option>
                          <option value={168}>1 week</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Digest options */}
              {form.rule_type === "digest" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Frequentie</label>
                    <div className="relative">
                      <select
                        value={form.digest_freq}
                        onChange={e => setForm(f => ({ ...f, digest_freq: e.target.value as DigestFreq }))}
                        className="w-full appearance-none rounded-lg border border-slate-200 dark:border-[#1a2744] bg-slate-50 dark:bg-[#0d1829] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                      >
                        <option value="daily">Dagelijks</option>
                        <option value="weekly">Wekelijks</option>
                        <option value="monthly">Maandelijks</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Tijdstip</label>
                    <input
                      type="time"
                      value={form.digest_time}
                      onChange={e => setForm(f => ({ ...f, digest_time: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 dark:border-[#1a2744] bg-slate-50 dark:bg-[#0d1829] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                    />
                  </div>
                </div>
              )}

              {/* Channels */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Kanalen</label>
                <div className="flex gap-2">
                  {(["in_app","email","push"] as Channel[]).map(ch => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannel(ch)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors border ${
                        form.channels.includes(ch)
                          ? "bg-lime-500/10 border-lime-500/40 text-lime-600 dark:text-lime-400"
                          : "border-slate-200 dark:border-[#1a2744] text-slate-500 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      {CHANNEL_ICONS[ch]}
                      {CHANNEL_LABELS[ch]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cooldown */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Cooldown (minuten tussen meldingen)</label>
                <div className="relative">
                  <select
                    value={form.cooldown_min}
                    onChange={e => setForm(f => ({ ...f, cooldown_min: parseInt(e.target.value) }))}
                    className="w-full appearance-none rounded-lg border border-slate-200 dark:border-[#1a2744] bg-slate-50 dark:bg-[#0d1829] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-lime-500/40"
                  >
                    <option value={15}>15 minuten</option>
                    <option value={30}>30 minuten</option>
                    <option value={60}>1 uur</option>
                    <option value={240}>4 uur</option>
                    <option value={1440}>1 dag</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setShowForm(false); setForm(DEFAULT_FORM) }} className="rounded-xl border border-slate-200 dark:border-[#1a2744] px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1a2744] transition-colors">
                  Annuleren
                </button>
                <button
                  onClick={save}
                  disabled={saving || form.channels.length === 0}
                  className="rounded-xl bg-lime-500 px-4 py-2.5 text-sm font-semibold text-[#060d1a] hover:bg-lime-400 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Opslaan..." : "Opslaan"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rules list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 rounded-full border-2 border-lime-500 border-t-transparent animate-spin" />
          </div>
        ) : rules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-[#1a2744] py-16 text-center">
            <Bell className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-medium text-slate-500">Geen notificatieregels</p>
            <p className="mt-1 text-xs text-slate-400">Klik op "Nieuwe regel" om een alert in te stellen.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map(rule => (
              <div
                key={rule.id}
                className={`flex items-center justify-between rounded-xl border px-5 py-4 transition-colors ${
                  rule.is_active
                    ? "border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0b1120]"
                    : "border-slate-200/50 dark:border-[#1a2744]/50 bg-slate-50 dark:bg-[#080e18] opacity-60"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {rule.name ?? RULE_LABELS[rule.rule_type]}
                    </span>
                    {!rule.is_active && (
                      <span className="rounded-full bg-slate-100 dark:bg-[#1a2744] px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        Gepauzeerd
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{ruleDescription(rule)}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {rule.channels.map(ch => (
                      <span key={ch} className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-[#1a2744] px-2 py-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                        {CHANNEL_ICONS[ch]}
                        {CHANNEL_LABELS[ch]}
                      </span>
                    ))}
                    <span className="text-[10px] text-slate-400 ml-1">cooldown {rule.cooldown_min}m</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => toggle(rule)}
                    title={rule.is_active ? "Pauzeren" : "Activeren"}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1a2744] hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {rule.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => remove(rule.id)}
                    title="Verwijderen"
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
