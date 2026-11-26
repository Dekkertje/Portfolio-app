"use client"

import { useState } from "react"
import { Download, Info } from "lucide-react"
import { eur, pct } from "@/lib/format"
import type { PortfolioOverview } from "@/lib/portfolio/overview"
import type { YearSummary } from "@/lib/portfolio/yearly"
import { Amount, Card, Delta, Private, SectionTitle, Segmented, Skeleton } from "./ui"

const COUNTRY: Record<string, string> = {
  NL: "Nederland", US: "Verenigde Staten", IE: "Ierland", DE: "Duitsland", FR: "Frankrijk", BE: "België",
  GB: "Verenigd Koninkrijk", LU: "Luxemburg", CH: "Zwitserland", CA: "Canada", JE: "Jersey", DK: "Denemarken",
}

export function YearsView({ data, loading, error }: { data: PortfolioOverview | null; loading: boolean; error: string | null }) {
  const years = data?.years ?? []
  const [selected, setSelected] = useState<number | null>(null)
  const y = years.find((x) => x.year === selected) ?? years[0]
  // Waarde op 1 januari van het jaar erna (= peildatum voor de aangifte van volgend jaar)
  const nextStart = y ? years.find((x) => x.year === y.year + 1) : undefined

  return (
    <div className="flex flex-col gap-5 pt-6 lg:pt-10">
      <header className="px-1">
        <h1 className="text-[28px] font-semibold tracking-tight lg:text-[32px]">Jaaroverzicht</h1>
        <p className="text-[13px] text-muted">Rendement, box 3, dividendbelasting en kosten per jaar</p>
      </header>

      {loading && !data && <Skeleton className="h-96 rounded-3xl" />}
      {error && !data && <Card className="p-6 text-sm text-ink-2">{error}</Card>}

      {y && (
        <>
          <Segmented
            label="Jaar"
            value={String(y.year)}
            onChange={(v) => setSelected(Number(v))}
            options={years.map((x) => ({ value: String(x.year), label: String(x.year) }))}
          />

          <section className="rounded-[28px] bg-surface p-5 ring-1 ring-line sm:p-7">
            <p className="text-[13px] text-ink-2">Resultaat {y.year}{y.ongoing ? " tot nu" : ""}</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <Private className={`text-[40px] font-semibold leading-none tracking-tight ${y.resultEur >= 0 ? "text-up" : "text-down"}`}>
                {eur(y.resultEur, { sign: true, decimals: 0 })}
              </Private>
              <Delta percent={y.returnPct} variant="pill" />
            </div>
            <p className="mt-3 text-[13px] text-ink-2">
              Van <Private className="font-medium text-ink">{eur(y.startValueEur, { decimals: 0 })}</Private> naar{" "}
              <Private className="font-medium text-ink">{eur(y.endValueEur, { decimals: 0 })}</Private>
              {y.netFlowEur !== 0 && (
                <>
                  , met <Private className="font-medium text-ink">{eur(y.netFlowEur, { sign: true, decimals: 0 })}</Private> {data?.tracksCash ? "gestort" : "ingelegd"}
                </>
              )}
            </p>
          </section>

          <div className="grid gap-5 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
            <Box3Card y={y} next={nextStart} tracksCash={data?.tracksCash ?? false} />
            <DividendCard y={y} />
            <CostsCard y={y} />
            <AllYears years={years} />
          </div>

          <p className="flex items-start gap-2 px-1 text-xs text-muted">
            <Info size={14} className="mt-0.5 shrink-0" />
            Dit overzicht helpt bij je aangifte, maar is geen belastingadvies. Controleer de bedragen met de jaaropgaaf van DEGIRO.
          </p>
        </>
      )}
    </div>
  )
}

function Line({ label, value, strong, sub }: { label: string; value: React.ReactNode; strong?: boolean; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <span className="text-[14px] text-ink-2">
        {label}
        {sub && <span className="block text-[12px] text-muted">{sub}</span>}
      </span>
      <span className={`shrink-0 text-[14px] ${strong ? "font-semibold text-ink" : "text-ink"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  )
}

function Box3Card({ y, next, tracksCash }: { y: YearSummary; next?: YearSummary; tracksCash: boolean }) {
  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle>Box 3 · waarde op 1 januari</SectionTitle>
      <div className="divide-y divide-line">
        <Line label={`1 januari ${y.year}`} value={<Amount value={y.startValueEur} />} strong sub={`peildatum aangifte ${y.year}`} />
        {tracksCash && (
          <>
            <Line label="waarvan effecten" value={<Amount value={y.startSecuritiesEur} />} />
            <Line label="waarvan cash" value={<Amount value={y.startCashEur} />} />
          </>
        )}
        {!y.ongoing && (
          <Line
            label={`1 januari ${y.year + 1}`}
            value={<Amount value={next?.startValueEur ?? y.endValueEur} />}
            strong
            sub={`peildatum aangifte ${y.year + 1}`}
          />
        )}
      </div>
      <p className="mt-3 text-[12px] text-muted">Slotwaarde van de laatste handelsdag van het jaar ervoor, in euro.</p>
    </Card>
  )
}

function DividendCard({ y }: { y: YearSummary }) {
  const nl = y.dividendTaxByCountry.find((c) => c.country === "NL")
  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle>Dividend en bronbelasting</SectionTitle>
      {y.dividendGrossEur === 0 ? (
        <p className="px-1 py-4 text-sm text-muted">Geen dividend ontvangen in {y.year}.</p>
      ) : (
        <>
          <div className="divide-y divide-line">
            <Line label="Bruto dividend" value={<Amount value={y.dividendGrossEur} />} strong />
            {y.dividendTaxByCountry.map((c) => (
              <Line
                key={c.country}
                label={`Ingehouden ${COUNTRY[c.country] ?? c.country}`}
                sub={`over ${eur(c.grossEur)} bruto${c.grossEur > 0 ? ` · ${pct(c.taxEur / c.grossEur, { decimals: 0 })}` : ""}`}
                value={<Private>{c.taxEur > 0 ? eur(-c.taxEur) : eur(0)}</Private>}
              />
            ))}
            <Line label="Netto ontvangen" value={<Amount value={y.dividendNetEur} />} strong />
          </div>
          {nl && nl.taxEur > 0 && (
            <p className="mt-3 rounded-2xl bg-surface-2 p-3 text-[12px] text-ink-2">
              De Nederlandse dividendbelasting (<Private>{eur(nl.taxEur)}</Private>) kun je meestal verrekenen in je aangifte inkomstenbelasting. Voor buitenlandse
              bronbelasting gelden andere regels.
            </p>
          )}
        </>
      )}
    </Card>
  )
}

function CostsCard({ y }: { y: YearSummary }) {
  const total = y.transactionCostsEur + y.otherCostsEur
  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle>Handel en kosten</SectionTitle>
      <div className="divide-y divide-line">
        <Line label="Gerealiseerd resultaat" value={<Delta value={y.realizedEur} size="sm" />} strong sub={`${y.sells} verkopen · ${y.buys} aankopen`} />
        <Line label="Transactiekosten" sub="incl. valutakosten (AutoFX)" value={<Amount value={y.transactionCostsEur} />} />
        <Line label="Overige kosten" sub="o.a. aansluitkosten beurzen" value={<Amount value={y.otherCostsEur} />} />
        <Line label="Totale kosten" value={<Amount value={total} />} strong />
        {y.interestEur !== 0 && <Line label="Rente" value={<Amount value={y.interestEur} />} />}
      </div>
      {total > 0 && y.startValueEur > 0 && (
        <p className="mt-3 text-[12px] text-muted">Kosten zijn {pct(total / Math.max(y.startValueEur, y.endValueEur), { decimals: 2 })} van je vermogen.</p>
      )}
    </Card>
  )
}

function AllYears({ years }: { years: YearSummary[] }) {
  function exportCsv() {
    const header = ["jaar", "waarde_1_jan", "eindwaarde", "inleg", "resultaat", "rendement_twr", "gerealiseerd", "dividend_bruto", "bronbelasting", "dividend_netto", "kosten"]
    const n = (v: number) => String(v).replace(".", ",")
    const lines = years.map((y) =>
      [y.year, y.startValueEur, y.endValueEur, y.netFlowEur, y.resultEur, (y.returnPct * 100).toFixed(2), y.realizedEur, y.dividendGrossEur,
        y.dividendTaxByCountry.reduce((s, c) => s + c.taxEur, 0), y.dividendNetEur, y.transactionCostsEur + y.otherCostsEur].map((v) => n(Number(v))).join(";"),
    )
    const blob = new Blob(["﻿" + [header.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "dekkertracker-jaaroverzicht.csv"
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle
        action={
          <button onClick={exportCsv} className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
            <Download size={15} /> CSV
          </button>
        }
      >
        Alle jaren
      </SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead className="text-xs text-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-3 text-left font-medium">Jaar</th>
              <th className="py-2 pr-3 text-right font-medium">Resultaat</th>
              <th className="py-2 pr-3 text-right font-medium">Rendement</th>
              <th className="py-2 text-right font-medium">Dividend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {years.map((y) => (
              <tr key={y.year}>
                <td className="py-2.5 pr-3 text-ink">{y.year}</td>
                <td className={`py-2.5 pr-3 text-right ${y.resultEur >= 0 ? "text-up" : "text-down"}`}>
                  <Private>{eur(y.resultEur, { sign: true, decimals: 0 })}</Private>
                </td>
                <td className={`py-2.5 pr-3 text-right ${y.returnPct >= 0 ? "text-up" : "text-down"}`}>{pct(y.returnPct, { sign: true })}</td>
                <td className="py-2.5 text-right text-ink-2">
                  <Private>{eur(y.dividendNetEur, { decimals: 0 })}</Private>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
