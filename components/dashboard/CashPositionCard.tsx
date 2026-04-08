"use client"

import { DollarSign, Edit2, Trash2 } from "lucide-react"
import { PrivacyText } from "@/components/ui/PrivacyText"
import { Button } from "@/components/ui/Button"

type CashPosition = {
  id: string
  currency: string
  amount: number
  description?: string
}

type CashPositionCardProps = {
  positions: CashPosition[]
  onEdit: (position: CashPosition) => void
  onDelete: (id: string) => void
}

export function CashPositionCard({ positions, onEdit, onDelete }: CashPositionCardProps) {
  if (positions.length === 0) return null

  const totalEUR = positions.reduce((sum, p) => {
    // Simple conversion - in production you'd fetch real rates
    const rate = p.currency === "USD" ? 0.92 : p.currency === "GBP" ? 1.17 : 1
    return sum + (p.amount * rate)
  }, 0)

  return (
    <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white/20 p-2">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Cash Posities</h3>
            <p className="text-sm text-green-100">{positions.length} valuta{positions.length > 1 ? "'s" : ""}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-green-100">Totaal (EUR)</p>
          <p className="text-2xl font-bold text-white">
            <PrivacyText>€{totalEUR.toLocaleString()}</PrivacyText>
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {positions.map((position) => (
          <div
            key={position.id}
            className="flex items-center justify-between rounded-lg bg-white/10 p-3 backdrop-blur"
          >
            <div>
              <div className="font-medium text-white">
                {position.currency}
              </div>
              {position.description && (
                <div className="text-xs text-green-100">{position.description}</div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-semibold text-white">
                  <PrivacyText>
                    {position.currency === "EUR" ? "€" : position.currency === "USD" ? "$" : "£"}
                    {position.amount.toLocaleString()}
                  </PrivacyText>
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => onEdit(position)}
                  className="rounded p-1 hover:bg-white/20"
                >
                  <Edit2 className="h-4 w-4 text-white" />
                </button>
                <button
                  onClick={() => onDelete(position.id)}
                  className="rounded p-1 hover:bg-white/20"
                >
                  <Trash2 className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
