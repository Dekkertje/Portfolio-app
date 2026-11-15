"use client"

import { useState } from "react"
import { pct } from "@/lib/format"
import { sectorLabel } from "@/lib/instruments/sectors"
import type { Composition as CompositionData } from "@/lib/portfolio/overview"
import { Amount, Card, SectionTitle, Segmented } from "./ui"

// Vaste volgorde, kleur volgt de categorie (nooit de rangorde)
const KINDS: Record<string, { label: string; color: string }> = {
  stock: { label: "Aandelen", color: "var(--accent)" },
  etf: { label: "ETF's", color: "var(--series-2)" },
  cash: { label: "Cash", color: "var(--series-3)" },
  fund: { label: "Fondsen", color: "var(--muted)" },
  crypto: { label: "Crypto", color: "var(--muted)" },
  other: { label: "Overig", color: "var(--muted)" },
}

/** Samenstelling: soort (aandelen/ETF's/cash) en sectoren t.o.v. de wereldindex. */
export function Composition({ data }: { data: CompositionData }) {
  const [tab, setTab] = useState<"kind" | "sector">("kind")
  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle>Samenstelling</SectionTitle>
      <div className="mb-5 lg:hidden">
        <Segmented
          label="Samenstelling"
          value={tab}
          onChange={setTab}
          fill
          options={[
            { value: "kind", label: "Soort" },
            { value: "sector", label: "Sectoren" },
          ]}
        />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
        <div className={tab === "kind" ? "" : "hidden lg:block"}>
          <h3 className="mb-3 hidden text-[13px] font-medium text-ink-2 lg:block">Soort</h3>
          <KindBar data={data} />
        </div>
        <div className={tab === "sector" ? "" : "hidden lg:block"}>
          <h3 className="mb-3 hidden text-[13px] font-medium text-ink-2 lg:block">Sectoren</h3>
          <Sectors data={data} />
        </div>
      </div>
    </Card>
  )
}

function KindBar({ data }: { data: CompositionData }) {
  const rows = data.byKind.map((k) => ({ ...k, ...(KINDS[k.key] ?? KINDS.other) }))
  return (
    <div>
      {/* Gestapelde balk met 2px tussenruimte in de achtergrondkleur */}
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={rows.map((r) => `${r.label} ${pct(r.weight)}`).join(", ")}>
        {rows.map((r) => (
          <div key={r.key} style={{ width: `${r.weight * 100}%`, background: r.color }} className="h-full first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-2.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 text-[14px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} aria-hidden />
            <span className="flex-1 text-ink">{r.label}</span>
            <Amount value={r.valueEur} decimals={0} className="text-[13px] text-muted" />
            <span className="w-14 text-right font-semibold text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>
              {pct(r.weight)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function verdict(mine: number, bench: number | undefined): string | null {
  if (bench == null || bench < 0.02) return null
  if (mine < 0.002) return "ontbreekt"
  if (mine < bench * 0.5) return "onderwogen"
  if (mine > bench * 1.5) return "overwogen"
  return null
}

function Sectors({ data }: { data: CompositionData }) {
  const bench = data.benchmark?.weights
  const rows = data.bySector
  const max = Math.max(...rows.map((r) => r.weight), ...Object.values(bench ?? {}), 0.01)
  return (
    <div>
      {bench && (
        <div className="mb-3 flex items-center gap-4 text-xs text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3.5 rounded-sm bg-accent" aria-hidden /> Jouw portfolio
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 rounded-full bg-ink" aria-hidden /> {data.benchmark!.label}
          </span>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {rows.map((r) => {
          const b = bench?.[r.key]
          const v = verdict(r.weight, b)
          return (
            <li key={r.key}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate text-ink">
                  {sectorLabel(r.key)}
                  {v && <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2">{v}</span>}
                </span>
                <span className="shrink-0" style={{ fontVariantNumeric: "tabular-nums" }}>
                  <span className="font-semibold text-ink">{pct(r.weight)}</span>
                  {b != null && <span className="ml-1.5 text-muted">/ {pct(b)}</span>}
                </span>
              </div>
              <div className="relative h-2 w-full rounded-full bg-surface-2">
                {r.weight > 0 && <div className="h-2 rounded-full bg-accent" style={{ width: `${(r.weight / max) * 100}%` }} />}
                {b != null && (
                  <span
                    aria-hidden
                    className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink ring-2 ring-surface"
                    style={{ left: `calc(${(b / max) * 100}% - 1px)` }}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-xs text-muted">
        ETF&apos;s zijn doorgekeken naar hun onderliggende aandelen. Gebaseerd op {pct(data.sectorCoverage, { decimals: 0 })} van je effecten
        {data.benchmark ? `; streepje = ${data.benchmark.label}` : ""}.
      </p>
    </div>
  )
}
