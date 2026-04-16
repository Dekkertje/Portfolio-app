"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts"
import { BenchmarkType, getBenchmarkName } from "@/lib/utils"
import { useTheme } from "@/contexts/ThemeContext"

type DataPoint = {
  date: string      // display label
  isoDate?: string  // used for X-axis formatting
  portfolio: number
  benchmark: number
}

type BenchmarkChartProps = {
  data: DataPoint[]
  benchmarkType: BenchmarkType
  loading?: boolean
}

function fmt(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`
}

function KPIBadge({ label, value, positive }: { label: string; value: number; positive: boolean }) {
  const color = positive
    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    : "text-red-400 bg-red-500/10 border-red-500/20"
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-sm font-semibold px-2 py-0.5 rounded border ${color}`}>
        {fmt(value)}
      </span>
    </div>
  )
}

export function BenchmarkChart({ data, benchmarkType, loading }: BenchmarkChartProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  const last            = data[data.length - 1]
  const portfolioReturn = last?.portfolio  ?? 0
  const benchmarkReturn = last?.benchmark  ?? 0
  const outperformance  = portfolioReturn - benchmarkReturn

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400 text-sm gap-2">
        <div className="h-4 w-4 rounded-full border-2 border-lime-500 border-t-transparent animate-spin" />
        Benchmark laden…
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
        Geen data beschikbaar
      </div>
    )
  }

  const step   = Math.max(1, Math.floor(data.length / 6))
  const xTicks = data
    .filter((_, i) => i % step === 0 || i === data.length - 1)
    .map(d => d.isoDate ?? d.date)

  function formatXTick(v: string): string {
    // v is isoDate ("2025-04-16") or display date — only parse ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const d = new Date(v)
      return `${d.getDate()} ${d.toLocaleString("nl-NL", { month: "short" })}`
    }
    return v
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* KPI summary */}
      <div className="flex items-center justify-center gap-6 pt-1">
        <KPIBadge label={getBenchmarkName(benchmarkType)} value={benchmarkReturn}  positive={benchmarkReturn  >= 0} />
        <KPIBadge label="Jouw portfolio"                  value={portfolioReturn}  positive={portfolioReturn  >= 0} />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs text-slate-500 dark:text-slate-400">Verschil</span>
          <span className={`text-sm font-bold px-2 py-0.5 rounded border ${
            outperformance >= 0
              ? "text-lime-400 bg-lime-500/10 border-lime-500/30"
              : "text-orange-400 bg-orange-500/10 border-orange-500/20"
          }`}>
            {outperformance >= 0 ? "▲" : "▼"} {fmt(Math.abs(outperformance))}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1a2744" : "#e2e8f0"} />
            <ReferenceLine y={0} stroke={isDark ? "#334155" : "#94a3b8"} strokeWidth={1} />
            <XAxis
              dataKey="isoDate"
              ticks={xTicks}
              stroke={isDark ? "#475569" : "#94a3b8"}
              tick={{ fontSize: 11, fill: isDark ? "#64748b" : "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatXTick}
            />
            <YAxis
              stroke={isDark ? "#475569" : "#94a3b8"}
              tick={{ fontSize: 11, fill: isDark ? "#64748b" : "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`}
              width={48}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#0d1829" : "white",
                border: `1px solid ${isDark ? "#1a2744" : "#e2e8f0"}`,
                borderRadius: "8px",
                fontSize: "12px",
                color: isDark ? "#f1f5f9" : "#0f172a",
              }}
              labelFormatter={(label) => {
                const s = String(label)
                if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                  return new Date(s).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })
                }
                return s
              }}
              formatter={(value, name) => [
                fmt(Number(value)),
                name === "portfolio" ? "Jouw portfolio" : getBenchmarkName(benchmarkType),
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", color: isDark ? "#94a3b8" : "#64748b", paddingTop: "4px" }}
              formatter={(value: string) =>
                value === "portfolio" ? "Jouw portfolio" : getBenchmarkName(benchmarkType)
              }
            />
            <Line type="monotone" dataKey="portfolio" stroke="#a3e635" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#a3e635" }} />
            <Line type="monotone" dataKey="benchmark" stroke="#22d3ee" strokeWidth={2} dot={false} strokeDasharray="5 4" activeDot={{ r: 4, fill: "#22d3ee" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
