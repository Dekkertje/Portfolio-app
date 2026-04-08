"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { useTheme } from "@/contexts/ThemeContext"

type AllocationData = {
  name: string
  value: number
  percentage: number
}

type AllocationChartProps = {
  data: AllocationData[]
}

const COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f97316", // orange
  "#14b8a6", // teal
]

export function AllocationChart({ data }: AllocationChartProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center text-slate-500 dark:text-slate-400">
        Geen data beschikbaar
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col">
      <ResponsiveContainer width="100%" height="70%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            label={({ percentage }: any) => `${percentage.toFixed(0)}%`}
            labelLine={{ stroke: isDark ? "#94a3b8" : "#64748b" }}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#1e293b" : "white",
              border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
              borderRadius: "8px",
              color: isDark ? "#f1f5f9" : "#0f172a",
            }}
            formatter={(value) =>
              new Intl.NumberFormat("nl-NL", {
                style: "currency",
                currency: "EUR",
              }).format(Number(value))
            }
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Custom Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        {data.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="truncate text-slate-700" title={entry.name}>
              {entry.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

