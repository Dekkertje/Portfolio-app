"use client"

import { useState } from "react"
import { X, Search, Plus } from "lucide-react"
import { Button } from "@/components/ui/Button"

type YahooSearchResult = {
  symbol: string
  name: string
  exchange: string
  type: string
}

type AddManualPositionModalProps = {
  isOpen: boolean
  onClose: () => void
  portfolioId: string
  onSuccess: () => void
}

export function AddManualPositionModal({ isOpen, onClose, portfolioId, onSuccess }: AddManualPositionModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<YahooSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedStock, setSelectedStock] = useState<YahooSearchResult | null>(null)
  
  // Form fields
  const [quantity, setQuantity] = useState("")
  const [averagePrice, setAveragePrice] = useState("")
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setSearching(true)
    try {
      const res = await fetch(`/api/search-yahoo?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      
      if (data.results) {
        setSearchResults(data.results)
      }
    } catch (error) {
      console.error("Search failed:", error)
    } finally {
      setSearching(false)
    }
  }

  const handleSave = async () => {
    if (!selectedStock || !quantity || !averagePrice) return
    
    setSaving(true)
    try {
      const res = await fetch("/api/manual-positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolio_id: portfolioId,
          yahoo_symbol: selectedStock.symbol,
          product_name: selectedStock.name,
          quantity: parseFloat(quantity),
          average_price: parseFloat(averagePrice),
          purchase_date: purchaseDate,
          notes,
        }),
      })
      
      if (res.ok) {
        onSuccess()
        handleClose()
      }
    } catch (error) {
      console.error("Failed to save position:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setSearchQuery("")
    setSearchResults([])
    setSelectedStock(null)
    setQuantity("")
    setAveragePrice("")
    setNotes("")
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Handmatig Aandeel Toevoegen
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        {!selectedStock && (
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Zoek aandeel op Yahoo Finance
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Bijv. AAPL, TSLA, ASML..."
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-slate-900 dark:text-slate-100"
              />
              <Button onClick={handleSearch} disabled={searching}>
                <Search className="h-4 w-4" />
                {searching ? "Zoeken..." : "Zoek"}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                {searchResults.map((result) => (
                  <button
                    key={result.symbol}
                    onClick={() => setSelectedStock(result)}
                    className="w-full border-b border-slate-200 dark:border-slate-700 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 last:border-b-0"
                  >
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {result.symbol}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {result.name} • {result.exchange}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Form */}
        {selectedStock && (
          <div className="space-y-4">
            {/* Selected Stock */}
            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-indigo-900 dark:text-indigo-100">
                    {selectedStock.symbol}
                  </div>
                  <div className="text-sm text-indigo-700 dark:text-indigo-300">
                    {selectedStock.name}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStock(null)}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200"
                >
                  Wijzig
                </button>
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Aantal Aandelen
              </label>
              <input
                type="number"
                step="0.0001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Average Price */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Gemiddelde Prijs (EUR)
              </label>
              <input
                type="number"
                step="0.01"
                value={averagePrice}
                onChange={(e) => setAveragePrice(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Purchase Date */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Aankoopdatum
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Notities (optioneel)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Annuleren
              </Button>
              <Button onClick={handleSave} disabled={saving || !quantity || !averagePrice}>
                <Plus className="h-4 w-4 mr-2" />
                {saving ? "Opslaan..." : "Toevoegen"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
