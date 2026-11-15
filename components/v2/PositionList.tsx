"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import { money, pct, quantity } from "@/lib/format"
import type { OverviewPosition } from "@/lib/portfolio/overview"
import { displayName } from "@/lib/names"
import { Amount, Delta, Initials, Private, Segmented } from "./ui"

export { displayName }

export type PositionMetric = "day" | "total"
type SortKey = "value" | "name" | "day" | "total" | "weight"

const SORTS: Record<SortKey, (a: OverviewPosition, b: OverviewPosition) => number> = {
  value: (a, b) => b.valueEur - a.valueEur,
  weight: (a, b) => b.weight - a.weight,
  name: (a, b) => a.name.localeCompare(b.name, "nl"),
  day: (a, b) => (b.dayChangePct ?? -Infinity) - (a.dayChangePct ?? -Infinity),
  total: (a, b) => (b.unrealizedPct ?? -Infinity) - (a.unrealizedPct ?? -Infinity),
}

/**
 * Posities als kaarten (telefoon) of tabel (desktop).
 * `limit` voor een preview op het overzicht.
 */
export function PositionList({
  positions,
  limit,
  sortable = false,
  compact = false,
}: {
  positions: OverviewPosition[]
  limit?: number
  sortable?: boolean
  /** Minder kolommen, voor een smalle kaart */
  compact?: boolean
}) {
  const router = useRouter()
  const [metric, setMetric] = useState<PositionMetric>("day")
  const [sort, setSort] = useState<SortKey>("value")

  const rows = useMemo(() => {
    const sorted = [...positions].sort(SORTS[sort])
    return limit ? sorted.slice(0, limit) : sorted
  }, [positions, sort, limit])

  return (
    <div>
      {/* Telefoon */}
      <div className="lg:hidden">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <Segmented
            label="Toon resultaat"
            value={metric}
            onChange={setMetric}
            options={[
              { value: "day", label: "Vandaag" },
              { value: "total", label: "Totaal" },
            ]}
          />
          {sortable && (
            <label className="relative flex items-center text-[13px] font-medium text-ink-2">
              <span className="sr-only">Sorteren op</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-8 appearance-none rounded-full bg-surface-2 pl-3 pr-8 text-[13px] font-medium text-ink outline-none"
              >
                <option value="value">Waarde</option>
                <option value="day">Vandaag</option>
                <option value="total">Rendement</option>
                <option value="name">Naam</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3" />
            </label>
          )}
        </div>
        <ul className="divide-y divide-line">
          {rows.map((p) => (
            <li key={p.instrumentId}>
              <Link href={`/posities/${p.instrumentId}`} className="-mx-1 flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors active:bg-surface-2">
              <Initials name={displayName(p.name)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-ink">{displayName(p.name)}</p>
                <p className="truncate text-[13px] text-muted">
                  {quantity(p.quantity)} × {p.price != null && p.currency ? money(p.price, p.currency) : "—"}
                </p>
              </div>
              <div className="text-right">
                <Amount value={p.valueEur} className="block text-[15px] font-semibold text-ink" />
                {metric === "day" ? (
                  p.dayChangePct != null ? <Delta percent={p.dayChangePct} size="xs" /> : <span className="text-xs text-muted">—</span>
                ) : (
                  <Delta percent={p.unrealizedPct} size="xs" />
                )}
              </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-left text-sm [&_td:last-child]:pr-0 [&_th:last-child]:pr-0" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <Th label="Naam" k="name" sort={sort} onSort={sortable ? setSort : undefined} align="left" />
              {!compact && <th className="py-2.5 pr-4 text-right font-medium">Aantal</th>}
              {!compact && <th className="py-2.5 pr-4 text-right font-medium">Koers</th>}
              <Th label="Waarde" k="value" sort={sort} onSort={sortable ? setSort : undefined} />
              <Th label="Vandaag" k="day" sort={sort} onSort={sortable ? setSort : undefined} />
              <Th label={compact ? "Totaal" : "Ongerealiseerd"} k="total" sort={sort} onSort={sortable ? setSort : undefined} />
              {!compact && <Th label="Gewicht" k="weight" sort={sort} onSort={sortable ? setSort : undefined} />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr
                key={p.instrumentId}
                onClick={() => router.push(`/posities/${p.instrumentId}`)}
                className="cursor-pointer transition-colors hover:bg-surface-2/60"
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <Initials name={displayName(p.name)} />
                    <div className="min-w-0">
                      <Link href={`/posities/${p.instrumentId}`} onClick={(e) => e.stopPropagation()} className={`block truncate font-medium text-ink hover:underline ${compact ? "max-w-[9rem] 2xl:max-w-[15rem]" : "max-w-[12rem] 2xl:max-w-[18rem]"}`}>{displayName(p.name)}</Link>
                      <p className="text-xs text-muted">
                        {compact ? `${quantity(p.quantity)} × ${p.price != null && p.currency ? money(p.price, p.currency) : "—"}` : (p.symbol ?? p.isin)}
                      </p>
                    </div>
                  </div>
                </td>
                {!compact && (
                  <td className="py-3 pr-4 text-right text-ink-2">
                    <Private>{quantity(p.quantity)}</Private>
                  </td>
                )}
                {!compact && <td className="py-3 pr-4 text-right text-ink-2">{p.price != null && p.currency ? money(p.price, p.currency) : "—"}</td>}
                <td className="py-3 pr-4 text-right font-semibold text-ink">
                  <Amount value={p.valueEur} />
                </td>
                <td className="py-3 pr-4 text-right">
                  {p.dayChangePct != null ? <Delta value={compact ? undefined : p.dayChangeEur} percent={p.dayChangePct} size="xs" /> : <span className="text-muted">—</span>}
                </td>
                <td className="py-3 pr-4 text-right">
                  <Delta value={compact ? undefined : p.unrealizedEur} percent={p.unrealizedPct} size="xs" />
                </td>
                {!compact && <td className="py-3 text-right text-ink-2">{pct(p.weight)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({
  label,
  k,
  sort,
  onSort,
  align = "right",
}: {
  label: string
  k: SortKey
  sort: SortKey
  onSort?: (k: SortKey) => void
  align?: "left" | "right"
}) {
  const cls = `py-2.5 pr-4 font-medium ${align === "right" ? "text-right" : "text-left"}`
  if (!onSort) return <th className={cls}>{label}</th>
  return (
    <th className={cls} aria-sort={sort === k ? "descending" : "none"}>
      <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1 hover:text-ink ${sort === k ? "text-ink" : ""}`}>
        {label}
        {sort === k && <ChevronDown size={12} />}
      </button>
    </th>
  )
}
