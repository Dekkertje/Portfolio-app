"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Receipt, TrendingUp, TrendingDown } from "lucide-react"

type Transaction = {
  id: string
  trade_date: string | null
  trade_time: string | null
  product: string
  isin: string | null
  quantity: number
  price: number
  total_eur: number
  transaction_type: string | null
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTransactions() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) { window.location.href = "/login"; return }

      const { data: portfolio } = await supabase
        .from("portfolios").select("id").eq("user_id", userData.user.id).single()
      if (!portfolio) { setLoading(false); return }

      const { data, error } = await supabase
        .from("transactions").select("*")
        .eq("portfolio_id", portfolio.id)
        .order("trade_date", { ascending: false })

      if (!error && data) setTransactions(data)
      setLoading(false)
    }
    loadTransactions()
  }, [])

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0b1120] px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-lime-500/10 border border-lime-500/20 p-2">
            <Receipt className="h-6 w-6 text-lime-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Transacties</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Overzicht van alle koop- en verkooptransacties
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#1a2744] border-t-lime-500" />
              <p className="text-slate-500 dark:text-slate-400">Gegevens laden…</p>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-xl bg-white dark:bg-[#0d1829] p-12 text-center shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80">
            <p className="text-slate-500 dark:text-slate-400">Geen transacties gevonden</p>
            <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">Importeer transacties om ze hier te zien</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const isBuy = tx.transaction_type === "buy" || tx.quantity > 0

              return (
                <div
                  key={tx.id}
                  className="rounded-xl bg-white dark:bg-[#0d1829] px-5 py-4 shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80 transition hover:ring-slate-200 dark:hover:ring-[#1a2744]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`shrink-0 rounded-lg p-2 ${
                        isBuy
                          ? "bg-emerald-500/10 border border-emerald-500/20"
                          : "bg-red-500/10 border border-red-500/20"
                      }`}>
                        {isBuy
                          ? <TrendingUp  className="h-4 w-4 text-emerald-500" />
                          : <TrendingDown className="h-4 w-4 text-red-500" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{tx.product}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {tx.trade_date}{tx.trade_time ? ` · ${tx.trade_time}` : ""}
                          {tx.isin && <span className="ml-2 text-slate-400 dark:text-slate-500">{tx.isin}</span>}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {Math.abs(tx.quantity)} × €{tx.price.toFixed(2)}
                      </p>
                      <p className={`text-base font-bold ${isBuy ? "text-emerald-500" : "text-red-500"}`}>
                        {isBuy ? "+" : "−"}€{Math.abs(tx.total_eur).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
