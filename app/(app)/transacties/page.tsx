"use client"

import type { TransactionsResponse } from "@/app/api/v2/transactions/route"
import { TransactionsView } from "@/components/v2/TransactionsView"
import { useApi } from "@/components/v2/useApi"
import { invalidatePortfolio } from "@/components/v2/usePortfolio"
import { authFetch } from "@/lib/supabase/client"

export default function TransactiesPage() {
  const state = useApi<TransactionsResponse>("/api/v2/transactions")
  const changed = () => {
    state.refresh()
    invalidatePortfolio()
  }
  return (
    <TransactionsView
      {...state}
      onChanged={changed}
      onDelete={async (id) => {
        const res = await authFetch(`/api/v2/ledger?id=${encodeURIComponent(id)}`, { method: "DELETE" })
        if (res.ok) changed()
      }}
    />
  )
}
