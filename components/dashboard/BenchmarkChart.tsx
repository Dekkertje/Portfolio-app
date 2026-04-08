"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { BenchmarkType, getBenchmarkName } from "@/lib/utils"
import { useTheme } from "@/contexts/ThemeContext"

type BenchmarkChartProps = {
  data: {
    date: string
    portfolio: number
    benchmark: number
  }[]
  benchmarkType: BenchmarkType
}

export function BenchmarkChart({ data, benchmarkType }: BenchmarkChartProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
        Geen data beschikbaar
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={isDark ? "#334155" : "#e2e8f0"}
        />
        <XAxis
          dataKey="date"
          stroke={isDark ? "#94a3b8" : "#64748b"}
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke={isDark ? "#94a3b8" : "#64748b"}
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => `${value.toFixed(0)}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: isDark ? "#1e293b" : "white",
            border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
            borderRadius: '8px',
            fontSize: '12px',
            color: isDark ? "#f1f5f9" : "#0f172a",
          }}
          formatter={(value) => `${Number(value).toFixed(2)}%`}
        />
        <Legend
          wrapperStyle={{
            fontSize: '12px',
            color: isDark ? "#f1f5f9" : "#0f172a",
          }}
        />
        <Line
          type="monotone"
          dataKey="portfolio"
          name="Jouw Portfolio"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="benchmark"
          name={getBenchmarkName(benchmarkType)}
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          strokeDasharray="5 5"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

