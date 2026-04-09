"use client"

import { useState } from "react"
import { X, Search } from "lucide-react"
import { Button } from "@/components/ui/Button"

type TickerEditModalProps = {
  isOpen: boolean
  onClose: () => void
  isin: string
  product: string
  currentTicker: string | null
  onSave: (yahooSymbol: string) => void
}

export function TickerEditModal({
  isOpen,
  onClose,
  isin,
  product,
  currentTicker,
  onSave,
}: TickerEditModalProps) {
  const [yahooSymbol, setYahooSymbol] = useState(currentTicker || "")
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])

  if (!isOpen) return null

  async function handleSearch() {
    setSearching(true)
    try {
      const res = await fetch(`/api/yahoo-search?q=${encodeURIComponent(product)}`)
      const data = await res.json()
      setSearchResults(data.results || [])
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setSearching(false)
    }
  }

  function handleSave() {
    if (!yahooSymbol.trim()) return
    onSave(yahooSymbol.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Ticker Aanpassen
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {product}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              ISIN: {isin}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Manual Input */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Yahoo Finance Symbol
          </label>
          <input
            type="text"
            value={yahooSymbol}
            onChange={(e) => setYahooSymbol(e.target.value)}
            placeholder="Bijv: ASML.AS, AAPL, VOO"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
            Tip: Gebruik .AS voor Amsterdam, .L voor London, geen suffix voor US stocks
          </p>
        </div>

        {/* Search Yahoo Finance */}
        <div className="mb-6">
          <Button
            onClick={handleSearch}
            disabled={searching}
            variant="secondary"
            className="w-full gap-2"
          >
            <Search className="h-4 w-4" />
            {searching ? "Zoeken..." : "Zoek op Yahoo Finance"}
          </Button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-6 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Zoekresultaten:
            </div>
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => setYahooSymbol(result.symbol)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-left hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
              >
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {result.symbol}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {result.name}
                </div>
                {result.exchange && (
                  <div className="text-xs text-slate-500 dark:text-slate-500">
                    {result.exchange}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={!yahooSymbol.trim()}>
            Opslaan
          </Button>
        </div>
      </div>
    </div>
  )
}
