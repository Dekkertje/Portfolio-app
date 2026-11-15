/**
 * DEGIRO-import: zet de exports "Transacties" en "Rekeningoverzicht" om naar
 * LedgerEvents voor lib/core.
 *
 * Bronverdeling:
 * - Transacties.csv is leidend voor kopen/verkopen (EUR-totaal, kosten, AutoFX, order-ID)
 *   en splits (DEGIRO boekt die als verkoop + koop zonder order-ID).
 * - Rekeningoverzicht.csv levert alles wat géén trade is: stortingen, opnames,
 *   dividend, bronbelasting, losse kosten en rente. De vele interne boekingen
 *   (cash sweep, flatex-overboekingen, iDEAL-reserveringen, geldmarktfonds,
 *   valutaconversie) worden genegeerd.
 *
 * Event-id's zijn deterministisch, zodat opnieuw importeren (ook met
 * overlappende periodes) niets dubbel oplevert.
 *
 * instrumentId is hier de ISIN; de database-laag vertaalt die naar een instrument-id.
 */

import Papa from "papaparse"
import type { Currency, IsoDate, LedgerEvent } from "@/lib/core/types"
import { parseDegiroDate, parseEuropeanNumber } from "@/lib/utils"

export type ParsedInstrument = {
  isin: string
  name: string
  exchange: string | null
  currency: Currency
}

export type DegiroImportResult = {
  events: LedgerEvent[]
  instruments: Map<string, ParsedInstrument>
  warnings: string[]
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function readCsv(text: string): string[][] {
  const { data } = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: true })
  return data
}

function date(value: string): IsoDate {
  const d = parseDegiroDate(value.trim())
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`Ongeldige datum: "${value}"`)
  return d
}

const num = (value: string | undefined) => (value?.trim() ? parseEuropeanNumber(value) : 0)

/** Maakt id's uniek binnen één bestand, met een volgnummer voor identieke regels. */
function idFactory() {
  const seen = new Map<string, number>()
  return (base: string) => {
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base}#${n}`
  }
}

// ─── Transacties ──────────────────────────────────────────────────────────────

export type DegiroTrade = {
  date: IsoDate
  time: string
  product: string
  isin: string
  exchange: string | null
  /** Positief = koop, negatief = verkoop */
  quantity: number
  price: number
  currency: Currency
  totalEur: number
  feeEur: number
  orderId: string | null
  /** Stabiele id uit de bron (bijv. rij-id in de oude transactions-tabel) */
  sourceId?: string
}

// Datum,Tijd,Product,ISIN,Beurs,Uitvoeringsplaats,Aantal,Koers,,Lokale waarde,,Waarde EUR,
// Wisselkoers,AutoFX Kosten,Transactiekosten en/of kosten van derden EUR,Totaal EUR,Order ID
const TX_COLUMNS = 17

export function parseDegiroTransactions(text: string): DegiroTrade[] {
  const rows = readCsv(text)
  const header = rows[0] ?? []
  if (header.length !== TX_COLUMNS || !/^(Datum|Date)$/i.test(header[0]) || !/ISIN/i.test(header[3])) {
    throw new Error("Dit lijkt geen DEGIRO Transacties-export (verwacht 17 kolommen beginnend met Datum)")
  }

  return rows.slice(1).map((r) => ({
    date: date(r[0]),
    time: r[1],
    product: r[2].trim(),
    isin: r[3].trim(),
    exchange: r[4].trim() || null,
    quantity: num(r[6]),
    price: num(r[7]),
    currency: r[8].trim() || "EUR",
    totalEur: num(r[15]),
    // Transactiekosten en AutoFX staan als negatieve bedragen in de export
    feeEur: -(num(r[13]) + num(r[14])),
    orderId: r[16].trim() || null,
  }))
}

// ─── Rekeningoverzicht ────────────────────────────────────────────────────────

export type AccountKind =
  | "deposit"
  | "withdrawal"
  | "dividend"
  | "dividend_tax"
  | "fee"
  | "interest"
  | "fx_conversion"   // Valuta Debitering: bron van de wisselkoers voor vreemde-valuta-boekingen
  | "trade"           // zit al in Transacties.csv
  | "internal"        // verschuivingen binnen de rekening, geen effect op het vermogen

export type DegiroAccountRow = {
  index: number
  date: IsoDate
  time: string
  product: string
  isin: string | null
  description: string
  fxRate: number | null
  currency: Currency | null
  amount: number | null
  /** Saldo na deze regel, zoals DEGIRO het toont */
  balance: number | null
  balanceCurrency: Currency | null
  orderId: string | null
  kind: AccountKind | null
}

/** Volgorde is belangrijk: de eerste match wint. */
const ACCOUNT_RULES: [RegExp, AccountKind][] = [
  [/^(Koop|Verkoop|Buy|Sell) [\d.,]+ @/i, "trade"],
  [/Transactiekosten|Transaction (fee|costs)/i, "trade"],
  [/^SPLIT AANPASSING/i, "trade"],
  [/^(iDEAL (Deposit|storting)|Storting|Deposit|flatex Deposit)$/i, "deposit"],
  [/^(Terugstorting|flatex terugstorting|Withdrawal|flatex Withdrawal)$/i, "withdrawal"],
  [/^Dividendbelasting$|^Dividend Tax$/i, "dividend_tax"],
  [/^(Dividend|Kapitaalsuitkering|Capital return)$/i, "dividend"],
  [/Aansluitingskosten|Connection fee|Externe kosten|Service.?fee/i, "fee"],
  [/Interest Income|^Rente|Geldmarktfondsen Compensatie/i, "interest"],
  [/^Valuta Debitering$|^FX Debit$/i, "fx_conversion"],
  [
    /^Valuta Creditering$|^FX Credit$|Cash Sweep|Overboeking (van|naar) uw geldrekening|Reservation iDEAL|Processed Flatex Withdrawal|geldmarktfonds/i,
    "internal",
  ],
]

export function classifyAccountDescription(description: string): AccountKind | null {
  for (const [re, kind] of ACCOUNT_RULES) if (re.test(description.trim())) return kind
  return null
}

// Datum,Tijd,Valutadatum,Product,ISIN,Omschrijving,FX,Mutatie,,Saldo,,Order Id
const ACCOUNT_COLUMNS = 12

export function parseDegiroAccount(text: string): DegiroAccountRow[] {
  const rows = readCsv(text)
  const header = rows[0] ?? []
  if (header.length !== ACCOUNT_COLUMNS || !/^(Datum|Date)$/i.test(header[0]) || !/(Omschrijving|Description)/i.test(header[5])) {
    throw new Error("Dit lijkt geen DEGIRO Rekeningoverzicht-export (verwacht 12 kolommen met Omschrijving)")
  }

  const parsed = rows.slice(1).map((r, i) => ({
    index: i,
    date: date(r[0]),
    time: r[1],
    product: r[3].trim(),
    isin: r[4].trim() || null,
    description: r[5].trim(),
    fxRate: r[6].trim() ? num(r[6]) : null,
    currency: r[7].trim() || null,
    amount: r[8].trim() ? num(r[8]) : null,
    balance: r[10]?.trim() ? num(r[10]) : null,
    balanceCurrency: r[9]?.trim() || null,
    orderId: r[11]?.trim() || null,
    kind: classifyAccountDescription(r[5]),
  }))

  // De export staat nieuwste-eerst; chronologisch maken (binnen een minuut de bestandsvolgorde omdraaien)
  return parsed.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || b.index - a.index)
}

/** Meest recente saldo in een valuta (de bovenste regel van de export die die valuta toont). */
export function latestBalance(rows: DegiroAccountRow[], currency: Currency = "EUR"): number | null {
  let latest: DegiroAccountRow | null = null
  for (const r of rows) if (r.balanceCurrency === currency && r.balance != null && (!latest || r.index < latest.index)) latest = r
  return latest?.balance ?? null
}

// ─── Naar grootboek ───────────────────────────────────────────────────────────

/** Splits: verkoop + koop zonder order-ID, zelfde dag en ISIN, totalen heffen elkaar op. */
function extractSplits(trades: DegiroTrade[]): { splits: DegiroTrade[][]; rest: DegiroTrade[] } {
  const groups = new Map<string, DegiroTrade[]>()
  for (const t of trades) {
    if (t.orderId) continue
    const key = `${t.date}|${t.isin}`
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  const splits: DegiroTrade[][] = []
  const inSplit = new Set<DegiroTrade>()
  for (const g of groups.values()) {
    const out = g.filter((t) => t.quantity < 0)
    const inn = g.filter((t) => t.quantity > 0)
    const net = g.reduce((s, t) => s + t.totalEur, 0)
    if (out.length === 1 && inn.length === 1 && Math.abs(net) < 0.05) {
      splits.push([out[0], inn[0]])
      g.forEach((t) => inSplit.add(t))
    }
  }
  return { splits, rest: trades.filter((t) => !inSplit.has(t)) }
}

/**
 * Zet trades om naar buy/sell/split-events. Ook gebruikt voor de oude
 * transactions-tabel, die hetzelfde formaat en dezelfde tekens heeft.
 */
export function tradesToEvents(
  trades: DegiroTrade[],
  opts: { idPrefix: string; warnMissingOrderId: boolean },
): { events: LedgerEvent[]; warnings: string[] } {
  const events: LedgerEvent[] = []
  const warnings: string[] = []
  const makeId = idFactory()
  const { splits, rest } = extractSplits(trades)

  for (const t of rest) {
    if (!t.isin || t.quantity === 0) {
      warnings.push(`Transactie overgeslagen (geen ISIN of aantal): ${t.date} ${t.product}`)
      continue
    }
    if (!t.orderId && opts.warnMissingOrderId) {
      warnings.push(`Transactie zonder order-ID (corporate action?): ${t.date} ${t.product} ${t.quantity}`)
    }
    events.push({
      id: t.sourceId
        ? `${opts.idPrefix}:tx:${t.sourceId}`
        : makeId(`${opts.idPrefix}:tx:${t.orderId ?? "none"}:${t.date}:${t.time}:${t.isin}:${t.quantity}:${t.price}`),
      date: t.date,
      type: t.quantity > 0 ? "buy" : "sell",
      instrumentId: t.isin,
      quantity: Math.abs(t.quantity),
      price: t.price,
      currency: t.currency,
      amountEur: t.totalEur,
      feeEur: t.feeEur,
    })
  }

  for (const [out, inn] of splits) {
    events.push({
      id: makeId(`${opts.idPrefix}:split:${inn.date}:${inn.isin}:${-out.quantity}:${inn.quantity}`),
      date: inn.date,
      type: "split",
      instrumentId: inn.isin,
      quantity: 0,
      price: null,
      currency: inn.currency,
      amountEur: 0,
      feeEur: 0,
      splitRatio: inn.quantity / -out.quantity,
    })
  }

  return { events, warnings }
}

/** EUR per eenheid vreemde valuta, uit de eerstvolgende Valuta Debitering (FX-kolom = valuta per EUR). */
function fxResolver(rows: DegiroAccountRow[]) {
  const position = new Map(rows.map((r, i) => [r, i]))
  const conversions = rows.filter((r) => r.kind === "fx_conversion" && r.fxRate && r.currency)
  return (currency: Currency, row: DegiroAccountRow): number | null => {
    const pos = position.get(row)!
    const next = conversions.find((c) => c.currency === currency && position.get(c)! >= pos)
    const prev = conversions.findLast((c) => c.currency === currency && position.get(c)! < pos)
    const rate = (next ?? prev)?.fxRate
    return rate ? 1 / rate : null
  }
}

export function degiroToLedger(input: { transactions: string; account?: string }): DegiroImportResult {
  const warnings: string[] = []
  const events: LedgerEvent[] = []
  const instruments = new Map<string, ParsedInstrument>()
  const makeId = idFactory()

  const trades = parseDegiroTransactions(input.transactions)
  for (const t of trades) {
    if (!t.isin) continue
    instruments.set(t.isin, { isin: t.isin, name: t.product, exchange: t.exchange, currency: t.currency })
  }

  const tradeResult = tradesToEvents(trades, { idPrefix: "degiro", warnMissingOrderId: true })
  events.push(...tradeResult.events)
  warnings.push(...tradeResult.warnings)

  if (input.account) {
    const rows = parseDegiroAccount(input.account)
    const eurPer = fxResolver(rows)

    for (const r of rows) {
      if (r.kind === null) {
        warnings.push(`Onbekende regel in rekeningoverzicht: ${r.date} "${r.description}" ${r.currency ?? ""} ${r.amount ?? ""}`)
        continue
      }
      if (r.kind === "trade" || r.kind === "internal" || r.kind === "fx_conversion") continue
      if (!r.amount) continue

      const currency = r.currency ?? "EUR"
      let amountEur = r.amount
      if (currency !== "EUR") {
        const rate = eurPer(currency, r)
        if (rate == null) {
          warnings.push(`Geen wisselkoers gevonden voor ${r.date} ${r.description} ${currency} ${r.amount}`)
          continue
        }
        amountEur = Math.round(r.amount * rate * 100) / 100
      }

      if (r.isin && !instruments.has(r.isin)) {
        instruments.set(r.isin, { isin: r.isin, name: r.product, exchange: null, currency })
      }

      events.push({
        id: makeId(`degiro:acc:${r.date}:${r.time}:${r.isin ?? ""}:${r.description}:${currency}:${r.amount}`),
        date: r.date,
        type: r.kind,
        // Kosten/rente zonder ISIN horen bij de rekening, niet bij een positie
        instrumentId: r.kind === "dividend" || r.kind === "dividend_tax" ? r.isin : null,
        quantity: 0,
        price: null,
        currency,
        amountEur,
        feeEur: r.kind === "fee" ? -amountEur : 0,
      })
    }
  }

  return { events, instruments, warnings }
}
