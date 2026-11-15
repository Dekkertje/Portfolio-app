"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import { Table2, LineChart } from "lucide-react"
import { twr } from "@/lib/core/returns"
import { dateLong, dateMonth, eur } from "@/lib/format"
import type { OverviewPoint } from "@/lib/portfolio/overview"
import { Card, Delta, Private, Segmented } from "./ui"
import { ValueChart } from "./ValueChart"

type Period = "1W" | "1M" | "3M" | "YTD" | "1J" | "5J" | "ALL"

const PERIODS: { value: Period; label: string }[] = [
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "YTD", label: "YTD" },
  { value: "1J", label: "1J" },
  { value: "5J", label: "5J" },
  { value: "ALL", label: "Alles" },
]

function periodStart(period: Period, lastDate: string): string | null {
  const d = new Date(lastDate + "T00:00:00Z")
  switch (period) {
    case "1W": d.setUTCDate(d.getUTCDate() - 7); break
    case "1M": d.setUTCMonth(d.getUTCMonth() - 1); break
    case "3M": d.setUTCMonth(d.getUTCMonth() - 3); break
    case "YTD": return `${lastDate.slice(0, 4)}-01-01`
    case "1J": d.setUTCFullYear(d.getUTCFullYear() - 1); break
    case "5J": d.setUTCFullYear(d.getUTCFullYear() - 5); break
    case "ALL": return null
  }
  return d.toISOString().slice(0, 10)
}

/** Periodeselectie + grafiek + rendement over de periode. */
const wideQuery = "(min-width: 1024px)"
function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(wideQuery)
      mq.addEventListener("change", cb)
      return () => mq.removeEventListener("change", cb)
    },
    () => window.matchMedia(wideQuery).matches,
    () => false,
  )
}

export function PerformanceCard({ series }: { series: OverviewPoint[] }) {
  const wide = useWide()
  const [period, setPeriod] = useState<Period>("1J")
  const [view, setView] = useState<"chart" | "table">("chart")

  const slice = useMemo(() => {
    if (!series.length) return { points: [], change: 0, ret: 0 }
    const start = periodStart(period, series[series.length - 1].d)
    // Lege jaren vooraan (bijv. €0,10 na een opname) maken de grafiek nietszeggend
    const firstMeaningful = series.findIndex((p) => p.v >= 1)
    let from = start ? series.findIndex((p) => p.d >= start) : Math.max(0, firstMeaningful)
    if (from < 0) from = series.length - 1
    // Één punt ervoor als nulpunt van de periode
    const base = Math.max(0, from - 1)
    const points = series.slice(base)
    const flowsAfterBase = points.slice(1).reduce((s, p) => s + p.f, 0)
    const change = points[points.length - 1].v - points[0].v - flowsAfterBase
    const ret = twr(points.map((p, i) => ({ date: p.d, valueEur: p.v, flowEur: i === 0 ? 0 : p.f })))
    return { points, change, ret }
  }, [series, period])

  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-ink-2">Resultaat {PERIODS.find((p) => p.value === period)!.label === "Alles" ? "sinds start" : "in deze periode"}</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <Private className={`text-2xl font-semibold tracking-tight ${slice.change >= 0 ? "text-up" : "text-down"}`}>
              {eur(slice.change, { sign: true, decimals: 0 })}
            </Private>
            <Delta percent={slice.ret} variant="pill" size="xs" />
          </div>
        </div>
        <button
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink-2 hover:bg-surface-2"
          aria-pressed={view === "table"}
        >
          {view === "chart" ? <Table2 size={15} /> : <LineChart size={15} />}
          {view === "chart" ? "Tabel" : "Grafiek"}
        </button>
      </div>

      <Segmented label="Periode" options={PERIODS} value={period} onChange={setPeriod} fill />

      <div className="mt-4">
        {view === "chart" ? (
          <>
            <ValueChart points={slice.points} height={wide ? 320 : 240} />
            <div className="mt-3 flex items-center gap-4 whitespace-nowrap px-1 text-xs text-ink-2">
              <LegendKey color="var(--accent)" label="Waarde" />
              <LegendKey color="var(--muted)" label="Netto inleg" />
              <span className="ml-auto hidden text-muted sm:inline">Rendement: tijdgewogen (TWR)</span>
            </div>
          </>
        ) : (
          <SeriesTable points={slice.points} />
        )}
      </div>
    </Card>
  )
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-0.5 w-3.5 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  )
}

/** Tabelweergave: per maand (lange periodes) of per dag (korte). */
function SeriesTable({ points }: { points: { d: string; v: number; n: number }[] }) {
  const monthly = points.length > 70
  const rows = monthly
    ? points.filter((p, i) => i === points.length - 1 || points[i + 1].d.slice(0, 7) !== p.d.slice(0, 7))
    : points
  return (
    <div className="max-h-80 overflow-y-auto rounded-2xl ring-1 ring-line">
      <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
        <thead className="sticky top-0 bg-surface text-xs text-muted">
          <tr className="border-b border-line">
            <th className="px-3 py-2 text-left font-medium">{monthly ? "Maand" : "Datum"}</th>
            <th className="px-3 py-2 text-right font-medium">Waarde</th>
            <th className="px-3 py-2 text-right font-medium">Netto inleg</th>
            <th className="px-3 py-2 text-right font-medium">Resultaat</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {[...rows].reverse().map((p) => (
            <tr key={p.d}>
              <td className="px-3 py-2 text-ink-2">{monthly ? dateMonth(p.d) : dateLong(p.d)}</td>
              <td className="px-3 py-2 text-right text-ink"><Private>{eur(p.v, { decimals: 0 })}</Private></td>
              <td className="px-3 py-2 text-right text-ink-2"><Private>{eur(p.n, { decimals: 0 })}</Private></td>
              <td className={`px-3 py-2 text-right ${p.v - p.n >= 0 ? "text-up" : "text-down"}`}>
                <Private>{eur(p.v - p.n, { sign: true, decimals: 0 })}</Private>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
