"use client"

import Link from "next/link"
import { useState } from "react"
import { FileSpreadsheet, X } from "lucide-react"

const DISMISS_KEY = "account-statement-tip-dismissed"

/**
 * Tip voor wie alleen transacties heeft (geen rekeningoverzicht): zonder
 * stortingen, dividend en kosten is het rendement minder nauwkeurig.
 */
export function AccountStatementTip() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1"
    } catch {
      return false
    }
  })
  if (dismissed) return null

  return (
    <div className="flex items-start gap-3 rounded-3xl bg-surface p-4 ring-1 ring-line">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-wash text-accent">
        <FileSpreadsheet size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">Maak je rendement nauwkeuriger</p>
        <p className="mt-0.5 text-[13px] text-ink-2">
          Je hebt alleen je transacties geïmporteerd. Met je DEGIRO-rekeningoverzicht erbij komen ook stortingen, dividend en kosten in beeld.
        </p>
        <Link href="/importeren" className="mt-2 inline-flex rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-surface">
          Rekeningoverzicht importeren
        </Link>
      </div>
      <button
        aria-label="Sluiten"
        onClick={() => {
          setDismissed(true)
          try {
            localStorage.setItem(DISMISS_KEY, "1")
          } catch {}
        }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
      >
        <X size={16} />
      </button>
    </div>
  )
}
