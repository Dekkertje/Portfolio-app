"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts"
import { useTheme } from "@/contexts/ThemeContext"

type PerformanceData = {
  date: string
  value: number
  invested: number
}

type PerformanceChartProps = {
  data: PerformanceData[]
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorInvested" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={isDark ? "#334155" : "#e2e8f0"}
          />
          <XAxis
            dataKey="date"
            stroke={isDark ? "#94a3b8" : "#64748b"}
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke={isDark ? "#94a3b8" : "#64748b"}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) =>
              `€${(value / 1000).toFixed(0)}k`
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#1e293b" : "white",
              border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
              borderRadius: "8px",
              padding: "12px",
              color: isDark ? "#f1f5f9" : "#0f172a",
            }}
            formatter={(value) =>
              new Intl.NumberFormat("nl-NL", {
                style: "currency",
                currency: "EUR",
              }).format(Number(value))
            }
          />
          <Area
            type="monotone"
            dataKey="invested"
            stroke={isDark ? "#94a3b8" : "#64748b"}
            strokeWidth={2}
            fill="url(#colorInvested)"
            name="Geïnvesteerd"
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#colorValue)"
            name="Waarde"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

