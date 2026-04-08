"use client"

import { useState, useEffect } from "react"
import { X, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/Button"

type CashPositionModalProps = {
  isOpen: boolean
  onClose: () => void
  portfolioId: string
  onSuccess: () => void
}

export function CashPositionModal({ isOpen, onClose, portfolioId, onSuccess }: CashPositionModalProps) {
  const [currency, setCurrency] = useState("EUR")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!amount) return
    
    setSaving(true)
    try {
      const res = await fetch("/api/cash-positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolio_id: portfolioId,
          currency,
          amount: parseFloat(amount),
          description,
        }),
      })
      
      if (res.ok) {
        onSuccess()
        handleClose()
      }
    } catch (error) {
      console.error("Failed to save cash position:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setAmount("")
    setDescription("")
    setCurrency("EUR")
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Cash Positie Toevoegen
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Currency */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Valuta
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-slate-900 dark:text-slate-100"
            >
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Bedrag
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Beschrijving (optioneel)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bijv. Spaarrekening, Broker cash..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={handleClose}>
              Annuleren
            </Button>
            <Button onClick={handleSave} disabled={saving || !amount}>
              <DollarSign className="mr-2 h-4 w-4" />
              {saving ? "Opslaan..." : "Opslaan"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
