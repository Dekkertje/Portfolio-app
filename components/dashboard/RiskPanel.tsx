"use client"

import { AlertTriangle, ShieldCheck, Shield } from "lucide-react"
import { PrivacyText } from "@/components/ui/PrivacyText"

function fmt(v: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v)
}

// ─── Max Drawdown chip ────────────────────────────────────────────────────────

function drawdownColor(pct: number) {
  // pct is positive (we display with - sign ourselves)
  if (pct < 10)  return { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-300", icon: "text-emerald-500" }
  if (pct < 25)  return { bg: "bg-amber-50 dark:bg-amber-900/20",   text: "text-amber-700 dark:text-amber-300",   icon: "text-amber-500"   }
  return           { bg: "bg-red-50 dark:bg-red-900/20",             text: "text-red-700 dark:text-red-300",       icon: "text-red-500"     }
}

function DrawdownIcon({ pct }: { pct: number }) {
  const cls = `h-4 w-4 ${drawdownColor(pct).icon}`
  if (pct < 10)  return <ShieldCheck className={cls} />
  if (pct < 25)  return <Shield className={cls} />
  return <AlertTriangle className={cls} />
}

// ─── Exposure bar ─────────────────────────────────────────────────────────────

function ExposureBar({ pct }: { pct: number }) {
  const capped = Math.min(Math.max(pct, 0), 100)
  return (
    <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
      <div
        className="h-full rounded-full bg-indigo-500 transition-all duration-500"
        style={{ width: `${capped}%` }}
      />
    </div>
  )
}

// ─── Generic panel row ────────────────────────────────────────────────────────

function PanelRow({
  label,
  children,
  borderTop = false,
}: {
  label: string
  children: React.ReactNode
  borderTop?: boolean
}) {
  return (
    <div className={`py-3 ${borderTop ? "border-t border-slate-100 dark:border-slate-700" : ""}`}>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
        {label}
      </p>
      {children}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

type RiskPanelProps = {
  maxDrawdownPct: number    // positive value, e.g. 14.3 means −14.3%
  exposurePct: number       // 0–100
  investedValue: number
  cashValue: number
  realizedPnL: number
  dividendYTD: number
}

export function RiskPanel({
  maxDrawdownPct,
  exposurePct,
  investedValue,
  cashValue,
  realizedPnL,
  dividendYTD,
}: RiskPanelProps) {
  const dd = drawdownColor(maxDrawdownPct)
  const noData = maxDrawdownPct === 0

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/50 h-full flex flex-col">

      {/* Max Drawdown */}
      <PanelRow label="Max Drawdown">
        {noData ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Nog geen historische data</p>
        ) : (
          <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ${dd.bg}`}>
            <DrawdownIcon pct={maxDrawdownPct} />
            <span className={`text-lg font-bold ${dd.text}`}>
              −{maxDrawdownPct.toFixed(1)}%
            </span>
          </div>
        )}
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Grootste terugval gemeten vanaf een top
        </p>
      </PanelRow>

      {/* Exposure */}
      <PanelRow label="Exposure" borderTop>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {exposurePct.toFixed(0)}%
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            belegd / totaal
          </span>
        </div>
        <ExposureBar pct={exposurePct} />
        <div className="mt-1.5 flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <PrivacyText>
            <span className="text-indigo-600 dark:text-indigo-400 font-medium">{fmt(investedValue)}</span>
            {" "}belegd
          </PrivacyText>
          {cashValue > 0 && (
            <PrivacyText>
              {fmt(cashValue)} cash
            </PrivacyText>
          )}
        </div>
      </PanelRow>

      {/* Realized P&L */}
      <PanelRow label="Gerealiseerd (incl. div.)" borderTop>
        <span className={`text-lg font-bold ${
          realizedPnL >= 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400"
        }`}>
          <PrivacyText>
            {realizedPnL >= 0 ? "+" : ""}
            {fmt(realizedPnL)}
          </PrivacyText>
        </span>
        {dividendYTD > 0 && (
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            <PrivacyText>waarvan {fmt(dividendYTD)} dividend dit jaar</PrivacyText>
          </p>
        )}
      </PanelRow>

    </div>
  )
}
