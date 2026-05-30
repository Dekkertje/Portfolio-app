"use client"

import { TrendingUp, TrendingDown, Minus, Target, Pencil, Check, X, Info } from "lucide-react"
import { PrivacyText } from "@/components/ui/PrivacyText"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"

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
  positive: boolean | null
}

function StatChip({ label, value, positive }: Chip) {
  const color =
    positive === null
      ? "text-slate-600 dark:text-slate-300"
      : positive
      ? "text-emerald-500 dark:text-emerald-400"
      : "text-red-500 dark:text-red-400"

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
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
  netPnL: number
  totalReturnPct: number
  dailyPnL: number
  dailyPnLPct: number
  ytdReturnPct: number | null
  portfolioId: string | null
}

export function HeroCard({
  totalValue,
  netPnL,
  totalReturnPct,
  dailyPnL,
  dailyPnLPct,
  ytdReturnPct,
  portfolioId,
}: HeroCardProps) {
  const isPositive = netPnL >= 0
  const TrendIcon = isPositive ? TrendingUp : netPnL < 0 ? TrendingDown : Minus

  // ── Target amount state ────────────────────────────────────────────────────
  const [targetAmount, setTargetAmount] = useState<number | null>(null)
  const [editing, setEditing]           = useState(false)
  const [inputValue, setInputValue]     = useState("")

  // Load from Supabase on mount (fall back to localStorage for existing users)
  useEffect(() => {
    async function load() {
      if (!portfolioId) return
      const { data } = await supabase
        .from("portfolios")
        .select("target_amount")
        .eq("id", portfolioId)
        .maybeSingle()
      if (data?.target_amount != null) {
        setTargetAmount(Number(data.target_amount))
      } else {
        // one-time migration from localStorage
        const stored = localStorage.getItem("portfolio_target_amount")
        if (stored) {
          const n = parseFloat(stored)
          if (!isNaN(n) && n > 0) {
            setTargetAmount(n)
            supabase.from("portfolios").update({ target_amount: n }).eq("id", portfolioId)
            localStorage.removeItem("portfolio_target_amount")
          }
        }
      }
    }
    load()
  }, [portfolioId])

  async function saveTarget() {
    const raw    = inputValue.replace(/[^\d,.-]/g, "").replace(",", ".")
    const parsed = parseFloat(raw)
    if (!isNaN(parsed) && parsed > 0) {
      setTargetAmount(parsed)
      if (portfolioId) {
        await supabase.from("portfolios").update({ target_amount: parsed }).eq("id", portfolioId)
      }
    }
    setEditing(false)
  }

  async function removeTarget() {
    setTargetAmount(null)
    if (portfolioId) {
      await supabase.from("portfolios").update({ target_amount: null }).eq("id", portfolioId)
    }
    setEditing(false)
  }

  function startEdit() {
    setInputValue(targetAmount ? String(Math.round(targetAmount)) : "")
    setEditing(true)
  }

  // ── Progress calculation ───────────────────────────────────────────────────
  const progress   = targetAmount && targetAmount > 0
    ? Math.min((totalValue / targetAmount) * 100, 100)
    : null
  const remaining  = targetAmount ? Math.max(targetAmount - totalValue, 0) : null
  const isReached  = targetAmount ? totalValue >= targetAmount : false

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0d1829] p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80">

      {/* Top row: portfolio value + return badge */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
            Portfolio Waarde
          </p>
          <p className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
            <PrivacyText>{fmt(totalValue)}</PrivacyText>
          </p>
        </div>

        {/* Return badge */}
        <div className="relative group">
          <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 border cursor-default ${
            isPositive
              ? "border-lime-500/30 bg-lime-500/10"
              : "border-red-500/30 bg-red-500/10"
          }`}>
            <TrendIcon className={`h-4 w-4 shrink-0 ${isPositive ? "text-lime-500" : "text-red-500"}`} />
            <span className={`text-xl font-bold ${isPositive ? "text-lime-500" : "text-red-500"}`}>
              <PrivacyText>{fmtPct(totalReturnPct)}</PrivacyText>
            </span>
            <Info className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          </div>

          {/* Tooltip */}
          <div className="pointer-events-none absolute right-0 top-full mt-2 z-20 w-64 rounded-xl border border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0d1829] px-4 py-3 shadow-xl text-xs text-slate-600 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1.5">Totale all-time return</p>
            <p className="leading-relaxed">
              Berekend als je totale netto rendement (ongerealiseerd + gerealiseerd + dividend) gedeeld door het totaal ingelegd kapitaal — inclusief posities die je al verkocht hebt.
            </p>
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-[#1a2744] font-mono text-slate-500 dark:text-slate-500">
              (winst + dividend) ÷ inleg
            </div>
          </div>
        </div>
      </div>

      {/* Net P&L */}
      <div className="mt-3 flex items-center gap-2">
        <span className={`text-lg font-semibold ${
          isPositive ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
        }`}>
          <PrivacyText>{fmtEur(netPnL)}</PrivacyText>
        </span>
        <span className="text-sm text-slate-400 dark:text-slate-500">Netto rendement</span>
      </div>

      {/* ── Target progress section ──────────────────────────────────────────── */}
      {(targetAmount || editing) && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Target className={`h-3.5 w-3.5 ${isReached ? "text-lime-500" : "text-slate-400 dark:text-slate-500"}`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Doelbedrag
              </span>
            </div>

            {/* Edit controls */}
            {editing ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-400 dark:text-slate-500 mr-1">€</span>
                <input
                  autoFocus
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveTarget(); if (e.key === "Escape") setEditing(false) }}
                  className="w-28 rounded-md bg-slate-100 dark:bg-[#0b1120] border border-slate-200 dark:border-[#1a2744] px-2 py-0.5 text-xs text-slate-900 dark:text-slate-100 text-right outline-none focus:border-lime-500"
                  placeholder="100000"
                />
                <button onClick={saveTarget} className="rounded p-0.5 hover:text-lime-500 text-slate-400 transition-colors">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button onClick={removeTarget} className="rounded p-0.5 hover:text-red-500 text-slate-400 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button onClick={startEdit} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {targetAmount && !editing && (
            <>
              {/* Progress bar */}
              <div className="relative h-2 w-full rounded-full bg-slate-100 dark:bg-[#0b1120] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    isReached
                      ? "bg-lime-500 shadow-sm shadow-lime-500/40"
                      : "bg-gradient-to-r from-lime-500/60 to-lime-500"
                  }`}
                  style={{ width: `${progress}%` }}
                />
                {/* Shimmer plays once on mount only */}
                {!isReached && (
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: "linear-gradient(90deg, transparent 0%, rgba(163,230,53,0.3) 50%, transparent 100%)",
                      animation: "shimmer 1.2s ease-out 1",
                    }}
                  />
                )}
              </div>

              {/* Labels */}
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-baseline gap-1">
                  <span className={`text-sm font-bold ${isReached ? "text-lime-500" : "text-slate-900 dark:text-slate-100"}`}>
                    <PrivacyText>{progress?.toFixed(1)}%</PrivacyText>
                  </span>
                  {!isReached && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      — nog <PrivacyText>{fmt(remaining!)}</PrivacyText> te gaan
                    </span>
                  )}
                  {isReached && (
                    <span className="text-xs text-lime-500 font-medium ml-1">🎯 Doel bereikt!</span>
                  )}
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  <PrivacyText>{fmt(targetAmount)}</PrivacyText>
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="my-4 border-t border-slate-100 dark:border-[#1a2744]" />

      {/* Secondary chips */}
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
        {/* Target chip — shows when target is set and not in edit mode */}
        {targetAmount && !editing && (
          <StatChip
            label="Doel"
            value={fmt(targetAmount)}
            positive={null}
          />
        )}
        {/* Set target button — only shows when no target set */}
        {!targetAmount && !editing && (
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-lime-500 dark:hover:text-lime-400 transition-colors"
          >
            <Target className="h-3.5 w-3.5" />
            <span>Doelbedrag instellen</span>
          </button>
        )}
      </div>

      {/* Shimmer animation keyframe */}
      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}
