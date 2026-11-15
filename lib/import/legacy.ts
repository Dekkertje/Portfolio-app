/**
 * Omzetting van de oude tabellen (transactions, manual_positions) naar
 * grootboek-events, voor gebruikers die nog niet opnieuw hebben geïmporteerd.
 */

import type { LedgerEvent } from "@/lib/core/types"
import { tradesToEvents, type DegiroTrade, type ParsedInstrument } from "./degiro"

export type LegacyTransactionRow = {
  id: string
  trade_date: string
  trade_time: string | null
  product: string
  isin: string | null
  exchange: string | null
  quantity: number | string
  price: number | string | null
  local_value: number | string | null
  total_eur: number | string
  transaction_fee: number | string | null
  autofx_cost: number | string | null
  order_id: string | null
  transaction_type: string | null
}

export type LegacyManualPositionRow = {
  id: string
  product_name: string
  isin: string | null
  exchange: string | null
  quantity: number | string
  average_price: number | string
  currency: string | null
  purchase_date: string | null
  created_at: string
}

const n = (v: number | string | null | undefined) => (v == null || v === "" ? 0 : Number(v))

export function legacyToLedger(input: {
  transactions: LegacyTransactionRow[]
  manualPositions: LegacyManualPositionRow[]
}): { events: LedgerEvent[]; instruments: Map<string, ParsedInstrument>; warnings: string[] } {
  const instruments = new Map<string, ParsedInstrument>()
  const warnings: string[] = []

  const trades: DegiroTrade[] = []
  for (const r of input.transactions) {
    if (!r.isin) {
      warnings.push(`Oude transactie zonder ISIN overgeslagen: ${r.trade_date} ${r.product}`)
      continue
    }
    const quantity = n(r.quantity)
    // Het oude transaction_type is leidend; het teken van quantity was niet altijd betrouwbaar
    const sign = r.transaction_type === "sell" ? -1 : r.transaction_type === "buy" ? 1 : Math.sign(-n(r.total_eur))
    // De oude tabel had geen valutakolom; local_value ≠ waarde in EUR betekent vreemde valuta,
    // maar welke is onbekend — de instrumentvaluta wordt later bij het koppelen aan Yahoo bepaald.
    trades.push({
      date: r.trade_date,
      time: r.trade_time ?? "00:00",
      product: r.product,
      isin: r.isin,
      exchange: r.exchange,
      quantity: sign * Math.abs(quantity),
      price: n(r.price),
      currency: "EUR",
      totalEur: n(r.total_eur),
      feeEur: Math.abs(n(r.transaction_fee)) + Math.abs(n(r.autofx_cost)),
      orderId: r.order_id || null,
      sourceId: r.id,
    })
    instruments.set(r.isin, { isin: r.isin, name: r.product, exchange: r.exchange, currency: "EUR" })
  }

  const result = tradesToEvents(trades, { idPrefix: "legacy", warnMissingOrderId: false })
  warnings.push(...result.warnings)
  const events = result.events

  for (const m of input.manualPositions) {
    if (!m.isin) {
      warnings.push(`Handmatige positie zonder ISIN overgeslagen: ${m.product_name}`)
      continue
    }
    const qty = n(m.quantity)
    const cost = qty * n(m.average_price)
    events.push({
      id: `legacy:manual:${m.id}`,
      date: m.purchase_date ?? m.created_at.slice(0, 10),
      type: "buy",
      instrumentId: m.isin,
      quantity: qty,
      price: n(m.average_price),
      currency: m.currency ?? "EUR",
      amountEur: -cost,
      feeEur: 0,
    })
    if (!instruments.has(m.isin)) {
      instruments.set(m.isin, { isin: m.isin, name: m.product_name, exchange: m.exchange, currency: m.currency ?? "EUR" })
    }
  }

  return { events, instruments, warnings }
}
