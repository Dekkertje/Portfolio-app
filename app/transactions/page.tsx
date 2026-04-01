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

      if (!userData.user) {
        window.location.href = "/login"
        return
      }

      const { data: portfolio } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", userData.user.id)
        .single()

      if (!portfolio) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("portfolio_id", portfolio.id)
        .order("trade_date", { ascending: false })

      if (!error && data) {
        setTransactions(data)
      }

      setLoading(false)
    }

    loadTransactions()
  }, [])

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-100 p-2">
            <Receipt className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Transacties</h1>
            <p className="mt-1 text-sm text-slate-500">
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
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
              <p className="text-slate-600">Gegevens laden...</p>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-900/5">
            <p className="text-slate-500">Geen transacties gevonden</p>
            <p className="mt-2 text-sm text-slate-400">
              Importeer transacties om ze hier te zien
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => {
              const isBuy = tx.transaction_type?.toLowerCase().includes("koop") || tx.quantity > 0

              return (
                <div
                  key={tx.id}
                  className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 transition hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`rounded-lg p-2 ${isBuy ? "bg-green-100" : "bg-red-100"}`}>
                        {isBuy ? (
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{tx.product}</p>
                        <p className="text-sm text-slate-500">
                          {tx.trade_date} {tx.trade_time && `· ${tx.trade_time}`}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-700">
                        {Math.abs(tx.quantity)} stuks @ €{tx.price.toFixed(2)}
                      </p>
                      <p className={`text-lg font-bold ${isBuy ? "text-green-600" : "text-red-600"}`}>
                        {isBuy ? "+" : ""}€{tx.total_eur.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {tx.isin && (
                    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                      <span className="text-xs font-medium text-slate-500">ISIN:</span>{" "}
                      <span className="text-xs text-slate-700">{tx.isin}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}