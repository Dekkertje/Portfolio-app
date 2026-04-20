"use client"

import { useEffect, useState } from "react"
import { useTheme } from "@/contexts/ThemeContext"
import { supabase } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import {
  CalendarDays, TrendingUp, Wallet, BarChart3,
  Clock, ChevronDown, ChevronUp, Coins,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import type { DividendEntry, ReceivedDividend } from "@/app/api/dividend-calendar/route"

const EUR = (v: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(v)

const MONTHS_NL = ["Jan","Feb","Mrt","Apr","Mei","Jun","Jul","Aug","Sep","Okt","Nov","Dec"]

function daysUntil(isoDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(isoDate)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function fmtDate(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })
}

function urgencyConfig(isoDate: string | null) {
  if (!isoDate) return { strip: "bg-slate-300 dark:bg-slate-700", text: "text-slate-400", label: "—", badge: "bg-slate-100 dark:bg-slate-800 text-slate-400" }
  const days = daysUntil(isoDate)
  if (days < 0)    return { strip: "bg-slate-300 dark:bg-slate-600",  text: "text-slate-400",              label: `${Math.abs(days)}d geleden`, badge: "bg-slate-100 dark:bg-slate-800 text-slate-400" }
  if (days === 0)  return { strip: "bg-red-500",                      text: "text-red-500 font-bold",       label: "Vandaag!",                   badge: "bg-red-100 dark:bg-red-900/40 text-red-500" }
  if (days <= 7)   return { strip: "bg-red-400",                      text: "text-red-500 dark:text-red-400", label: `${days}d`,                 badge: "bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400" }
  if (days <= 30)  return { strip: "bg-amber-400",                    text: "text-amber-600 dark:text-amber-400", label: `${days}d`,             badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400" }
  return           { strip: "bg-emerald-400",                         text: "text-emerald-600 dark:text-emerald-400", label: `${days}d`,          badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" }
}

function ProgressBar({ value, max, color = "bg-lime-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="mt-3 space-y-1">
      <div className="flex justify-between text-xs text-slate-400">
        <span>Voortgang dit jaar</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

type StatCardProps = {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  children?: React.ReactNode
}
function StatCard({ label, value, sub, icon: Icon, iconBg, iconColor, children }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0d1829] px-5 py-4 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      {children}
    </div>
  )
}

function MonthlyChart({ received, thisYear }: { received: ReceivedDividend[]; thisYear: number }) {
  const { theme } = useTheme()
  const dark = theme !== "light"
  const currentMonth = new Date().getMonth()

  const data = MONTHS_NL.map((name, i) => ({
    name,
    amount: received
      .filter(r => r.year === thisYear && new Date(r.date).getMonth() === i)
      .reduce((s, r) => s + r.totalEur, 0),
    isCurrent: i === currentMonth,
  }))

  const hasData = data.some(d => d.amount > 0)
  if (!hasData) return null

  const tickColor     = dark ? "#94a3b8" : "#64748b"
  const tooltipBg     = dark ? "#0d1829" : "#ffffff"
  const tooltipBorder = dark ? "#1a2744" : "#e2e8f0"
  const tooltipText   = dark ? "#f1f5f9" : "#1e293b"
  const emptyBar      = dark ? "#1e293b" : "#f1f5f9"

  return (
    <div className="rounded-xl border border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0d1829] p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4 text-lime-500" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Maandelijks inkomen {thisYear}</h2>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} barSize={20} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: tickColor }} axisLine={false} tickLine={false} tickFormatter={v => v === 0 ? "" : `€${v}`} />
          <Tooltip
            formatter={(v) => [EUR(Number(v ?? 0)), "Dividend"]}
            contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12, color: tooltipText }}
            labelStyle={{ color: tickColor, fontWeight: 600 }}
            itemStyle={{ color: tooltipText }}
            cursor={{ fill: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
          />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.isCurrent ? "#84cc16" : entry.amount > 0 ? "#4ade80" : emptyBar} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function YearSection({ year, rows, allTimeTotal }: { year: number; rows: ReceivedDividend[]; allTimeTotal: number }) {
  const [open, setOpen] = useState(year === new Date().getFullYear())
  const yearTotal = rows.reduce((s, r) => s + r.totalEur, 0)
  const pct = allTimeTotal > 0 ? (yearTotal / allTimeTotal) * 100 : 0

  return (
    <div className="rounded-xl border border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0d1829] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="text-base font-bold text-slate-900 dark:text-white">{year}</span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-slate-400">{pct.toFixed(0)}% van totaal</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">+{EUR(yearTotal)}</span>
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 dark:border-[#1a2744]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                <th className="px-5 py-2.5 text-left">Positie</th>
                <th className="px-5 py-2.5 text-left">Datum</th>
                <th className="px-5 py-2.5 text-right">Bedrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1a2744]">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900 dark:text-white">{r.product}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{r.sharesHeld} aandelen × {EUR(r.amountPerShare)}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{r.date ? fmtDate(r.date) : "—"}</td>
                  <td className="px-5 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">+{EUR(r.totalEur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function DividendenPage() {
  const [upcoming, setUpcoming] = useState<DividendEntry[]>([])
  const [received, setReceived] = useState<ReceivedDividend[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: portfolios } = await supabase
        .from("portfolios").select("id").eq("user_id", session.user.id).limit(1)

      const portfolioId = portfolios?.[0]?.id
      if (!portfolioId) { setLoading(false); return }

      try {
        const res  = await fetch(`/api/dividend-calendar?portfolio_id=${portfolioId}`)
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        setUpcoming(json.upcoming ?? [])
        setReceived(json.received ?? [])
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const thisYear     = new Date().getFullYear()
  const payersCount  = upcoming.filter(e => e.exDate).length
  const ytdTotal     = received.filter(r => r.year === thisYear).reduce((s, r) => s + r.totalEur, 0)
  const allTimeTotal = received.reduce((s, r) => s + r.totalEur, 0)
  const ytdCount     = received.filter(r => r.year === thisYear).length

  const estAnnualTotal = upcoming.reduce((s, e) => {
    if (!e.annualRate || !e.amountPerShareEur || !e.estimatedPayout) return s
    const freq = e.amountPerShare && e.amountPerShare > 0
      ? Math.round((e.annualRate ?? 0) / e.amountPerShare) : 1
    return s + e.estimatedPayout * Math.max(1, freq)
  }, 0)

  const receivedByYear = received.reduce<Record<number, ReceivedDividend[]>>((acc, r) => {
    ;(acc[r.year] ??= []).push(r)
    return acc
  }, {})
  const receivedYears = Object.keys(receivedByYear).map(Number).sort((a, b) => b - a)

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-lime-500/20 to-emerald-500/20 border border-lime-500/20">
            <CalendarDays className="h-6 w-6 text-lime-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dividendkalender</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Aankomende ex-datums · ontvangen uitkeringen · jaarprogress</p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <div className="flex flex-col items-center gap-3">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-lime-500 border-t-transparent" />
              <span className="text-sm">Dividend data ophalen…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Geschat jaarinkomen"
                value={estAnnualTotal > 0 ? EUR(estAnnualTotal) : "—"}
                sub="huidige posities"
                icon={TrendingUp}
                iconBg="bg-lime-500/10"
                iconColor="text-lime-500"
              />
              <StatCard
                label={`Ontvangen ${thisYear}`}
                value={ytdTotal > 0 ? EUR(ytdTotal) : "—"}
                sub={`${ytdCount} uitkering${ytdCount !== 1 ? "en" : ""}`}
                icon={Coins}
                iconBg="bg-emerald-500/10"
                iconColor="text-emerald-500"
              >
                {estAnnualTotal > 0 && <ProgressBar value={ytdTotal} max={estAnnualTotal} />}
              </StatCard>
              <StatCard
                label="Totaal ontvangen"
                value={allTimeTotal > 0 ? EUR(allTimeTotal) : "—"}
                sub="alle jaren samen"
                icon={Wallet}
                iconBg="bg-violet-500/10"
                iconColor="text-violet-500"
              />
              <StatCard
                label="Dividend betalers"
                value={String(payersCount)}
                sub="posities met ex-datum"
                icon={CalendarDays}
                iconBg="bg-sky-500/10"
                iconColor="text-sky-400"
              />
            </div>

            {/* Monthly bar chart */}
            <MonthlyChart received={received} thisYear={thisYear} />

            {/* Upcoming ex-dividend dates */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-lime-500" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Aankomende ex-dividend datums</h2>
                {payersCount > 0 && (
                  <span className="ml-auto text-xs font-medium bg-lime-500/10 text-lime-600 dark:text-lime-400 px-2 py-0.5 rounded-full">
                    {payersCount} betalers
                  </span>
                )}
              </div>

              {upcoming.length === 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0d1829] p-10 text-center text-sm text-slate-400">
                  Geen dividend data gevonden voor je huidige posities.
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0d1829] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-[#1a2744] text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        <th className="pl-2 pr-4 py-3 text-left w-1"></th>
                        <th className="px-4 py-3 text-left">Positie</th>
                        <th className="px-4 py-3 text-left">Ex-dividend</th>
                        <th className="px-4 py-3 text-left hidden md:table-cell">Betaaldatum</th>
                        <th className="px-4 py-3 text-right hidden sm:table-cell">Per aandeel (€)</th>
                        <th className="px-4 py-3 text-right">Verwachte uitkering</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1a2744]">
                      {upcoming.map((entry, i) => {
                        const urg = urgencyConfig(entry.exDate)
                        return (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                            {/* Urgency strip */}
                            <td className="pl-2 pr-0 py-0 w-1">
                              <div className={`w-1 rounded-full h-10 ${urg.strip} opacity-80 group-hover:opacity-100 transition-opacity`} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900 dark:text-white truncate max-w-[180px]">
                                {entry.product}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded text-slate-500 dark:text-slate-400">{entry.symbol}</span>
                                <span className="ml-1">· {entry.qty} aandelen</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {entry.exDate ? (
                                <div className="flex flex-col gap-1">
                                  <span className="text-slate-700 dark:text-slate-300">{fmtDate(entry.exDate)}</span>
                                  <span className={`inline-flex items-center gap-1 text-xs font-medium w-fit px-2 py-0.5 rounded-full ${urg.badge}`}>
                                    <Clock className="h-2.5 w-2.5" />
                                    {urg.label}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden md:table-cell">
                              {entry.paymentDate ? fmtDate(entry.paymentDate) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right hidden sm:table-cell">
                              {entry.amountPerShareEur != null ? (
                                <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">
                                  {EUR(entry.amountPerShareEur)}
                                </span>
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {entry.estimatedPayout != null ? (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {EUR(entry.estimatedPayout)}
                                </span>
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Received dividends — collapsible per year */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="h-4 w-4 text-lime-500" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Ontvangen dividenden</h2>
                {allTimeTotal > 0 && (
                  <span className="ml-auto text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                    {EUR(allTimeTotal)} totaal
                  </span>
                )}
              </div>

              {received.length === 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0d1829] p-10 text-center text-sm text-slate-400">
                  Geen dividenden gevonden (of nog niet geïmporteerd).
                </div>
              ) : (
                <div className="space-y-3">
                  {receivedYears.map(year => (
                    <YearSection key={year} year={year} rows={receivedByYear[year]} allTimeTotal={allTimeTotal} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
