"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { authFetch } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/Toast"
import { Tag, Check, Trash2, ExternalLink } from "lucide-react"

type PendingMapping = {
  id: string
  isin: string
  product_name: string
  suggested_ticker: string
  yahoo_symbol: string
  confidence_score: number | null
  match_method: string | null
  created_at: string
}

function confidenceLabel(score: number | null) {
  if (score === null) return { label: "–", color: "text-slate-400" }
  if (score >= 0.95)  return { label: `${(score * 100).toFixed(0)}%`, color: "text-emerald-500" }
  if (score >= 0.80)  return { label: `${(score * 100).toFixed(0)}%`, color: "text-lime-500" }
  if (score >= 0.60)  return { label: `${(score * 100).toFixed(0)}%`, color: "text-amber-500" }
  return { label: `${(score * 100).toFixed(0)}%`, color: "text-red-500" }
}

function methodBadge(method: string | null) {
  const map: Record<string, string> = {
    manual_override:  "bg-violet-500/10 text-violet-400 border-violet-500/20",
    openfigi:         "bg-sky-500/10 text-sky-400 border-sky-500/20",
    isin_only:        "bg-lime-500/10 text-lime-500 border-lime-500/20",
    "isin+exchange":  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    name_fuzzy:       "bg-amber-500/10 text-amber-400 border-amber-500/20",
    no_match:         "bg-red-500/10 text-red-400 border-red-500/20",
  }
  const cls = (method && map[method]) ?? "bg-slate-500/10 text-slate-400 border-slate-500/20"
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{method ?? "–"}</span>
}

export default function TickersPage() {
  const [mappings, setMappings] = useState<PendingMapping[]>([])
  const [loading, setLoading]   = useState(true)
  const [editId, setEditId]     = useState<string | null>(null)
  const [editSymbol, setEditSymbol] = useState("")
  const { showToast } = useToast()

  async function loadMappings() {
    setLoading(true)
    try {
      const res  = await authFetch("/api/ticker-mapping?pending=1")
      const data = await res.json()
      setMappings(data.mappings ?? [])
    } catch {
      showToast("Fout bij laden", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMappings() }, [])

  async function approve(id: string, yahoo_symbol: string, suggested_ticker: string) {
    const res = await authFetch("/api/ticker-mapping", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, yahoo_symbol, suggested_ticker, approve: true }),
    })
    if (res.ok) {
      showToast("Ticker goedgekeurd", "success")
      setMappings(m => m.filter(x => x.id !== id))
      setEditId(null)
    } else {
      showToast("Fout bij goedkeuren", "error")
    }
  }

  async function reject(id: string) {
    const res = await authFetch("/api/ticker-mapping", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reject: true }),
    })
    if (res.ok) {
      showToast("Mapping verwijderd", "success")
      setMappings(m => m.filter(x => x.id !== id))
    } else {
      showToast("Fout bij verwijderen", "error")
    }
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0b1120] px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2">
              <Tag className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Ticker Review</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Controleer en keur automatisch gevonden ticker-koppelingen goed
              </p>
            </div>
          </div>
          {mappings.length > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-500 px-2 text-xs font-bold text-white">
              {mappings.length}
            </span>
          )}
        </div>
      </div>

      <div className="p-8">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#1a2744] border-t-amber-500" />
          </div>
        ) : mappings.length === 0 ? (
          <div className="rounded-xl bg-white dark:bg-[#0d1829] p-12 text-center shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80">
            <Check className="mx-auto h-10 w-10 text-emerald-500 mb-3" />
            <p className="font-semibold text-slate-900 dark:text-slate-100">Alles goedgekeurd</p>
            <p className="mt-1 text-sm text-slate-400">Geen ticker-koppelingen wachten op review</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Deze posities zijn automatisch gematcht maar wachten op bevestiging. Keur de ticker goed of pas hem aan voordat hij wordt gebruikt voor koersen.
            </p>
            {mappings.map((m) => {
              const conf = confidenceLabel(m.confidence_score)
              const isEditing = editId === m.id

              return (
                <div key={m.id} className="rounded-xl bg-white dark:bg-[#0d1829] px-5 py-4 shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {/* Left: position info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{m.product_name}</p>
                        {methodBadge(m.match_method)}
                        <span className={`text-xs font-semibold ${conf.color}`}>{conf.label}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">{m.isin}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <div className="text-sm">
                          <span className="text-slate-500 dark:text-slate-400">Ticker: </span>
                          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{m.suggested_ticker}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-slate-500 dark:text-slate-400">Yahoo: </span>
                          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{m.yahoo_symbol}</span>
                        </div>
                        <a
                          href={`https://finance.yahoo.com/quote/${encodeURIComponent(m.yahoo_symbol)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:underline"
                        >
                          Yahoo Finance <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>

                      {/* Edit symbol field */}
                      {isEditing && (
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="text"
                            value={editSymbol}
                            onChange={e => setEditSymbol(e.target.value)}
                            placeholder="bijv. ASML.AS"
                            className="rounded-lg border border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0b1120] px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 w-40 font-mono"
                          />
                          <button
                            onClick={() => approve(m.id, editSymbol, editSymbol.split(".")[0])}
                            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 transition-colors"
                          >
                            Opslaan
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            Annuleren
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Right: actions */}
                    <div className="flex shrink-0 items-center gap-2">
                      {!isEditing && (
                        <button
                          onClick={() => { setEditId(m.id); setEditSymbol(m.yahoo_symbol) }}
                          className="rounded-lg border border-slate-200 dark:border-[#1a2744] px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1a2744]/40 transition-colors"
                        >
                          Aanpassen
                        </button>
                      )}
                      <button
                        onClick={() => approve(m.id, m.yahoo_symbol, m.suggested_ticker)}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400 transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" /> Goedkeuren
                      </button>
                      <button
                        onClick={() => reject(m.id)}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Verwijder mapping"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
