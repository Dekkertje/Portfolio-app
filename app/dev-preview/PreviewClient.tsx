"use client"

import { AppShell } from "@/components/v2/AppShell"
import { ImportView } from "@/components/v2/ImportView"
import { OverviewView } from "@/components/v2/OverviewView"
import type { ImportPreview } from "@/lib/import/preview"
import { PositionsView } from "@/components/v2/PositionsView"
import type { PortfolioOverview } from "@/lib/portfolio/overview"

const fakeApi = {
  preview: async () => {
    throw new Error("preview")
  },
  commit: async () => {
    throw new Error("preview")
  },
  history: async () => [
    { id: "1", source: "degiro", file_names: ["Transactions.csv", "Account.csv"], event_count: 273, inserted_count: 273, created_at: "2026-11-15T13:19:03Z" },
    { id: "2", source: "migration", file_names: [], event_count: 98, inserted_count: 98, created_at: "2026-11-15T13:20:00Z" },
  ],
}

export function PreviewClient({ data, page, importPreview }: { data: PortfolioOverview; page: string; importPreview: ImportPreview | null }) {
  return (
    <AppShell requireAuth={false}>
      {page === "importeren" && importPreview ? (
        <ImportView
          api={fakeApi}
          initial={{ files: { transactions: { name: "Transactions.csv", text: "" }, account: { name: "Account.csv", text: "" } }, preview: importPreview }}
        />
      ) : page === "posities" ? (
        <PositionsView data={data} loading={false} error={null} />
      ) : (
        <OverviewView data={data} empty={false} error={null} loading={false} refreshing={false} refresh={() => {}} />
      )}
    </AppShell>
  )
}
