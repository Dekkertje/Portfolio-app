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

type PerformanceData = {
  date: string
  value: number
  invested: number
}

type PerformanceChartProps = {
  data: PerformanceData[]
  costBasis?: number   // draw a flat reference line at this value when no invested series
}

const EUR = (v: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(v)

// Custom tooltip showing value, cost basis, and P&L gap
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const value    = payload.find((p: any) => p.dataKey === "value")?.value    as number | undefined
  const invested = payload.find((p: any) => p.dataKey === "invested")?.value as number | undefined

  if (value === undefined) return null

  const pnl = invested !== undefined ? value - invested : null

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-lg text-sm">
      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">{label}</p>
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
        {pnl !== null && (
          <div className={`flex justify-between gap-6 pt-1 border-t border-slate-100 dark:border-slate-700 font-semibold ${
            pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          }`}>
            <span>P&L</span>
            <span>{pnl >= 0 ? "+" : ""}{EUR(pnl)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function PerformanceChart({ data, costBasis }: PerformanceChartProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        Nog geen historische data beschikbaar
      </div>
    )
  }

  // Determine if the current value is above or below cost basis
  // to set the area color for the most recent data point
  const lastPoint = data[data.length - 1]
  const isAbove   = lastPoint ? lastPoint.value >= lastPoint.invested : true

  const valueColor   = isAbove ? "#10b981" : "#ef4444"  // emerald or red
  const valueColorId = isAbove ? "gradientGain" : "gradientLoss"

  const gridColor = isDark ? "#334155" : "#e2e8f0"
  const axisColor = isDark ? "#94a3b8" : "#64748b"

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {/* Gain gradient — emerald */}
            <linearGradient id="gradientGain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
            {/* Loss gradient — red */}
            <linearGradient id="gradientLoss" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />

          <XAxis
            dataKey="date"
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

          <Tooltip content={<CustomTooltip />} />

          {/* Cost-basis reference line — dashed, subtle */}
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

          {/* Cost-basis area — very faint, always grey */}
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
            fill={`url(#${valueColorId})`}
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
