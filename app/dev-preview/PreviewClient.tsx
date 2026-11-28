"use client"

import { AppShell } from "@/components/v2/AppShell"
import { DividendsView } from "@/components/v2/DividendsView"
import { ImportView } from "@/components/v2/ImportView"
import { NotificationsView } from "@/components/v2/NotificationsView"
import { PositionDetailView } from "@/components/v2/PositionDetailView"
import { SettingsView } from "@/components/v2/SettingsView"
import { TransactionsView } from "@/components/v2/TransactionsView"
import { OverviewView } from "@/components/v2/OverviewView"
import type { ImportPreview } from "@/lib/import/preview"
import { PositionsView } from "@/components/v2/PositionsView"
import type { PortfolioOverview } from "@/lib/portfolio/overview"
import { compareWithBenchmark } from "@/lib/portfolio/compare"
import { ReturnChart } from "@/components/v2/ReturnChart"
import { Card } from "@/components/v2/ui"
import { YearsView } from "@/components/v2/YearsView"
import { AddTransactionSheet } from "@/components/v2/AddTransaction"
import { Onboarding } from "@/components/v2/Onboarding"

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

/** Vergelijkingsgrafiek met echte MSCI World-koersen (de echte kaart haalt die op via een ingelogde API). */
function ComparePreview({ series, closes }: { series: PortfolioOverview["series"]; closes: [string, number][] }) {
  const from = series.findIndex((p) => p.d >= "2025-11-14")
  const points = compareWithBenchmark(series.slice(Math.max(0, from - 1)), closes)
  return (
    <div className="pt-10">
      <Card className="p-4 sm:p-6">
        <ReturnChart points={points} benchLabel="MSCI World" />
      </Card>
    </div>
  )
}

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
      {page.startsWith("rondleiding") ? (
        <Onboarding preview={{ step: Number(page.split("-")[1] ?? 0), hasData: false }} />
      ) : page === "toevoegen" ? (
        <AddTransactionSheet onClose={() => {}} onSaved={() => {}} />
      ) : page === "jaaroverzicht" ? (
        <YearsView data={data} loading={false} error={null} />
      ) : page === "vergelijk" ? (
        <ComparePreview series={data.series} closes={extra} />
      ) : page === "detail" ? (
        <PositionDetailView data={extra} loading={false} error={null} />
      ) : page === "instellingen" ? (
        <SettingsView />
      ) : page === "dividend" ? (
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
