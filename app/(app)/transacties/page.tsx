"use client"

import type { TransactionsResponse } from "@/app/api/v2/transactions/route"
import { TransactionsView } from "@/components/v2/TransactionsView"
import { useApi } from "@/components/v2/useApi"

export default function TransactiesPage() {
  return <TransactionsView {...useApi<TransactionsResponse>("/api/v2/transactions")} />
}
