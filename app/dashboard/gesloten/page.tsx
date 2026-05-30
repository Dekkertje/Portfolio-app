"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { PrivacyText } from "@/components/ui/PrivacyText"
import { CheckSquare, TrendingUp, TrendingDown } from "lucide-react"
import { Transaction } from "@/lib/types"

type ClosedPosition = {
  product: string
  isin: string | null
  totalInvested: number
  totalProceeds: number
  realizedPnL: number
  pnlPct: number
  tradeCount: number
  firstBuy: string | null
  lastSell: string | null
}

function fmt(v: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(v)
}

function fmtDate(iso: string | null) {
  if (!iso) return "–"
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })
}

export default function GeslotenPage() {
  const [closed, setClosed] = useState<ClosedPosition[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { window.location.href = "/login"; return }

      const { data: portfolio } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!portfolio) { setLoading(false); return }

      const { data: transactions } = await supabase
        .from("transactions")
        .select("*")
        .eq("portfolio_id", portfolio.id)
        .order("trade_date", { ascending: true })

      if (!transactions) { setLoading(false); return }

      // Build positions using weighted-average cost basis
      const grouped: Record<string, {
        product: string; isin: string | null
        quantity: number; invested: number
        realizedPnL: number
        firstBuy: string | null; lastSell: string | null
        totalInvested: number; totalProceeds: number; tradeCount: number
      }> = {}

      for (const tx of transactions as Transaction[]) {
        const key = `${tx.product}__${tx.isin ?? ""}`
        if (!grouped[key]) {
          grouped[key] = {
            product: tx.product, isin: tx.isin,
            quantity: 0, invested: 0, realizedPnL: 0,
            firstBuy: null, lastSell: null,
            totalInvested: 0, totalProceeds: 0, tradeCount: 0,
          }
        }

        const g = grouped[key]
        const abs = Math.abs(Number(tx.quantity))
        const total = Math.abs(Number(tx.total_eur))
        const resolvedType = tx.transaction_type === "unknown"
          ? (Number(tx.total_eur) < 0 ? "buy" : "sell")
          : tx.transaction_type

        g.tradeCount++

        if (resolvedType === "buy") {
          g.quantity += abs
          g.invested += total
          g.totalInvested += total
          if (!g.firstBuy && tx.trade_date) g.firstBuy = tx.trade_date
        } else if (resolvedType === "sell") {
          const avgBefore = g.quantity > 0 ? g.invested / g.quantity : 0
          const costBasis = avgBefore * abs
          g.realizedPnL += total - costBasis
          g.quantity -= abs
          g.invested = Math.max(0, g.invested - costBasis)
          g.totalProceeds += total
          if (tx.trade_date) g.lastSell = tx.trade_date
        }
      }

      const result: ClosedPosition[] = Object.values(grouped)
        .filter(g => g.quantity <= 0.0001 && g.totalInvested > 0)
        .map(g => ({
          product: g.product,
          isin: g.isin,
          totalInvested: g.totalInvested,
          totalProceeds: g.totalProceeds,
          realizedPnL: g.realizedPnL,
          pnlPct: g.totalInvested > 0 ? (g.realizedPnL / g.totalInvested) * 100 : 0,
          tradeCount: g.tradeCount,
          firstBuy: g.firstBuy,
          lastSell: g.lastSell,
        }))
        .sort((a, b) => Math.abs(b.realizedPnL) - Math.abs(a.realizedPnL))

      setClosed(result)
      setLoading(false)
    }
    load()
  }, [])

  const { totalPnL, winners, losers } = useMemo(() => {
    const total = closed.reduce((s, p) => s + p.realizedPnL, 0)
    return {
      totalPnL: total,
      winners: closed.filter(p => p.realizedPnL >= 0).length,
      losers: closed.filter(p => p.realizedPnL < 0).length,
    }
  }, [closed])

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0b1120] px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-500/10 border border-slate-500/20 p-2">
            <CheckSquare className="h-6 w-6 text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Afgesloten Posities</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Volledig verkochte posities en gerealiseerde winst/verlies
            </p>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#1a2744] border-t-slate-400" />
              <p className="text-slate-500 dark:text-slate-400">Gegevens laden…</p>
            </div>
          </div>
        ) : closed.length === 0 ? (
          <div className="rounded-xl bg-white dark:bg-[#0d1829] p-12 text-center shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80">
            <CheckSquare className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="font-medium text-slate-600 dark:text-slate-400">Geen afgesloten posities</p>
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">Posities verschijnen hier nadat je ze volledig hebt verkocht</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-white dark:bg-[#0d1829] p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Gerealiseerd resultaat</p>
                <p className={`mt-2 text-2xl font-bold ${totalPnL >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                  <PrivacyText>{totalPnL >= 0 ? "+" : ""}{fmt(totalPnL)}</PrivacyText>
                </p>
                <p className="mt-1 text-xs text-slate-400">{closed.length} posities gesloten</p>
              </div>
              <div className="rounded-xl bg-white dark:bg-[#0d1829] p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Winstgevend</p>
                <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{winners}</p>
                <p className="mt-1 text-xs text-slate-400">posities met winst</p>
              </div>
              <div className="rounded-xl bg-white dark:bg-[#0d1829] p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Met verlies</p>
                <p className="mt-2 text-2xl font-bold text-red-500">{losers}</p>
                <p className="mt-1 text-xs text-slate-400">posities met verlies</p>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl bg-white dark:bg-[#0d1829] shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-[#1a2744]">
                  <thead className="bg-slate-50 dark:bg-[#0b1120]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Bedrijf</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden sm:table-cell">Geïnvesteerd</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden sm:table-cell">Opbrengst</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Resultaat</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">Periode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#1a2744]">
                    {closed.map((pos, i) => {
                      const isWin = pos.realizedPnL >= 0
                      return (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-[#1a2744]/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isWin ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                                {isWin
                                  ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                                  : <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                                }
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{pos.product}</p>
                                {pos.isin && <p className="text-xs text-slate-400">{pos.isin}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                            <PrivacyText>{fmt(pos.totalInvested)}</PrivacyText>
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                            <PrivacyText>{fmt(pos.totalProceeds)}</PrivacyText>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className={`text-sm font-bold ${isWin ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                              <PrivacyText>{isWin ? "+" : ""}{fmt(pos.realizedPnL)}</PrivacyText>
                            </p>
                            <p className={`text-xs ${isWin ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                              {pos.pnlPct >= 0 ? "+" : ""}{pos.pnlPct.toFixed(2)}%
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right text-xs text-slate-400 hidden md:table-cell">
                            <p>{fmtDate(pos.firstBuy)}</p>
                            <p>→ {fmtDate(pos.lastSell)}</p>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
