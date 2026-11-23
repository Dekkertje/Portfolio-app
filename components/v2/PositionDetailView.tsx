"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { ChevronLeft, Minus, Plus } from "lucide-react"
import { dateLong, eur, money, quantity } from "@/lib/format"
import { sectorLabel } from "@/lib/instruments/sectors"
import { displayName } from "@/lib/names"
import type { PositionDetail, PositionTrade } from "@/lib/portfolio/position"
import { PriceChart, tradeResult } from "./PriceChart"
import { TransactionRowItem } from "./TransactionsView"
import { Amount, Card, Delta, Initials, Private, SectionTitle, Segmented, Skeleton } from "./ui"

type Period = "1M" | "3M" | "1J" | "ALL"
const PERIODS: { value: Period; label: string }[] = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "1J", label: "1J" },
  { value: "ALL", label: "Alles" },
]

const KIND_LABEL: Record<string, string> = { stock: "Aandeel", etf: "ETF", fund: "Fonds", crypto: "Crypto" }

export function PositionDetailView({ data, loading, error }: { data: PositionDetail | null; loading: boolean; error: string | null }) {
  const [period, setPeriod] = useState<Period>("1J")
  const [selected, setSelected] = useState<string | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  const slice = useMemo(() => {
    if (!data?.series.length) return { series: [], trades: [] }
    const last = new Date(data.series.at(-1)!.d + "T00:00:00Z")
    if (period === "1M") last.setUTCMonth(last.getUTCMonth() - 1)
    if (period === "3M") last.setUTCMonth(last.getUTCMonth() - 3)
    if (period === "1J") last.setUTCFullYear(last.getUTCFullYear() - 1)
    const start = period === "ALL" ? data.series[0].d : last.toISOString().slice(0, 10)
    return { series: data.series.filter((p) => p.d >= start), trades: data.trades.filter((t) => t.d >= start) }
  }, [data, period])

  /** Trade in de lijst gekozen: zorg dat hij in de grafiekperiode valt en scroll ernaartoe */
  function selectTrade(t: PositionTrade) {
    setSelected(selected === t.id ? null : t.id)
    if (slice.series.length && t.d < slice.series[0].d) setPeriod("ALL")
    chartRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  return (
    <div className="flex flex-col gap-5 pt-6 lg:pt-10">
      <Link href="/posities" className="-ml-1 flex w-fit items-center gap-0.5 rounded-full px-1 text-[14px] font-medium text-ink-2 hover:text-ink">
        <ChevronLeft size={18} /> Posities
      </Link>

      {loading && !data && <Skeleton className="h-96 rounded-3xl" />}
      {error && !data && <Card className="p-6 text-sm text-ink-2">{error}</Card>}

      {data && (
        <>
          <section className="rounded-[28px] bg-surface p-5 ring-1 ring-line sm:p-7">
            <div className="flex items-start gap-3">
              <Initials name={displayName(data.instrument.name)} />
              <div className="min-w-0">
                <h1 className="text-[22px] font-semibold leading-tight tracking-tight sm:text-[26px]">{displayName(data.instrument.name)}</h1>
                <p className="mt-0.5 text-[13px] text-muted">
                  {[data.instrument.symbol, data.instrument.isin].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[KIND_LABEL[data.instrument.kind], data.instrument.sector && sectorLabel(data.instrument.sector), data.instrument.country]
                    .filter(Boolean)
                    .map((c) => (
                      <span key={c} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[12px] text-ink-2">{c}</span>
                    ))}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[13px] text-ink-2">{data.quantity > 0 ? "Waarde" : "Gesloten positie"}</p>
              <Private className="mt-1 block text-[40px] font-semibold leading-none tracking-tight sm:text-[48px]">
                {eur(data.quantity > 0 ? data.valueEur : data.totalReturnEur ?? 0, { sign: data.quantity === 0 })}
              </Private>
              {data.quantity > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                  {data.dayChangePct != null && (
                    <span className="flex items-center gap-2">
                      <Delta value={data.dayChangeEur} percent={data.dayChangePct} variant="pill" />
                      <span className="text-[13px] text-muted">vandaag</span>
                    </span>
                  )}
                  <span className="flex items-center gap-2">
                    <Delta value={data.unrealizedEur} percent={data.unrealizedPct} />
                    <span className="text-[13px] text-muted">ongerealiseerd</span>
                  </span>
                </div>
              )}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Aantal" value={<Private>{quantity(data.quantity)}</Private>} />
            <Stat label="Koers" value={data.price != null && data.instrument.currency ? money(data.price, data.instrument.currency) : "—"} sub={data.instrument.currency !== "EUR" && data.priceEur != null ? `≈ ${eur(data.priceEur)}` : undefined} />
            <Stat label="Gem. aankoopkoers" value={data.avgCostEur != null ? eur(data.avgCostEur) : "—"} sub="incl. kosten" />
            <Stat label="Kostprijs" value={<Amount value={data.costEur} />} />
            <Stat label="Gerealiseerd" value={<Amount value={data.realizedEur} />} tone={data.realizedEur} />
            <Stat label="Dividend" value={<Amount value={data.dividendsEur} />} sub="netto" />
            <Stat label="Transactiekosten" value={<Amount value={data.feesEur} />} />
            <Stat label="Totaal resultaat" value={data.totalReturnEur != null ? <Amount value={data.totalReturnEur} /> : "—"} tone={data.totalReturnEur ?? 0} sub="incl. dividend" />
          </div>

          {data.series.length > 1 && (
            <div ref={chartRef}>
            <Card className="p-4 sm:p-6">
              <SectionTitle>Koers in euro</SectionTitle>
              <Segmented label="Periode" options={PERIODS} value={period} onChange={setPeriod} fill />
              <div className="mt-4">
                <PriceChart series={slice.series} trades={slice.trades} avgCost={data.avgCostEur} highlightId={selected} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-ink-2">
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 rounded-full bg-accent" aria-hidden /> Koers</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ink" aria-hidden /> Koop</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-ink" aria-hidden /> Verkoop</span>
                {data.avgCostEur != null && <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 rounded-full bg-muted" aria-hidden /> Gem. aankoopkoers</span>}
                <span className="w-full text-muted sm:w-auto sm:ml-auto">Groen = winst, rood = verlies op die trade</span>
              </div>
            </Card>
            </div>
          )}

          {data.trades.length > 0 && <TradeList trades={data.trades} selected={selected} onSelect={selectTrade} />}

          {data.events.some((e) => e.type !== "buy" && e.type !== "sell") && (
            <Card className="p-4 sm:p-6">
              <SectionTitle>Dividend en overige</SectionTitle>
              <ul className="divide-y divide-line">
                {data.events
                  .filter((e) => e.type !== "buy" && e.type !== "sell")
                  .map((e) => (
                    <TransactionRowItem key={e.id} t={{ ...e, name: null, symbol: null }} />
                  ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: number }) {
  const color = tone == null || tone === 0 ? "text-ink" : tone > 0 ? "text-up" : "text-down"
  return (
    <Card className="p-4">
      <p className="truncate text-[13px] text-ink-2">{label}</p>
      <p className={`mt-1 truncate text-lg font-semibold tracking-tight ${color}`}>{value}</p>
      {sub && <p className="truncate text-xs text-muted">{sub}</p>}
    </Card>
  )
}

/** Alle aan- en verkopen met hun resultaat; tikken markeert de trade op de grafiek. */
function TradeList({ trades, selected, onSelect }: { trades: PositionTrade[]; selected: string | null; onSelect: (t: PositionTrade) => void }) {
  const sells = trades.filter((t) => t.type === "sell")
  const realized = sells.reduce((s, t) => s + (t.realizedEur ?? 0), 0)
  const won = sells.filter((t) => (t.realizedEur ?? 0) > 0).length
  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle>Aan- en verkopen</SectionTitle>
      {sells.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[13px] text-ink-2">
          <span>
            Gerealiseerd <Delta value={realized} size="xs" />
          </span>
          <span className="text-muted">
            {won} van {sells.length} verkopen met winst
          </span>
        </div>
      )}
      <ul className="divide-y divide-line">
        {[...trades].reverse().map((t) => {
          const r = tradeResult(t)
          const Icon = t.type === "buy" ? Plus : Minus
          return (
            <li key={t.id}>
              <button
                onClick={() => onSelect(t)}
                aria-pressed={selected === t.id}
                className={`-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors ${selected === t.id ? "bg-surface-2" : "hover:bg-surface-2/60"}`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-ink-2">
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-ink">
                    {t.type === "buy" ? "Koop" : "Verkoop"} <Private>{quantity(t.quantity)}</Private> × {eur(t.priceEur)}
                  </p>
                  <p className="text-[12px] text-muted">{dateLong(t.d)}</p>
                </div>
                <div className="shrink-0 text-right">
                  {r != null ? <Delta value={r} percent={t.returnPct} size="xs" /> : <span className="text-xs text-muted">{t.openQuantity === 0 ? "verkocht" : "—"}</span>}
                  <p className="text-[11px] text-muted">{tradeLabel(t)}</p>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 px-1 text-[12px] text-muted">
        Verkoop: opbrengst min de gemiddelde aankoopprijs van de verkochte stuks. Koop: hoe het deel dat je nog hebt ervoor staat met de huidige koers; verkopen gaan van de oudste aankoop af.
      </p>
    </Card>
  )
}

function tradeLabel(t: PositionTrade): string {
  if (t.type === "sell") return "gerealiseerd"
  if (t.openQuantity === 0) return "zit in een verkoop"
  if (t.openQuantity != null && t.openQuantity < t.quantity - 1e-9) return `nog ${quantity(t.openQuantity)} in bezit`
  return "sinds aankoop"
}
