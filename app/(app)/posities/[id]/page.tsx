"use client"

import { useParams } from "next/navigation"
import { PositionDetailView } from "@/components/v2/PositionDetailView"
import { useApi } from "@/components/v2/useApi"
import type { PositionDetail } from "@/lib/portfolio/position"

export default function PositieDetailPage() {
  const { id } = useParams<{ id: string }>()
  return <PositionDetailView {...useApi<PositionDetail>(`/api/v2/positions/${id}`, 60_000)} />
}
