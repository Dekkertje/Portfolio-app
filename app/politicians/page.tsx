"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import Link from "next/link"

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

interface PoliticianWithStats extends Politician {
  total_trades: number
  recent_trades: number
  total_holdings_value: number
}

export default function PoliticiansPage() {
  const [politicians, setPoliticians] = useState<PoliticianWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "house" | "senate">("all")
  const [partyFilter, setPartyFilter] = useState<"all" | "democrat" | "republican" | "independent">("all")

  useEffect(() => {
    fetchPoliticians()
  }, [])

  async function fetchPoliticians() {
    setLoading(true)

    try {
      // Fetch all politicians
      let query = supabase.from("politicians").select("*")

      const { data: politiciansData, error } = await query

      if (error) throw error

      // Fetch trades count for each politician
      const politiciansWithStats = await Promise.all(
        (politiciansData || []).map(async (politician) => {
          const { count: totalTrades } = await supabase
            .from("politician_trades")
            .select("*", { count: "exact", head: true })
            .eq("politician_id", politician.id)

          const { count: recentTrades } = await supabase
            .from("politician_trades")
            .select("*", { count: "exact", head: true })
            .eq("politician_id", politician.id)
            .gte("transaction_date", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

          const { data: holdings } = await supabase
            .from("politician_holdings")
            .select("total_value")
            .eq("politician_id", politician.id)

          const totalValue = holdings?.reduce((sum, h) => sum + (Number(h.total_value) || 0), 0) || 0

          return {
            ...politician,
            total_trades: totalTrades || 0,
            recent_trades: recentTrades || 0,
            total_holdings_value: totalValue,
          }
        })
      )

      setPoliticians(politiciansWithStats)
    } catch (error) {
      console.error("Error fetching politicians:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPoliticians = politicians.filter((p) => {
    if (filter !== "all" && p.chamber !== filter) return false
    if (partyFilter !== "all" && p.party !== partyFilter) return false
    return true
  })

  const getPartyColor = (party: string) => {
    switch (party) {
      case "democrat":
        return "text-blue-600 bg-blue-50"
      case "republican":
        return "text-red-600 bg-red-50"
      case "independent":
        return "text-purple-600 bg-purple-50"
      default:
        return "text-gray-600 bg-gray-50"
    }
  }

  const getPartyBadge = (party: string) => {
    return party.charAt(0).toUpperCase() + party.slice(1)
  }

  return (
    <DashboardLayout>
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-8 py-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Congressional Trading Tracker</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Track stock trades made by members of Congress as disclosed under the STOCK Act
          </p>
        </div>
      </div>

      <div className="p-8">

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6 mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chamber</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded ${
                  filter === "all" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("house")}
                className={`px-4 py-2 rounded ${
                  filter === "house" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                House
              </button>
              <button
                onClick={() => setFilter("senate")}
                className={`px-4 py-2 rounded ${
                  filter === "senate" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                Senate
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Party</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPartyFilter("all")}
                className={`px-4 py-2 rounded ${
                  partyFilter === "all" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setPartyFilter("democrat")}
                className={`px-4 py-2 rounded ${
                  partyFilter === "democrat" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                Democrat
              </button>
              <button
                onClick={() => setPartyFilter("republican")}
                className={`px-4 py-2 rounded ${
                  partyFilter === "republican" ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                Republican
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Politicians Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading politicians...</p>
        </div>
      ) : filteredPoliticians.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50">
          <p className="text-gray-500 dark:text-gray-400">No politicians found matching your filters.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPoliticians.map((politician) => (
            <Link
              key={politician.id}
              href={`/politicians/${politician.id}`}
              className="block bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 hover:shadow-lg dark:hover:shadow-slate-900 transition-shadow p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1 dark:text-slate-100">{politician.full_name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {politician.chamber === "house" ? "Representative" : "Senator"} •{" "}
                    {politician.state}
                    {politician.district ? ` District ${politician.district}` : ""}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPartyColor(politician.party)}`}>
                  {getPartyBadge(politician.party)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t dark:border-slate-700">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{politician.total_trades}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Trades</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{politician.recent_trades}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Last 90 Days</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ${(politician.total_holdings_value / 1000000).toFixed(1)}M
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Holdings</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      </div>
    </DashboardLayout>
  )
}

