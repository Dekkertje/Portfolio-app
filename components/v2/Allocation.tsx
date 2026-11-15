"use client"

import { pct } from "@/lib/format"
import type { OverviewPosition } from "@/lib/portfolio/overview"
import { displayName } from "./PositionList"
import { Amount } from "./ui"

const MAX_ROWS = 7

/** Verdeling over posities: horizontale balken, één kleur (magnitude, geen identiteit). */
export function Allocation({ positions }: { positions: OverviewPosition[] }) {
  const sorted = [...positions].sort((a, b) => b.weight - a.weight)
  const top = sorted.slice(0, MAX_ROWS)
  const rest = sorted.slice(MAX_ROWS)
  const rows = [
    ...top.map((p) => ({ key: p.instrumentId, label: displayName(p.name), weight: p.weight, value: p.valueEur })),
    ...(rest.length
      ? [{
          key: "other",
          label: `Overig (${rest.length})`,
          weight: rest.reduce((s, p) => s + p.weight, 0),
          value: rest.reduce((s, p) => s + p.valueEur, 0),
        }]
      : []),
  ]
  const max = Math.max(...rows.map((r) => r.weight), 0.0001)

  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink">{r.label}</span>
            <span className="shrink-0 text-ink-2" style={{ fontVariantNumeric: "tabular-nums" }}>
              <Amount value={r.value} decimals={0} className="mr-2 text-muted" />
              {pct(r.weight)}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-2">
            <div
              className="h-2 rounded-full"
              style={{ width: `${(r.weight / max) * 100}%`, background: r.key === "other" ? "var(--muted)" : "var(--accent)" }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
