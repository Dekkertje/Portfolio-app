"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import Link from "next/link"
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, DollarSign } from "lucide-react"

interface Politician {
  id: string
  first_name: string
  last_name: string
  full_name: string
  party: "democrat" | "republican" | "independent"
  chamber: "house" | "senate"
  state: string
  district: string | null
  photo_url: string | null
  bio: string | null
}

interface Trade {
  id: string
  ticker: string
  asset_description: string
  transaction_type: "purchase" | "sale" | "exchange"
  transaction_date: string
  disclosure_date: string
  amount_display: string
  price_at_transaction: number
  current_price: number | null
  gain_loss_percent: number | null
}

interface Holding {
  id: string
  ticker: string
  asset_description: string
  shares: number
  average_cost: number
  current_price: number
  total_value: number
  gain_loss_percent: number
}

export default function PoliticianDetailPage() {
  const params = useParams()
  const politicianId = params.id as string

  const [politician, setPolitician] = useState<Politician | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"trades" | "holdings">("trades")

  useEffect(() => {
    if (politicianId) {
      fetchData()
    }
  }, [politicianId])

  async function fetchData() {
    setLoading(true)

    try {
      // Fetch politician
      const { data: politicianData, error: politicianError } = await supabase
        .from("politicians")
        .select("*")
        .eq("id", politicianId)
        .single()

      if (politicianError) throw politicianError
      setPolitician(politicianData)

      // Fetch trades
      const { data: tradesData, error: tradesError } = await supabase
        .from("politician_trades")
        .select("*")
        .eq("politician_id", politicianId)
        .order("transaction_date", { ascending: false })

      if (tradesError) throw tradesError
      setTrades(tradesData || [])

      // Fetch holdings
      const { data: holdingsData, error: holdingsError } = await supabase
        .from("politician_holdings")
        .select("*")
        .eq("politician_id", politicianId)
        .order("total_value", { ascending: false })

      if (holdingsError) throw holdingsError
      setHoldings(holdingsData || [])
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const getPartyColor = (party: string) => {
    switch (party) {
      case "democrat":
        return "bg-blue-600"
      case "republican":
        return "bg-red-600"
      case "independent":
        return "bg-purple-600"
      default:
        return "bg-gray-600"
    }
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`
    }
    return `$${value.toFixed(2)}`
  }

  const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.total_value, 0)

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <p className="text-center text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </DashboardLayout>
    )
  }

  if (!politician) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <p className="text-center text-gray-500 dark:text-gray-400">Politician not found</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Back Button */}
        <Link href="/politicians" className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Politicians
        </Link>

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-slate-900/50 p-8 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 dark:text-slate-100">{politician.full_name}</h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
              {politician.chamber === "house" ? "U.S. Representative" : "U.S. Senator"} •{" "}
              {politician.state}
              {politician.district ? ` District ${politician.district}` : ""}
            </p>
            {politician.bio && <p className="text-gray-600 dark:text-gray-400 max-w-3xl">{politician.bio}</p>}
          </div>
          <span className={`px-4 py-2 rounded-full text-white font-semibold ${getPartyColor(politician.party)}`}>
            {politician.party.charAt(0).toUpperCase() + politician.party.slice(1)}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-green-50 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Total Portfolio Value</p>
                <p className="text-3xl font-bold text-green-900 mt-1">{formatCurrency(totalPortfolioValue)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Trades</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">{trades.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Holdings</p>
                <p className="text-3xl font-bold text-purple-900 mt-1">{holdings.length}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-lg">
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab("trades")}
              className={`px-6 py-4 font-semibold ${
                activeTab === "trades"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Recent Trades ({trades.length})
            </button>
            <button
              onClick={() => setActiveTab("holdings")}
              className={`px-6 py-4 font-semibold ${
                activeTab === "holdings"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Current Holdings ({holdings.length})
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === "trades" ? (
            <div className="space-y-4">
              {trades.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No trades found</p>
              ) : (
                trades.map((trade) => (
                  <div key={trade.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold">{trade.ticker}</h3>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              trade.transaction_type === "purchase"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {trade.transaction_type.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{trade.asset_description}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Transaction Date</p>
                            <p className="font-medium">
                              {new Date(trade.transaction_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Disclosed</p>
                            <p className="font-medium">
                              {new Date(trade.disclosure_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-500">Amount</p>
                            <p className="font-medium">{trade.amount_display}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Price at Transaction</p>
                            <p className="font-medium">${trade.price_at_transaction.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {holdings.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No holdings found</p>
              ) : (
                holdings.map((holding) => (
                  <div key={holding.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold">{holding.ticker}</h3>
                          {holding.gain_loss_percent !== null && (
                            <span
                              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                                holding.gain_loss_percent >= 0
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {holding.gain_loss_percent >= 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              {Math.abs(holding.gain_loss_percent).toFixed(2)}%
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{holding.asset_description}</p>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Shares</p>
                            <p className="font-medium">{holding.shares.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Avg Cost</p>
                            <p className="font-medium">${holding.average_cost.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Current Price</p>
                            <p className="font-medium">${holding.current_price.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Total Value</p>
                            <p className="font-medium">{formatCurrency(holding.total_value)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Gain/Loss</p>
                            <p
                              className={`font-medium ${
                                holding.gain_loss_percent && holding.gain_loss_percent >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {holding.gain_loss_percent !== null
                                ? `${holding.gain_loss_percent >= 0 ? "+" : ""}${holding.gain_loss_percent.toFixed(2)}%`
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </DashboardLayout>
  )
}

