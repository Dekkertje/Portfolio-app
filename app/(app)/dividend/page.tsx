"use client"

import type { DividendsResponse } from "@/app/api/v2/dividends/route"
import { DividendsView } from "@/components/v2/DividendsView"
import { useApi } from "@/components/v2/useApi"

export default function DividendPage() {
  return <DividendsView {...useApi<DividendsResponse>("/api/v2/dividends")} />
}
