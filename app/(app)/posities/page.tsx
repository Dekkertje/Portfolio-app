"use client"

import { PositionsView } from "@/components/v2/PositionsView"
import { usePortfolio } from "@/components/v2/usePortfolio"
import { Watchlist } from "@/components/v2/Watchlist"

export default function PositiesPage() {
  return (
    <PositionsView {...usePortfolio()}>
      <Watchlist />
    </PositionsView>
  )
}
