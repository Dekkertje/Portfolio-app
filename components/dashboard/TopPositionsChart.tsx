"use client"

import { PrivacyText } from "@/components/ui/PrivacyText"

function fmt(v: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v)
}

function fmtPct(v: number) {
  const sign = v > 0 ? "+" : ""
  return `${sign}${v.toFixed(1)}%`
}

// Shorten long product names for display
function shortName(name: string): string {
  return name
    .replace(/\bHOLDING\b/gi, "")
    .replace(/\bUCITS ETF\b/gi, "ETF")
    .replace(/\bINC\.?\b/gi, "")
    .replace(/\bCORP\.?\b/gi, "")
    .replace(/\bCLASS [A-Z]\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 22)
}

export type TopPosition = {
  product: string
  isin: string | null
  currentValue: number
  weight: number      // % of total portfolio
  pnlEur: number      // unrealized P&L in EUR
  pnlPct: number      // unrealized P&L %
  isETF: boolean
}

type TopPositionsChartProps = {
  positions: TopPosition[]
}

const MAX_BARS = 8

// Fixed colour palette — consistent per render, not index-dependent after sort
const BAR_COLORS = [
  "bg-indigo-500",
  "bg-violet-500",
  "bg-sky-500",
  "bg-teal-500",
  "bg-amber-500",
  "bg-pink-500",
  "bg-orange-500",
  "bg-cyan-500",
]

export function TopPositionsChart({ positions }: TopPositionsChartProps) {
  if (!positions || positions.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        Geen posities beschikbaar
      </div>
    )
  }

  // Sort by value descending, cap at MAX_BARS
  const sorted = [...positions]
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, MAX_BARS)

  // "Overige" bucket
  const shownTotal = sorted.reduce((s, p) => s + p.weight, 0)
  const otherWeight = 100 - shownTotal
  const maxWeight = sorted[0]?.weight ?? 1

  return (
    <div className="space-y-2.5">
      {sorted.map((pos, i) => {
        const barWidth = Math.max((pos.weight / maxWeight) * 100, 2)
        const isGain = pos.pnlEur >= 0

        return (
          <div key={`${pos.product}-${i}`} className="group">
            {/* Label row */}
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                  <PrivacyText>{shortName(pos.product)}</PrivacyText>
                </span>
                {pos.isETF && (
                  <span className="shrink-0 rounded text-[10px] font-semibold px-1 py-0.5 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                    ETF
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs font-semibold ${
                  isGain ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                }`}>
                  <PrivacyText>{fmtPct(pos.pnlPct)}</PrivacyText>
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-12 text-right">
                  <PrivacyText>{pos.weight.toFixed(1)}%</PrivacyText>
                </span>
              </div>
            </div>

            {/* Bar row */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${BAR_COLORS[i % BAR_COLORS.length]}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 w-20 text-right shrink-0">
                <PrivacyText>{fmt(pos.currentValue)}</PrivacyText>
              </span>
            </div>
          </div>
        )
      })}

      {/* Overige bucket */}
      {otherWeight > 0.5 && positions.length > MAX_BARS && (
        <div className="pt-1 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
            <span>Overige {positions.length - MAX_BARS} posities</span>
            <span><PrivacyText>{otherWeight.toFixed(1)}%</PrivacyText></span>
          </div>
        </div>
      )}
    </div>
  )
}
