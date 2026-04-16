"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { useTheme } from "@/contexts/ThemeContext"
import { PrivacyText } from "@/components/ui/PrivacyText"
import { useState } from "react"

type Position = {
  product: string
  currentValue: number
  isETF: boolean
  sector?: string
}

type Props = {
  positions: Position[]
}

const SECTOR_COLORS: Record<string, string> = {
  "Semiconductors":    "#a3e635",
  "Technology":        "#22d3ee",
  "Software & Cloud":  "#818cf8",
  "Media & Entertainment": "#f472b6",
  "Cybersecurity":     "#fb923c",
  "Data Analytics":    "#34d399",
  "Financial Services":"#fbbf24",
  "Energy":            "#4ade80",
  "Consumer":          "#e879f9",
  "Healthcare":        "#38bdf8",
  "Tech ETF":          "#6366f1",
  "Index ETF":         "#14b8a6",
  "Dividend ETF":      "#f59e0b",
  "ETF":               "#8b5cf6",
  "Overig":            "#64748b",
}

function getColor(sector: string, idx: number): string {
  return SECTOR_COLORS[sector] ?? `hsl(${(idx * 47) % 360}, 65%, 55%)`
}

function fmt(v: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)
}

type Tab = "sector" | "type"

export function AllocationBreakdown({ positions }: Props) {
  const { theme } = useTheme()
  const isDark = theme === "dark"
  const [tab, setTab] = useState<Tab>("sector")

  const totalValue = positions.reduce((s, p) => s + p.currentValue, 0)
  if (totalValue === 0) return null

  // ── Sector aggregation ────────────────────────────────────────────────────
  const sectorMap: Record<string, number> = {}
  for (const p of positions) {
    const key = p.sector ?? "Overig"
    sectorMap[key] = (sectorMap[key] ?? 0) + p.currentValue
  }
  const sectorData = Object.entries(sectorMap)
    .map(([name, value]) => ({ name, value, pct: (value / totalValue) * 100 }))
    .sort((a, b) => b.value - a.value)

  // ── ETF / Aandelen aggregation ────────────────────────────────────────────
  const etfValue    = positions.filter(p =>  p.isETF).reduce((s, p) => s + p.currentValue, 0)
  const stockValue  = positions.filter(p => !p.isETF).reduce((s, p) => s + p.currentValue, 0)
  const typeData = [
    { name: "Aandelen", value: stockValue, pct: (stockValue / totalValue) * 100, color: "#a3e635" },
    { name: "ETF's",    value: etfValue,   pct: (etfValue   / totalValue) * 100, color: "#22d3ee" },
  ].filter(d => d.value > 0)

  const chartData = tab === "sector" ? sectorData : typeData

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0d1829] p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80">
      {/* Header + tabs */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Verdeling</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Spreiding van je portfolio</p>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#0b1120] border border-slate-200 dark:border-[#1a2744] p-1">
          {(["sector", "type"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                tab === t
                  ? "bg-white dark:bg-[#1a2744] text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              {t === "sector" ? "Sector" : "Type"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Pie chart */}
        <div className="h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {chartData.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={"color" in entry ? (entry as any).color : getColor(entry.name, i)}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? "#0d1829" : "white",
                  border: `1px solid ${isDark ? "#1a2744" : "#e2e8f0"}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: isDark ? "#f1f5f9" : "#0f172a",
                }}
                formatter={(value, name) => [`${fmt(Number(value))}`, String(name)]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend list */}
        <div className="flex-1 min-w-0 space-y-1.5 max-h-44 overflow-y-auto pr-1 scrollbar-thin">
          {chartData.map((entry, i) => {
            const color = "color" in entry ? (entry as any).color : getColor(entry.name, i)
            return (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{entry.name}</span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                      {entry.pct.toFixed(1)}%
                    </span>
                  </div>
                  {/* Mini progress bar */}
                  <div className="mt-0.5 h-1 w-full rounded-full bg-slate-100 dark:bg-[#0b1120]">
                    <div
                      className="h-1 rounded-full transition-all"
                      style={{ width: `${entry.pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
