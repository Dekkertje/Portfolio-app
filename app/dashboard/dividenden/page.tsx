"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { CalendarDays, TrendingUp, Euro, Clock } from "lucide-react"
import type { DividendEntry, ReceivedDividend } from "@/app/api/dividend-calendar/route"

const EUR = (v: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(v)

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

function ExDateBadge({ isoDate }: { isoDate: string }) {
  const days = daysUntil(isoDate)
  const isPast    = days < 0
  const isSoon    = days >= 0 && days <= 7
  const isNearby  = days > 7  && days <= 30

  const cls = isPast
    ? "bg-slate-100 dark:bg-slate-800 text-slate-400"
    : isSoon
    ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
    : isNearby
    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
    : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"

  const label = isPast
    ? `${Math.abs(days)}d geleden`
    : days === 0
    ? "Vandaag!"
    : `${days}d`

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      <Clock className="h-3 w-3" />
      {label}
    </span>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0d1829] px-5 py-4">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function DividendenPage() {
  const [upcoming, setUpcoming]   = useState<DividendEntry[]>([])
  const [received, setReceived]   = useState<ReceivedDividend[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: portfolios } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", session.user.id)
        .limit(1)

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

  const payersCount    = upcoming.filter(e => e.exDate).length
  const ytdTotal       = received.filter(r => r.year === new Date().getFullYear()).reduce((s, r) => s + r.totalEur, 0)
  const allTimeTotal   = received.reduce((s, r) => s + r.totalEur, 0)
  const estAnnualTotal = upcoming.reduce((s, e) => {
    if (!e.annualRate || !e.amountPerShareEur || !e.estimatedPayout) return s
    const freq = e.amountPerShare && e.amountPerShare > 0
      ? Math.round((e.annualRate ?? 0) / e.amountPerShare)
      : 1
    return s + e.estimatedPayout * Math.max(1, freq)
  }, 0)

  const thisYear = new Date().getFullYear()

  // Group received by year descending
  const receivedByYear = received.reduce<Record<number, ReceivedDividend[]>>((acc, r) => {
    ;(acc[r.year] ??= []).push(r)
    return acc
  }, {})
  const receivedYears = Object.keys(receivedByYear).map(Number).sort((a, b) => b - a)

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-500/10">
            <CalendarDays className="h-5 w-5 text-lime-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dividendkalender</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Aankomende ex-dividend datums en ontvangen dividenden</p>
          </div>
        </div>

        {/* Stat cards */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard
              label="Geschat jaarinkomen"
              value={estAnnualTotal > 0 ? EUR(estAnnualTotal) : "—"}
              sub="op basis van huidige posities"
            />
            <StatCard
              label={`Ontvangen ${thisYear}`}
              value={ytdTotal > 0 ? EUR(ytdTotal) : "—"}
              sub={`${received.filter(r => r.year === thisYear).length} uitkering${received.filter(r => r.year === thisYear).length !== 1 ? "en" : ""}`}
            />
            <StatCard
              label="Totaal ontvangen"
              value={allTimeTotal > 0 ? EUR(allTimeTotal) : "—"}
              sub="alle jaren"
            />
            <StatCard
              label="Dividend betalers"
              value={String(payersCount)}
              sub="posities met bekende ex-datum"
            />
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-lime-500 border-t-transparent" />
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
            {/* Upcoming ex-dividend dates */}
            <section>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-lime-500" />
                Aankomende ex-dividend datums
              </h2>

              {upcoming.length === 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0d1829] p-8 text-center text-sm text-slate-400">
                  Geen dividend data gevonden voor je posities.
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0d1829] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-[#1a2744] text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        <th className="px-4 py-3 text-left">Positie</th>
                        <th className="px-4 py-3 text-left">Ex-dividend</th>
                        <th className="px-4 py-3 text-left">Betaaldatum</th>
                        <th className="px-4 py-3 text-right">Per aandeel</th>
                        <th className="px-4 py-3 text-right">Verwachte uitkering</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1a2744]">
                      {upcoming.map((entry, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900 dark:text-white truncate max-w-[180px]">
                              {entry.product}
                            </div>
                            <div className="text-xs text-slate-400">{entry.symbol} · {entry.qty} aandelen</div>
                          </td>
                          <td className="px-4 py-3">
                            {entry.exDate ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-slate-700 dark:text-slate-300">{fmtDate(entry.exDate)}</span>
                                <ExDateBadge isoDate={entry.exDate} />
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {entry.paymentDate ? fmtDate(entry.paymentDate) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {entry.amountPerShare != null ? (
                              <span className="text-slate-700 dark:text-slate-300">
                                {entry.amountPerShare.toFixed(4)} {entry.currency}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {entry.estimatedPayout != null ? (
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {EUR(entry.estimatedPayout)}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Received dividends — all years */}
            <section>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Euro className="h-4 w-4 text-lime-500" />
                Ontvangen dividenden
              </h2>

              {received.length === 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0d1829] p-8 text-center text-sm text-slate-400">
                  Geen dividenden gevonden (of nog niet geïmporteerd).
                </div>
              ) : (
                <div className="space-y-4">
                  {receivedYears.map(year => {
                    const rows = receivedByYear[year]
                    const yearTotal = rows.reduce((s, r) => s + r.totalEur, 0)
                    return (
                      <div key={year} className="rounded-xl border border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0d1829] overflow-hidden">
                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-white/[0.03] border-b border-slate-100 dark:border-[#1a2744] flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{year}</span>
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{EUR(yearTotal)}</span>
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 dark:border-[#1a2744] text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                              <th className="px-4 py-3 text-left">Positie</th>
                              <th className="px-4 py-3 text-left">Datum</th>
                              <th className="px-4 py-3 text-right">Bedrag</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-[#1a2744]">
                            {rows.map((r, i) => (
                              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{r.product}</td>
                                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{r.date ? fmtDate(r.date) : "—"}</td>
                                <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">+{EUR(r.totalEur)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
