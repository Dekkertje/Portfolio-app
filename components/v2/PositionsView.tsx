"use client"

import Link from "next/link"
import { displayName, PositionList } from "./PositionList"
import { Card, Delta, Initials, Private, SectionTitle, Skeleton } from "./ui"
import { eur } from "@/lib/format"
import type { PortfolioOverview } from "@/lib/portfolio/overview"

export function PositionsView({
  data,
  loading,
  error,
  children,
}: {
  data: PortfolioOverview | null
  loading: boolean
  error: string | null
  /** Extra secties onderaan, zoals de volglijst */
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-5 pt-6 lg:pt-10">
      <header className="px-1">
        <h1 className="text-[28px] font-semibold tracking-tight lg:text-[32px]">Posities</h1>
        {data && (
          <p className="text-[13px] text-muted">
            {data.positions.length} open · <Private>{eur(data.totals.securitiesEur, { decimals: 0 })}</Private>
          </p>
        )}
      </header>

      {loading && !data && <Skeleton className="h-96 rounded-3xl" />}
      {error && !data && <Card className="p-6 text-sm text-ink-2">{error}</Card>}

      {data && (
        <>
          <Card className="p-4 sm:p-6">
            <PositionList positions={data.positions} sortable />
          </Card>

          {data.closed.length > 0 && (
            <Card className="p-4 sm:p-6">
              <SectionTitle>Gesloten posities</SectionTitle>
              <ul className="divide-y divide-line">
                {data.closed.map((p) => (
                  <li key={p.instrumentId}>
                    <Link href={`/posities/${p.instrumentId}`} className="-mx-1 flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-surface-2/60 active:bg-surface-2">
                    <Initials name={displayName(p.name)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-ink">{displayName(p.name)}</p>
                      {p.dividendsEur !== 0 && (
                        <p className="text-[13px] text-muted">
                          incl. <Private>{eur(p.dividendsEur)}</Private> dividend
                        </p>
                      )}
                    </div>
                    <Delta value={p.realizedEur + p.dividendsEur} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
      {children}
    </div>
  )
}
