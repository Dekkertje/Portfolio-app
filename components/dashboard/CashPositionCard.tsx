"use client"

import { Wallet, Edit2, Trash2 } from "lucide-react"
import { PrivacyText } from "@/components/ui/PrivacyText"

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
    const rate = p.currency === "USD" ? 0.92 : p.currency === "GBP" ? 1.17 : 1
    return sum + (p.amount * rate)
  }, 0)

  return (
    <div className="rounded-xl bg-white dark:bg-[#0d1829] ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80 px-4 py-3 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <Wallet className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">Cash</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap flex-1">
        {positions.map((position) => (
          <div key={position.id} className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-[#0b1120] border border-slate-200 dark:border-[#1a2744] px-3 py-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{position.currency}</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              <PrivacyText>
                {position.currency === "EUR" ? "€" : position.currency === "USD" ? "$" : "£"}
                {position.amount.toLocaleString()}
              </PrivacyText>
            </span>
            {position.description && (
              <span className="text-xs text-slate-400 dark:text-slate-500">{position.description}</span>
            )}
            <div className="flex gap-0.5 ml-1">
              <button onClick={() => onEdit(position)} className="rounded p-0.5 hover:bg-slate-200 dark:hover:bg-[#1a2744] transition-colors">
                <Edit2 className="h-3 w-3 text-slate-400" />
              </button>
              <button onClick={() => onDelete(position.id)} className="rounded p-0.5 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                <Trash2 className="h-3 w-3 text-slate-400 hover:text-red-500" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="text-right shrink-0">
        <span className="text-xs text-slate-400 dark:text-slate-500 mr-1">Totaal</span>
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
          <PrivacyText>€{totalEUR.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}</PrivacyText>
        </span>
      </div>
    </div>
  )
}
