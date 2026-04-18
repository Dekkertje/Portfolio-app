"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { useTheme } from "@/contexts/ThemeContext"
import { useMemo } from "react"

export type ChartMode = "value" | "pnl"

export type PerformanceData = {
  date: string        // display label, e.g. "16 apr"
  isoDate?: string    // machine-readable date for alignment, e.g. "2025-04-16"
  value: number
  invested: number
  /** Total return (unrealized + realized + dividends) for the P&L view.
   *  Equals snap.total_return for snapshot points, metrics.totalReturn for today,
   *  and 0 for pre-snapshot transaction points (no price data available). */
  pnl: number
}

type PerformanceChartProps = {
  data: PerformanceData[]
  mode?: ChartMode
  costBasis?: number   // flat reference line in value-mode
}

const EUR = (v: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(v)

const sign = (v: number) => (v > 0 ? "+" : "")

// ─── Value-mode tooltip ───────────────────────────────────────────────────────

function fmtLabel(label: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const d = new Date(label)
    const day   = d.getDate()
    const month = d.toLocaleString("nl-NL", { month: "short" })
    const year  = d.getFullYear()
    return `${day} ${month} ${year}`
  }
  return label
}

function ValueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const value    = payload.find((p: any) => p.dataKey === "value")?.value    as number | undefined
  const invested = payload.find((p: any) => p.dataKey === "invested")?.value as number | undefined

  if (value === undefined) return null
  const diff = invested !== undefined ? value - invested : null

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-lg text-sm">
      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">{fmtLabel(label)}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-6">
          <span className="text-slate-500 dark:text-slate-400">Waarde</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">{EUR(value)}</span>
        </div>
        {invested !== undefined && (
          <div className="flex justify-between gap-6">
            <span className="text-slate-500 dark:text-slate-400">Inleg</span>
            <span className="font-medium text-slate-500 dark:text-slate-400">{EUR(invested)}</span>
          </div>
        )}
        {diff !== null && (
          <div className={`flex justify-between gap-6 pt-1 border-t border-slate-100 dark:border-slate-700 font-semibold ${
            diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          }`}>
            <span>P&L</span>
            <span>{sign(diff)}{EUR(diff)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── P&L-mode tooltip ────────────────────────────────────────────────────────

function PnLTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const entry    = payload[0]
  const pnl      = entry?.value      as number | undefined
  const value    = entry?.payload?.value    as number | undefined
  const invested = entry?.payload?.invested as number | undefined

  if (pnl === undefined) return null

  const unrealized = (value !== undefined && invested !== undefined) ? value - invested : null
  const realized   = (unrealized !== null) ? pnl - unrealized : null

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-lg text-sm">
      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">{fmtLabel(label)}</p>
      <div className="space-y-1">
        <div className={`flex justify-between gap-6 font-semibold ${
          pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        }`}>
          <span>Totale P&L</span>
          <span>{sign(pnl)}{EUR(pnl)}</span>
        </div>
        {unrealized !== null && (
          <div className="flex justify-between gap-6 pt-1 border-t border-slate-100 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">Ongerealiseerd</span>
            <span className={`font-medium ${
              unrealized >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            }`}>{sign(unrealized)}{EUR(unrealized)}</span>
          </div>
        )}
        {realized !== null && Math.abs(realized) > 0.01 && (
          <div className="flex justify-between gap-6">
            <span className="text-slate-500 dark:text-slate-400">Gerealiseerd</span>
            <span className={`font-medium ${
              realized >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            }`}>{sign(realized)}{EUR(realized)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── X-axis tick helpers ──────────────────────────────────────────────────────

/** Determines whether to include the year in a tick label based on the data range. */
function buildTickFormatter(data: PerformanceData[]) {
  const isoDates = data.map(d => d.isoDate).filter(Boolean) as string[]
  if (isoDates.length < 2) return (v: string) => v

  const first = new Date(isoDates[0])
  const last  = new Date(isoDates[isoDates.length - 1])
  const spanDays = (last.getTime() - first.getTime()) / 86_400_000
  const multiYear = last.getFullYear() !== first.getFullYear()

  return (v: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return v  // fallback for display-format strings
    const d = new Date(v)
    const month = d.toLocaleString("nl-NL", { month: "short" })
    if (spanDays > 365 || multiYear) {
      // For long ranges: show "jan '25" style, or just the year at January
      if (d.getMonth() === 0) return `jan '${String(d.getFullYear()).slice(2)}`
      return `${month} '${String(d.getFullYear()).slice(2)}`
    }
    // For shorter ranges: "16 apr"
    return `${d.getDate()} ${month}`
  }
}

/** Select ~6 evenly-spaced ticks from isoDate values, always including first + last. */
function selectTicks(data: PerformanceData[], n = 6): string[] {
  const iso = data.map(d => d.isoDate).filter(Boolean) as string[]
  if (iso.length <= n) return iso
  const result: string[] = []
  const step = (iso.length - 1) / (n - 1)
  for (let i = 0; i < n; i++) {
    result.push(iso[Math.round(i * step)])
  }
  return [...new Set(result)]
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PerformanceChart({ data, mode = "value", costBasis }: PerformanceChartProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        Nog geen historische data beschikbaar
      </div>
    )
  }

  const gridColor    = isDark ? "#334155" : "#e2e8f0"
  const axisColor    = isDark ? "#94a3b8" : "#64748b"
  const lastPoint    = data[data.length - 1]
  const tickFormatter = useMemo(() => buildTickFormatter(data), [data])
  const xTicks        = useMemo(() => selectTicks(data), [data])

  // ── P&L mode ─────────────────────────────────────────────────────────────────
  if (mode === "pnl") {
    const lastPnL    = lastPoint?.pnl ?? 0
    const isGain     = lastPnL >= 0
    const lineColor  = isGain ? "#10b981" : "#ef4444"
    const gradientId = isGain ? "pnlGradientGain" : "pnlGradientLoss"

    // Determine a sensible Y-axis domain so the zero line is always visible
    const pnlValues = data.map(d => d.pnl)
    const minPnl    = Math.min(0, ...pnlValues)
    const maxPnl    = Math.max(0, ...pnlValues)
    const pad       = Math.max(Math.abs(maxPnl - minPnl) * 0.1, 100)

    return (
      <div className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pnlGradientGain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="pnlGradientLoss" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.20} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />

            <XAxis
              dataKey="isoDate"
              ticks={xTicks}
              tickFormatter={tickFormatter}
              stroke={axisColor}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={4}
            />
            <YAxis
              stroke={axisColor}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={[minPnl - pad, maxPnl + pad]}
              tickFormatter={v => {
                const abs = Math.abs(v)
                const prefix = v < 0 ? "-" : v > 0 ? "+" : ""
                return abs >= 1000
                  ? `${prefix}€${(abs / 1000).toFixed(0)}k`
                  : `${prefix}€${abs.toFixed(0)}`
              }}
              width={52}
            />

            <Tooltip content={<PnLTooltip />} />

            {/* Zero baseline */}
            <ReferenceLine
              y={0}
              stroke={isDark ? "#64748b" : "#94a3b8"}
              strokeWidth={1.5}
              label={{
                value: "€0",
                position: "insideTopRight",
                fontSize: 10,
                fill: isDark ? "#64748b" : "#94a3b8",
              }}
            />

            <Area
              type="monotone"
              dataKey="pnl"
              stroke={lineColor}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{
                r: 4,
                fill: lineColor,
                stroke: isDark ? "#1e293b" : "white",
                strokeWidth: 2,
              }}
              name="P&L"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // ── Value mode (default) ──────────────────────────────────────────────────────
  const isAbove    = lastPoint ? lastPoint.value >= lastPoint.invested : true
  const valueColor = isAbove ? "#10b981" : "#ef4444"
  const valueGradId = isAbove ? "gradientGain" : "gradientLoss"

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradientGain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradientLoss" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />

          <XAxis
            dataKey="isoDate"
            ticks={xTicks}
            tickFormatter={tickFormatter}
            stroke={axisColor}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dy={4}
          />
          <YAxis
            stroke={axisColor}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `€${(v / 1000).toFixed(0)}k`}
            width={42}
          />

          <Tooltip content={<ValueTooltip />} />

          {costBasis && costBasis > 0 && (
            <ReferenceLine
              y={costBasis}
              stroke={isDark ? "#64748b" : "#94a3b8"}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: "Inleg",
                position: "insideTopRight",
                fontSize: 10,
                fill: isDark ? "#64748b" : "#94a3b8",
              }}
            />
          )}

          {/* Cost-basis line — dashed grey */}
          <Area
            type="monotone"
            dataKey="invested"
            stroke={isDark ? "#475569" : "#cbd5e1"}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="none"
            dot={false}
            activeDot={false}
            name="Inleg"
          />

          {/* Portfolio value — coloured area */}
          <Area
            type="monotone"
            dataKey="value"
            stroke={valueColor}
            strokeWidth={2.5}
            fill={`url(#${valueGradId})`}
            dot={false}
            activeDot={{
              r: 4,
              fill: valueColor,
              stroke: isDark ? "#1e293b" : "white",
              strokeWidth: 2,
            }}
            name="Waarde"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
