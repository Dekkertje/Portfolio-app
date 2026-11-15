"use client"

import { useState } from "react"
import { CalendarClock } from "lucide-react"
import type { DividendsResponse } from "@/app/api/v2/dividends/route"
import { dateShort, eur, money } from "@/lib/format"
import { MonthBars } from "./MonthBars"
import { displayName } from "@/lib/names"
import { Card, Initials, Private, SectionTitle, Skeleton } from "./ui"

const FREQ: Record<number, string> = { 1: "jaarlijks", 2: "halfjaarlijks", 4: "per kwartaal", 12: "maandelijks" }

export function DividendsView({ data, loading, error, empty }: { data: DividendsResponse | null; loading: boolean; error: string | null; empty: boolean }) {
  const thisYear = new Date().getFullYear()

  return (
    <div className="flex flex-col gap-5 pt-6 lg:pt-10">
      <header className="px-1">
        <h1 className="text-[28px] font-semibold tracking-tight lg:text-[32px]">Dividend</h1>
        <p className="text-[13px] text-muted">Netto ontvangen volgens je rekeningoverzicht, en wat er verwacht wordt</p>
      </header>

      {loading && !data && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      )}
      {error && !data && <Card className="p-6 text-sm text-ink-2">{error}</Card>}
      {empty && <Card className="p-6 text-sm text-ink-2">Nog geen transacties geïmporteerd.</Card>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label={`Ontvangen ${thisYear}`} value={data.byYear.find((y) => y.year === thisYear)?.netEur ?? 0} sub="netto" />
            <Tile label="Laatste 12 maanden" value={data.months.reduce((s, m) => s + m.netEur, 0)} sub="netto" />
            <Tile label="Verwacht (12 mnd)" value={data.expectedYearEur} sub="bruto, schatting" />
            <Tile label="Totaal ontvangen" value={data.byYear.reduce((s, y) => s + y.netEur, 0)} sub={`${data.payments.length} uitkeringen`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:items-start [&>*]:min-w-0">
            <Card className="p-4 sm:p-6">
              <SectionTitle>Per maand</SectionTitle>
              <MonthBars months={data.months} />
              <p className="mt-2 px-1 text-xs text-muted">Netto per maand, laatste 12 maanden</p>
            </Card>
            <Card className="p-4 sm:p-6">
              <SectionTitle>Verwacht</SectionTitle>
              {data.upcoming.length === 0 ? (
                <p className="px-1 text-sm text-ink-2">Geen verwachte uitkeringen voor je huidige posities.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.upcoming.slice(0, 6).map((u) => (
                    <li key={u.instrumentId} className="flex items-center gap-3 py-2.5">
                      <DateBadge iso={u.nextExDate} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-ink">{displayName(u.name)}</p>
                        <p className="text-[12px] text-muted">
                          {money(u.amountPerShare, u.currency)} per aandeel · {FREQ[u.frequency]}
                        </p>
                      </div>
                      {u.expectedEur != null && (
                        <span className="shrink-0 text-[14px] font-semibold text-ink">
                          ≈ <Private>{eur(u.expectedEur)}</Private>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 flex items-start gap-1.5 px-1 text-xs text-muted">
                <CalendarClock size={13} className="mt-0.5 shrink-0" />
                Geschatte ex-dividenddatum en bedrag op basis van de laatste uitkeringen; bruto, vóór bronbelasting.
              </p>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:items-start [&>*]:min-w-0">
            <Payments payments={data.payments} />
            <div className="flex flex-col gap-5">
              <Card className="p-4 sm:p-6">
                <SectionTitle>Per jaar</SectionTitle>
                <ul className="divide-y divide-line">
                  {data.byYear.map((y) => (
                    <li key={y.year} className="flex items-baseline justify-between py-2.5 text-[14px]">
                      <span className="text-ink">{y.year}</span>
                      <span className="text-ink-2">
                        <span className="mr-3 text-xs text-muted">{y.count}×</span>
                        <Private className="font-semibold text-ink">{eur(y.netEur)}</Private>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="p-4 sm:p-6">
                <SectionTitle>Per positie</SectionTitle>
                <ul className="divide-y divide-line">
                  {data.byInstrument.map((p) => (
                    <li key={p.instrumentId} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                      <span className="min-w-0 truncate text-ink">
                        {displayName(p.name)}
                        {!p.open && <span className="ml-2 text-xs text-muted">gesloten</span>}
                      </span>
                      <Private className="shrink-0 font-semibold text-ink">{eur(p.netEur)}</Private>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <Card className="p-4">
      <p className="truncate text-[13px] text-ink-2">{label}</p>
      <Private className="mt-1 block text-xl font-semibold tracking-tight text-ink">{eur(value)}</Private>
      <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>
    </Card>
  )
}

function DateBadge({ iso }: { iso: string }) {
  const [day, month] = dateShort(iso).split(" ")
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-wash text-center leading-none text-accent">
      <span>
        <span className="block text-[15px] font-semibold">{day}</span>
        <span className="block text-[10px] uppercase">{month?.replace(".", "")}</span>
      </span>
    </span>
  )
}

function Payments({ payments }: { payments: DividendsResponse["payments"] }) {
  const [all, setAll] = useState(false)
  const rows = all ? payments : payments.slice(0, 10)
  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle
        action={
          payments.length > 10 ? (
            <button onClick={() => setAll(!all)} className="text-[13px] font-medium text-ink-2 hover:text-ink">
              {all ? "Minder" : `Alle ${payments.length}`}
            </button>
          ) : null
        }
      >
        Ontvangen
      </SectionTitle>
      <ul className="divide-y divide-line">
        {rows.map((p) => (
          <li key={`${p.date}-${p.instrumentId}`} className="flex items-center gap-3 py-2.5">
            <Initials name={displayName(p.name)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-ink">{displayName(p.name)}</p>
              <p className="text-[12px] text-muted">
                {dateShort(p.date)} {p.date.slice(0, 4)}
                {p.taxEur > 0 && (
                  <>
                    {" "}· bruto <Private>{eur(p.grossEur)}</Private>, belasting <Private>{eur(p.taxEur)}</Private>
                  </>
                )}
              </p>
            </div>
            <Private className="shrink-0 text-[14px] font-semibold text-up">{eur(p.netEur, { sign: true })}</Private>
          </li>
        ))}
      </ul>
    </Card>
  )
}
