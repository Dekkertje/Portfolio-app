"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import Link from "next/link"
import { Bell, BellOff } from "lucide-react"

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

function partyColor(party: string) {
  if (party === "democrat")   return "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20"
  if (party === "republican") return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20"
  return "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20"
}

export default function PoliticiansPage() {
  const [politicians, setPoliticians] = useState<PoliticianWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "following" | "house" | "senate">("all")
  const [partyFilter, setPartyFilter] = useState<"all" | "democrat" | "republican" | "independent">("all")
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setUserId(session.user.id)

      // Load followed politicians
      const { data: follows } = await supabase
        .from("politician_follows")
        .select("politician_id")
        .eq("user_id", session.user.id)
      if (follows) setFollowing(new Set(follows.map(f => f.politician_id)))
    }
    init()
    fetchPoliticians()
  }, [])

  async function fetchPoliticians() {
    setLoading(true)
    try {
      const { data: politiciansData, error } = await supabase.from("politicians").select("*")
      if (error) throw error

      const politiciansWithStats = await Promise.all(
        (politiciansData || []).map(async (politician) => {
          const { count: totalTrades } = await supabase
            .from("politician_trades").select("*", { count: "exact", head: true })
            .eq("politician_id", politician.id)

          const { count: recentTrades } = await supabase
            .from("politician_trades").select("*", { count: "exact", head: true })
            .eq("politician_id", politician.id)
            .gte("transaction_date", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

          const { data: holdings } = await supabase
            .from("politician_holdings").select("total_value")
            .eq("politician_id", politician.id)

          return {
            ...politician,
            total_trades: totalTrades || 0,
            recent_trades: recentTrades || 0,
            total_holdings_value: holdings?.reduce((s, h) => s + (Number(h.total_value) || 0), 0) || 0,
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

  async function toggleFollow(e: React.MouseEvent, politicianId: string) {
    e.preventDefault()
    if (!userId) return
    const isFollowing = following.has(politicianId)

    if (isFollowing) {
      await supabase.from("politician_follows").delete()
        .eq("user_id", userId).eq("politician_id", politicianId)
      setFollowing(prev => { const s = new Set(prev); s.delete(politicianId); return s })
    } else {
      await supabase.from("politician_follows").insert({ user_id: userId, politician_id: politicianId })
      setFollowing(prev => new Set(prev).add(politicianId))
    }
  }

  const filteredPoliticians = politicians.filter((p) => {
    if (filter === "following" && !following.has(p.id)) return false
    if (filter === "house"     && p.chamber !== "house")    return false
    if (filter === "senate"    && p.chamber !== "senate")   return false
    if (partyFilter !== "all"  && p.party !== partyFilter)  return false
    return true
  })

  const filterBtn = (value: typeof filter, label: string) => (
    <button
      onClick={() => setFilter(value)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        filter === value
          ? "bg-lime-500 text-white"
          : "bg-slate-100 dark:bg-[#1a2744] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1a2744]/80"
      }`}
    >
      {label}
      {value === "following" && following.size > 0 && (
        <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white/30 px-1 text-xs font-bold">{following.size}</span>
      )}
    </button>
  )

  const partyBtn = (value: typeof partyFilter, label: string) => (
    <button
      onClick={() => setPartyFilter(value)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        partyFilter === value
          ? "bg-lime-500 text-white"
          : "bg-slate-100 dark:bg-[#1a2744] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1a2744]/80"
      }`}
    >
      {label}
    </button>
  )

  return (
    <DashboardLayout>
      <div className="border-b border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0b1120] px-8 py-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Congressional Trading Tracker</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Volg aandelenhandelingen van Congresdeden onder de STOCK Act
        </p>
      </div>

      <div className="p-8 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-6 rounded-xl bg-white dark:bg-[#0d1829] p-4 shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Weergave</p>
            <div className="flex gap-2">
              {filterBtn("all",       "Alle")}
              {filterBtn("following", "Gevolgd")}
              {filterBtn("house",     "House")}
              {filterBtn("senate",    "Senate")}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Partij</p>
            <div className="flex gap-2">
              {partyBtn("all",        "Alle")}
              {partyBtn("democrat",   "Democrat")}
              {partyBtn("republican", "Republican")}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a2744] border-t-lime-500" />
          </div>
        ) : filteredPoliticians.length === 0 ? (
          <div className="rounded-xl bg-white dark:bg-[#0d1829] p-12 text-center shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80">
            <p className="text-slate-500 dark:text-slate-400">
              {filter === "following" ? "Je volgt nog niemand — klik op de bel om iemand te volgen" : "Geen resultaten"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPoliticians.map((politician) => {
              const isFollowed = following.has(politician.id)
              return (
                <Link
                  key={politician.id}
                  href={`/politicians/${politician.id}`}
                  className="group relative block rounded-xl bg-white dark:bg-[#0d1829] p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80 hover:ring-slate-200 dark:hover:ring-[#2a3a5e] transition-all"
                >
                  {/* Follow button */}
                  <button
                    onClick={(e) => toggleFollow(e, politician.id)}
                    title={isFollowed ? "Ontvolgen" : "Volgen"}
                    className={`absolute right-4 top-4 rounded-lg p-1.5 transition-colors ${
                      isFollowed
                        ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                        : "text-slate-300 dark:text-slate-600 hover:text-amber-500 hover:bg-amber-500/10"
                    }`}
                  >
                    {isFollowed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  </button>

                  <div className="pr-8">
                    <div className="flex items-start gap-2 mb-1">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100">{politician.full_name}</h3>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {politician.chamber === "house" ? "Representative" : "Senator"} · {politician.state}
                      {politician.district ? ` D${politician.district}` : ""}
                    </p>
                    <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${partyColor(politician.party)}`}>
                      {politician.party.charAt(0).toUpperCase() + politician.party.slice(1)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 dark:border-[#1a2744] pt-4">
                    <div>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{politician.total_trades}</p>
                      <p className="text-xs text-slate-400">Trades</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{politician.recent_trades}</p>
                      <p className="text-xs text-slate-400">90 dagen</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        ${(politician.total_holdings_value / 1_000_000).toFixed(1)}M
                      </p>
                      <p className="text-xs text-slate-400">Holdings</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
