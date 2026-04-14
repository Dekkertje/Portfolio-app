"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { PrivacyText } from "@/components/ui/PrivacyText"

function fmt(v: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v)
}

function fmtPct(v: number, decimals = 2) {
  const sign = v > 0 ? "+" : ""
  return `${sign}${v.toFixed(decimals)}%`
}

function fmtEur(v: number) {
  const sign = v > 0 ? "+" : ""
  return `${sign}${new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v)}`
}

type Chip = {
  label: string
  value: string
  positive: boolean | null   // null = neutral
}

function StatChip({ label, value, positive }: Chip) {
  const color =
    positive === null
      ? "text-slate-700 dark:text-slate-300"
      : positive
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400"

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </span>
      <span className={`text-sm font-bold ${color}`}>
        <PrivacyText>{value}</PrivacyText>
      </span>
    </div>
  )
}

type HeroCardProps = {
  totalValue: number
  netPnL: number          // totalReturn in €
  totalReturnPct: number  // % op ingezet kapitaal
  dailyPnL: number
  dailyPnLPct: number
  ytdReturnPct: number | null   // null = niet genoeg data
  totalCapitalDeployed: number
}

export function HeroCard({
  totalValue,
  netPnL,
  totalReturnPct,
  dailyPnL,
  dailyPnLPct,
  ytdReturnPct,
  totalCapitalDeployed,
}: HeroCardProps) {
  const isPositive = netPnL >= 0
  const TrendIcon = isPositive ? TrendingUp : netPnL < 0 ? TrendingDown : Minus

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/50">

      {/* Top row: portfolio value + return % */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Portfolio Waarde
          </p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-none">
            <PrivacyText>{fmt(totalValue)}</PrivacyText>
          </p>
        </div>

        {/* Return badge */}
        <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 ${
          isPositive
            ? "bg-emerald-50 dark:bg-emerald-900/30"
            : "bg-red-50 dark:bg-red-900/30"
        }`}>
          <TrendIcon className={`h-4 w-4 shrink-0 ${
            isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          }`} />
          <span className={`text-xl font-bold ${
            isPositive ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
          }`}>
            <PrivacyText>{fmtPct(totalReturnPct)}</PrivacyText>
          </span>
        </div>
      </div>

      {/* Net P&L line */}
      <div className="mt-3 flex items-center gap-2">
        <span className={`text-lg font-semibold ${
          isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        }`}>
          <PrivacyText>{fmtEur(netPnL)}</PrivacyText>
        </span>
        <span className="text-sm text-slate-400 dark:text-slate-500">
          netto rendement
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          · op <PrivacyText>{fmt(totalCapitalDeployed)}</PrivacyText> ingezet
        </span>
      </div>

      {/* Divider */}
      <div className="my-4 border-t border-slate-100 dark:border-slate-700" />

      {/* Secondary chips: vandaag + YTD */}
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <StatChip
          label="Vandaag"
          value={`${fmtEur(dailyPnL)}  (${fmtPct(dailyPnLPct)})`}
          positive={dailyPnL === 0 ? null : dailyPnL > 0}
        />
        {ytdReturnPct !== null && (
          <StatChip
            label="YTD"
            value={fmtPct(ytdReturnPct)}
            positive={ytdReturnPct === 0 ? null : ytdReturnPct > 0}
          />
        )}
      </div>
    </div>
  )
}
