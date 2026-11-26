"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import { ChevronDown, LineChart, Table2 } from "lucide-react"
import type { BenchmarkSeries } from "@/app/api/v2/benchmarks/route"
import { BENCHMARKS, benchmarkByKey, type BenchmarkKey } from "@/lib/benchmarks"
import { twr } from "@/lib/core/returns"
import { dateLong, dateMonth, eur, pct } from "@/lib/format"
import { compareWithBenchmark, type ComparePoint } from "@/lib/portfolio/compare"
import type { OverviewPoint } from "@/lib/portfolio/overview"
import { ReturnChart } from "./ReturnChart"
import { Card, Delta, Private, Segmented } from "./ui"
import { useApi } from "./useApi"
import { ValueChart } from "./ValueChart"

type Mode = "value" | "compare"
const BENCH_KEY = "compare-benchmark"

function initialBenchmark(): BenchmarkKey {
  try {
    const saved = typeof window !== "undefined" ? localStorage.getItem(BENCH_KEY) : null
    if (saved && benchmarkByKey(saved)) return saved as BenchmarkKey
  } catch {}
  return "msci_world"
}

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
  const [mode, setMode] = useState<Mode>("value")
  const [benchKey, setBenchKey] = useState<BenchmarkKey>(initialBenchmark)
  const bench = benchmarkByKey(benchKey)!
  // Indexkoersen pas ophalen als er vergeleken wordt; per index één keer, vanaf de start van het portfolio
  const benchData = useApi<BenchmarkSeries>(
    mode === "compare" && series.length ? `/api/v2/benchmarks?key=${benchKey}&from=${series[0].d}` : null,
    6 * 3600_000,
  )

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

  const compare = useMemo(
    () => (mode === "compare" && benchData.data ? compareWithBenchmark(slice.points, benchData.data.closes) : []),
    [mode, benchData.data, slice.points],
  )
  const lastCompare = compare.at(-1)

  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        {mode === "value" ? (
          <div>
            <p className="text-[13px] text-ink-2">Resultaat {period === "ALL" ? "sinds start" : "in deze periode"}</p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <Private className={`text-2xl font-semibold tracking-tight ${slice.change >= 0 ? "text-up" : "text-down"}`}>
                {eur(slice.change, { sign: true, decimals: 0 })}
              </Private>
              <Delta percent={slice.ret} variant="pill" size="xs" />
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[13px] text-ink-2">
              Jij tegenover {bench.label} {period === "ALL" ? "sinds start" : "in deze periode"}
            </p>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={`text-2xl font-semibold tracking-tight ${slice.ret >= 0 ? "text-up" : "text-down"}`}>{pct(slice.ret, { sign: true })}</span>
              {lastCompare?.bench != null && (
                <>
                  <span className="text-[15px] text-ink-2">
                    {bench.label} <span className="font-semibold text-ink">{pct(lastCompare.bench, { sign: true })}</span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${lastCompare.mine >= lastCompare.bench ? "bg-up-wash text-up" : "bg-down-wash text-down"}`}
                  >
                    {lastCompare.mine >= lastCompare.bench ? "▲ beter" : "▼ minder"} met {ppDiff(lastCompare.mine - lastCompare.bench)}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
        <button
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink-2 hover:bg-surface-2"
          aria-pressed={view === "table"}
        >
          {view === "chart" ? <Table2 size={15} /> : <LineChart size={15} />}
          {view === "chart" ? "Tabel" : "Grafiek"}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-auto">
          <Segmented
            label="Weergave"
            value={mode}
            onChange={setMode}
            fill
            options={[
              { value: "value", label: "Waarde" },
              { value: "compare", label: "Vergelijken" },
            ]}
          />
        </div>
        {mode === "compare" && (
          <label className="relative flex items-center">
            <span className="sr-only">Vergelijk met</span>
            <select
              value={benchKey}
              onChange={(e) => {
                const k = e.target.value as BenchmarkKey
                setBenchKey(k)
                try {
                  localStorage.setItem(BENCH_KEY, k)
                } catch {}
              }}
              className="h-8 appearance-none rounded-full bg-surface-2 pl-3 pr-8 text-[13px] font-medium text-ink outline-none focus:ring-2 focus:ring-accent"
            >
              {BENCHMARKS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 text-ink-2" />
          </label>
        )}
      </div>

      <Segmented label="Periode" options={PERIODS} value={period} onChange={setPeriod} fill />

      <div className="mt-4">
        {mode === "compare" ? (
          benchData.error && !benchData.data ? (
            <p className="py-10 text-center text-sm text-ink-2">{benchData.error}</p>
          ) : !benchData.data ? (
            <div className="animate-pulse rounded-2xl bg-surface-2" style={{ height: wide ? 320 : 240 }} aria-label="Laden" />
          ) : view === "chart" ? (
            <>
              <ReturnChart points={compare} benchLabel={bench.label} height={wide ? 320 : 240} />
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-ink-2">
                <LegendKey color="var(--accent)" label="Jij (tijdgewogen)" />
                <LegendKey color="var(--series-2)" label={bench.label} />
                <span className="w-full text-muted sm:ml-auto sm:w-auto">{bench.note}</span>
              </div>
            </>
          ) : (
            <CompareTable points={compare} benchLabel={bench.label} />
          )
        ) : view === "chart" ? (
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

function ppDiff(d: number) {
  return `${Math.abs(d * 100).toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} procentpunt`
}

function ppSigned(d: number) {
  return `${d >= 0 ? "+" : "−"}${Math.abs(d * 100).toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pp`
}

/** Tabelweergave van de vergelijking: per maand (lang) of per dag (kort). */
function CompareTable({ points, benchLabel }: { points: ComparePoint[]; benchLabel: string }) {
  const monthly = points.length > 70
  const rows = monthly ? points.filter((p, i) => i === points.length - 1 || points[i + 1].d.slice(0, 7) !== p.d.slice(0, 7)) : points
  return (
    <div className="max-h-80 overflow-y-auto rounded-2xl ring-1 ring-line">
      <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
        <thead className="sticky top-0 bg-surface text-xs text-muted">
          <tr className="border-b border-line">
            <th className="px-3 py-2 text-left font-medium">{monthly ? "Maand" : "Datum"}</th>
            <th className="px-3 py-2 text-right font-medium">Jij</th>
            <th className="px-3 py-2 text-right font-medium">{benchLabel}</th>
            <th className="px-3 py-2 text-right font-medium">Verschil</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {[...rows].reverse().map((p) => (
            <tr key={p.d}>
              <td className="px-3 py-2 text-ink-2">{monthly ? dateMonth(p.d) : dateLong(p.d)}</td>
              <td className="px-3 py-2 text-right text-ink">{pct(p.mine, { sign: true })}</td>
              <td className="px-3 py-2 text-right text-ink-2">{p.bench == null ? "—" : pct(p.bench, { sign: true })}</td>
              <td className={`px-3 py-2 text-right ${p.bench == null ? "text-muted" : p.mine >= p.bench ? "text-up" : "text-down"}`}>
                {p.bench == null ? "—" : ppSigned(p.mine - p.bench)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
