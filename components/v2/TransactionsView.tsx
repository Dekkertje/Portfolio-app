"use client"

import { useMemo, useState } from "react"
import { ArrowDownToLine, ArrowUpFromLine, Coins, Minus, Plus, Receipt, Scissors, Search, type LucideIcon } from "lucide-react"
import type { TransactionRow, TransactionsResponse } from "@/app/api/v2/transactions/route"
import type { LedgerEvent } from "@/lib/core"
import { dateShort, eur, money, quantity } from "@/lib/format"
import { displayName } from "./PositionList"
import { Card, Private, Segmented, Skeleton } from "./ui"

type Filter = "all" | "trade" | "income" | "cash" | "costs"

const FILTERS: { value: Filter; label: string; types: LedgerEvent["type"][] }[] = [
  { value: "all", label: "Alles", types: [] },
  { value: "trade", label: "Handel", types: ["buy", "sell", "split"] },
  { value: "income", label: "Dividend", types: ["dividend", "dividend_tax", "interest"] },
  { value: "cash", label: "Geld", types: ["deposit", "withdrawal"] },
  { value: "costs", label: "Kosten", types: ["fee"] },
]

const META: Record<LedgerEvent["type"], { label: string; icon: LucideIcon }> = {
  buy: { label: "Koop", icon: Plus },
  sell: { label: "Verkoop", icon: Minus },
  dividend: { label: "Dividend", icon: Coins },
  dividend_tax: { label: "Bronbelasting", icon: Receipt },
  interest: { label: "Rente", icon: Coins },
  deposit: { label: "Storting", icon: ArrowDownToLine },
  withdrawal: { label: "Opname", icon: ArrowUpFromLine },
  fee: { label: "Kosten", icon: Receipt },
  split: { label: "Split", icon: Scissors },
}

const PAGE = 80
const monthFmt = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric", timeZone: "UTC" })

export function TransactionsView({ data, loading, error, empty }: { data: TransactionsResponse | null; loading: boolean; error: string | null; empty: boolean }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState(PAGE)

  const filtered = useMemo(() => {
    if (!data) return []
    const types = FILTERS.find((f) => f.value === filter)!.types
    const q = query.trim().toLowerCase()
    return data.transactions.filter(
      (t) => (!types.length || types.includes(t.type)) && (!q || (t.name ?? META[t.type].label).toLowerCase().includes(q) || t.symbol?.toLowerCase().includes(q)),
    )
  }, [data, filter, query])

  const groups = useMemo(() => {
    const out: { month: string; rows: TransactionRow[] }[] = []
    for (const t of filtered.slice(0, limit)) {
      const m = t.date.slice(0, 7)
      if (out.at(-1)?.month !== m) out.push({ month: m, rows: [] })
      out.at(-1)!.rows.push(t)
    }
    return out
  }, [filtered, limit])

  return (
    <div className="flex flex-col gap-5 pt-6 lg:pt-10">
      <header className="px-1">
        <h1 className="text-[28px] font-semibold tracking-tight lg:text-[32px]">Transacties</h1>
        {data && <p className="text-[13px] text-muted">{data.transactions.length} regels in je grootboek</p>}
      </header>

      {loading && !data && <Skeleton className="h-96 rounded-3xl" />}
      {error && !data && <Card className="p-6 text-sm text-ink-2">{error}</Card>}
      {empty && <Card className="p-6 text-sm text-ink-2">Nog geen transacties geïmporteerd.</Card>}

      {data && (
        <Card className="p-4 sm:p-6">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Segmented label="Filter" options={FILTERS} value={filter} onChange={(f) => { setFilter(f); setLimit(PAGE) }} fill />
            <label className="relative flex items-center sm:w-64">
              <Search size={16} className="pointer-events-none absolute left-3 text-muted" />
              <span className="sr-only">Zoeken</span>
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setLimit(PAGE) }}
                placeholder="Zoek op naam"
                className="h-10 w-full rounded-full bg-surface-2 pl-9 pr-4 text-[14px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
              />
            </label>
          </div>

          {groups.length === 0 && <p className="px-1 py-8 text-center text-sm text-muted">Geen transacties gevonden</p>}

          {groups.map((g) => (
            <section key={g.month} className="mt-2">
              <h2 className="sticky top-0 z-[1] bg-surface px-1 py-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
                {monthFmt.format(new Date(g.month + "-01T00:00:00Z"))}
              </h2>
              <ul className="divide-y divide-line">
                {g.rows.map((t) => (
                  <TransactionRowItem key={t.id} t={t} />
                ))}
              </ul>
            </section>
          ))}

          {filtered.length > limit && (
            <button onClick={() => setLimit(limit + PAGE)} className="mt-4 h-11 w-full rounded-full bg-surface-2 text-[14px] font-medium text-ink hover:bg-grid">
              Meer laden ({filtered.length - limit})
            </button>
          )}
        </Card>
      )}
    </div>
  )
}

export function TransactionRowItem({ t }: { t: TransactionRow }) {
  const meta = META[t.type]
  const Icon = meta.icon
  const title = t.name ? `${meta.label} · ${displayName(t.name)}` : meta.label
  let detail = dateShort(t.date)
  if ((t.type === "buy" || t.type === "sell") && t.price != null) detail += ` · ${quantity(t.quantity)} × ${money(t.price, t.currency)}`
  if (t.type === "split" && t.splitRatio) detail += ` · ${t.splitRatio >= 1 ? `${t.splitRatio}-voor-1` : `1-voor-${Math.round(1 / t.splitRatio)}`}`
  if (t.feeEur > 0 && t.type !== "fee") detail += ` · kosten ${eur(t.feeEur)}`

  return (
    <li className="flex items-center gap-3 px-1 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-ink-2">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-ink">{title}</p>
        <p className="truncate text-[12px] text-muted">
          <Private>{detail}</Private>
        </p>
      </div>
      {t.type !== "split" && (
        <Private className={`shrink-0 text-[14px] font-semibold ${t.amountEur > 0 ? "text-up" : "text-ink"}`}>
          {eur(t.amountEur, { sign: true })}
        </Private>
      )}
    </li>
  )
}
