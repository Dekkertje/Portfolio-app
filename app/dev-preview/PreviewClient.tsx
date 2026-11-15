"use client"

import { AppShell } from "@/components/v2/AppShell"
import { DividendsView } from "@/components/v2/DividendsView"
import { ImportView } from "@/components/v2/ImportView"
import { NotificationsView } from "@/components/v2/NotificationsView"
import { TransactionsView } from "@/components/v2/TransactionsView"
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

const noopNotifications = { create: async () => {}, toggle: async () => {}, remove: async () => {} }

export function PreviewClient({
  data,
  page,
  importPreview,
  extra,
}: {
  data: PortfolioOverview
  page: string
  importPreview: ImportPreview | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra: any
}) {
  const base = { loading: false, error: null, empty: false }
  return (
    <AppShell requireAuth={false}>
      {page === "dividend" ? (
        <DividendsView data={extra} {...base} />
      ) : page === "transacties" ? (
        <TransactionsView data={extra} {...base} />
      ) : page === "notificaties" ? (
        <NotificationsView data={extra} {...base} refresh={() => {}} api={noopNotifications} />
      ) : page === "importeren" && importPreview ? (
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
