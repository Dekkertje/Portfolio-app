"use client"

import { PositionsView } from "@/components/v2/PositionsView"
import { usePortfolio } from "@/components/v2/usePortfolio"

export default function PositiesPage() {
  return <PositionsView {...usePortfolio()} />
}
