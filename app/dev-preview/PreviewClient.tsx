"use client"

import { AppShell } from "@/components/v2/AppShell"
import { OverviewView } from "@/components/v2/OverviewView"
import { PositionsView } from "@/components/v2/PositionsView"
import type { PortfolioOverview } from "@/lib/portfolio/overview"

export function PreviewClient({ data, page }: { data: PortfolioOverview; page: string }) {
  return (
    <AppShell requireAuth={false}>
      {page === "posities" ? (
        <PositionsView data={data} loading={false} error={null} />
      ) : (
        <OverviewView data={data} empty={false} error={null} loading={false} refreshing={false} refresh={() => {}} />
      )}
    </AppShell>
  )
}
