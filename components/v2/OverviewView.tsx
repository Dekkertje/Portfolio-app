"use client"

import Link from "next/link"
import { ChevronRight, RefreshCw, Upload } from "lucide-react"
import { Allocation } from "./Allocation"
import { PerformanceCard } from "./PerformanceCard"
import { PositionList } from "./PositionList"
import { Amount, Card, Delta, Private, SectionTitle, Skeleton } from "./ui"
import { eur, pct, timeAgo } from "@/lib/format"
import type { PortfolioOverview } from "@/lib/portfolio/overview"

export type OverviewViewProps = {
  data: PortfolioOverview | null
  empty: boolean
  error: string | null
  loading: boolean
  refreshing: boolean
  refresh: () => void
}

export function OverviewView({ data, empty, error, loading, refreshing, refresh }: OverviewViewProps) {

  return (
    <div className="flex flex-col gap-5 pt-6 lg:pt-10">
      <header className="flex items-center justify-between gap-3 px-1">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight lg:text-[32px]">Overzicht</h1>
          {data?.asOf && <p className="text-[13px] text-muted">Koersen van {timeAgo(data.asOf)}</p>}
        </div>
        <button
          onClick={refresh}
          disabled={refreshing || loading}
          aria-label="Verversen"
          className="grid h-10 w-10 place-items-center rounded-full bg-surface text-ink-2 ring-1 ring-line transition hover:text-ink disabled:opacity-60"
        >
          <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
        </button>
      </header>

      {error && !data && <ErrorCard message={error} onRetry={refresh} />}
      {empty && <EmptyState />}
      {loading && !data && !empty && <LoadingState />}

      {data && (
        <div className={`flex flex-col gap-5 transition-opacity ${refreshing ? "opacity-70" : ""}`}>
          <Hero data={data} />

          <Stats data={data} />
          <PerformanceCard series={data.series} />

          <div className="grid gap-5 lg:grid-cols-[1fr_340px] [&>*]:min-w-0">
            <Card className="p-4 sm:p-6">
              <SectionTitle
                action={
                  <Link href="/posities" className="flex items-center text-[13px] font-medium text-ink-2 hover:text-ink">
                    Alle {data.positions.length}
                    <ChevronRight size={16} />
                  </Link>
                }
              >
                Posities
              </SectionTitle>
              <PositionList positions={data.positions} limit={6} compact />
            </Card>
            <Card className="p-4 sm:p-6">
              <SectionTitle>Verdeling</SectionTitle>
              <Allocation positions={data.positions} />
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function Hero({ data }: { data: PortfolioOverview }) {
  const t = data.totals
  const totalReturnPct = t.netDepositsEur > 0 ? t.totalReturnEur / t.netDepositsEur : null
  return (
    <section
      className="relative overflow-hidden rounded-[28px] bg-surface p-5 ring-1 ring-line sm:p-7"
      style={{ backgroundImage: "radial-gradient(90% 140% at 100% 0%, var(--accent-wash), transparent 60%)" }}
    >
      <p className="text-[13px] font-medium text-ink-2">Totale waarde</p>
      <Private className="mt-1 block text-[44px] font-semibold leading-none tracking-tight text-ink sm:text-[56px]">
        {eur(t.valueEur)}
      </Private>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2">
          <Delta value={t.dayChangeEur} percent={t.dayChangePct} variant="pill" size="sm" />
          <span className="text-[13px] text-muted">{dayLabel(data.asOf)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Delta value={t.totalReturnEur} percent={totalReturnPct} size="sm" />
          <span className="text-[13px] text-muted">totaal</span>
        </div>
      </div>
    </section>
  )
}

function dayLabel(asOf: string | null): string {
  if (!asOf) return "vandaag"
  const d = new Date(asOf)
  return d.toDateString() === new Date().toDateString() ? "vandaag" : d.toLocaleDateString("nl-NL", { weekday: "long" })
}

function Stats({ data }: { data: PortfolioOverview }) {
  const t = data.totals
  const tiles = [
    { label: "Ongerealiseerd", value: t.unrealizedEur, sub: t.costEur > 0 ? pct(t.unrealizedEur / t.costEur, { sign: true }) : null, tone: true },
    { label: "Gerealiseerd", value: t.realizedEur, sub: "verkochte posities", tone: true },
    { label: "Dividend", value: t.dividendsEur, sub: "netto ontvangen", tone: false },
    { label: data.tracksCash ? "Netto inleg" : "Geïnvesteerd", value: t.netDepositsEur, sub: data.tracksCash ? `cash ${eur(t.cashEur)}` : null, tone: false },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {tiles.map((s) => (
        <Card key={s.label} className="p-4">
          <p className="text-[13px] text-ink-2">{s.label}</p>
          <Amount
            value={s.value}
            decimals={0}
            className={`mt-1 block text-xl font-semibold tracking-tight ${s.tone ? (s.value >= 0 ? "text-up" : "text-down") : "text-ink"}`}
          />
          {s.sub && <p className="mt-0.5 truncate text-xs text-muted"><Private>{s.sub}</Private></p>}
        </Card>
      ))}
      <Card className="col-span-2 p-4 lg:col-span-1">
        <p className="text-[13px] text-ink-2">Jaarrendement</p>
        <p className={`mt-1 text-xl font-semibold tracking-tight ${(t.xirr ?? 0) >= 0 ? "text-up" : "text-down"}`}>
          {t.xirr == null ? "—" : pct(t.xirr, { sign: true })}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">per jaar (XIRR)</p>
      </Card>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Laden">
      <Skeleton className="h-44 rounded-[28px]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className={`h-24 ${i === 4 ? "col-span-2 lg:col-span-1" : ""}`} />)}
      </div>
      <Skeleton className="h-96 rounded-3xl" />
    </div>
  )
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent-wash text-accent">
        <Upload size={24} />
      </div>
      <h2 className="text-lg font-semibold">Nog geen transacties</h2>
      <p className="mt-1 max-w-sm text-sm text-ink-2">
        Importeer je DEGIRO-export (Transacties en Rekeningoverzicht) om je portfolio te zien.
      </p>
      <Link href="/import" className="mt-6 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-surface">
        Importeren
      </Link>
    </Card>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="p-6">
      <p className="font-medium text-ink">Het overzicht kon niet geladen worden</p>
      <p className="mt-1 text-sm text-ink-2">{message}</p>
      <button onClick={onRetry} className="mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-surface">
        Opnieuw proberen
      </button>
    </Card>
  )
}
