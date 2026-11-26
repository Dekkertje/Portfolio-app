/**
 * Handmatige transacties: alles wat niet uit een broker-export komt (andere broker,
 * crypto, een correctie). Komt als gewoon event in het grootboek, met
 * external_id "manual:<uuid>", zodat het verwijderd kan worden.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"
import type { IsoDate } from "@/lib/core"
import { isETF } from "@/lib/utils"
import { minusDays } from "@/lib/prices/sync"
import { fetchChart, fxSymbol } from "@/lib/prices/yahoo-chart"

export type ManualType = "buy" | "sell" | "dividend" | "deposit" | "withdrawal" | "fee"

export type ManualInput = {
  type: ManualType
  date: IsoDate
  /** Bestaand instrument, of een Yahoo-symbool (+ optioneel ISIN/naam) voor een nieuw instrument */
  instrument?: { id?: string; symbol?: string; isin?: string | null; name?: string }
  quantity?: number
  /** Koers per stuk in `currency` */
  price?: number
  currency?: string
  /** Kosten in EUR (≥ 0) */
  feeEur?: number
  /** Bedrag in EUR (positief) voor storting, opname, dividend en kosten */
  amountEur?: number
  note?: string
}

export class ManualError extends Error {}

/** Zoekt een instrument op id of Yahoo-symbool; maakt het aan als het nog niet bestaat. */
export async function resolveInstrument(service: SupabaseClient, ref: NonNullable<ManualInput["instrument"]>): Promise<string> {
  if (ref.id) {
    const { data } = await service.from("instruments").select("id").eq("id", ref.id).maybeSingle()
    if (!data) throw new ManualError("Effect niet gevonden")
    return data.id
  }
  const symbol = ref.symbol?.trim().toUpperCase()
  if (!symbol) throw new ManualError("Kies een effect")

  const { data: bySymbol } = await service.from("instruments").select("id").eq("yahoo_symbol", symbol).limit(1).maybeSingle()
  if (bySymbol) return bySymbol.id
  if (ref.isin) {
    const { data: byIsin } = await service.from("instruments").select("id").eq("isin", ref.isin).maybeSingle()
    if (byIsin) return byIsin.id
  }

  // Nieuw instrument: naam en valuta van Yahoo
  const chart = await fetchChart(symbol, minusDays(new Date().toISOString().slice(0, 10), 7)).catch(() => null)
  if (!chart) throw new ManualError(`Symbool ${symbol} is onbekend bij Yahoo`)
  const name = ref.name?.trim() || symbol
  const { data: created, error } = await service
    .from("instruments")
    .insert({
      // Zonder ISIN een herkenbare sleutel op basis van het symbool
      isin: ref.isin?.trim() || `SYM:${symbol}`,
      name,
      kind: isETF(name) ? "etf" : "stock",
      currency: chart.currency,
      yahoo_symbol: symbol,
      symbol_status: "approved",
      match_method: "manual",
    })
    .select("id")
    .single()
  if (error) throw new ManualError(`Effect aanmaken mislukt: ${error.message}`)
  return created.id
}

/** EUR per eenheid `currency` op (of vlak vóór) `date`; haalt de koers op als hij ontbreekt. */
export async function eurPerUnit(service: SupabaseClient, currency: string, date: IsoDate): Promise<number> {
  if (currency === "EUR") return 1
  const lookup = async () => {
    const { data } = await service
      .from("fx_rates")
      .select("rate, rate_date")
      .eq("base_currency", currency)
      .eq("quote_currency", "EUR")
      .lte("rate_date", date)
      .gte("rate_date", minusDays(date, 10))
      .order("rate_date", { ascending: false })
      .limit(1)
      .maybeSingle()
    return data ? Number(data.rate) : null
  }
  const known = await lookup()
  if (known) return known
  const chart = await fetchChart(fxSymbol(currency), minusDays(date, 10)).catch(() => null)
  if (chart?.closes.length) {
    await service.from("fx_rates").upsert(
      chart.closes.map((c) => ({ base_currency: currency, quote_currency: "EUR", rate: c.close, rate_date: c.date, source: "yahoo" })),
      { onConflict: "base_currency,quote_currency,rate_date" },
    )
  }
  const fetched = await lookup()
  if (!fetched) throw new ManualError(`Geen wisselkoers ${currency}/EUR gevonden voor ${date}`)
  return fetched
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Voegt een handmatig event toe. Vereist de service-role client (instrumenten zijn gedeelde data). */
export async function addManualEvent(
  service: SupabaseClient,
  portfolioId: string,
  input: ManualInput,
): Promise<{ externalId: string; instrumentId: string | null }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date > new Date().toISOString().slice(0, 10)) {
    throw new ManualError("Kies een geldige datum, niet in de toekomst")
  }
  const fee = Math.max(0, input.feeEur ?? 0)
  let instrumentId: string | null = null
  let amountEur: number
  let quantity = 0
  let price: number | null = null
  let currency = "EUR"

  if (input.type === "buy" || input.type === "sell") {
    if (!input.instrument) throw new ManualError("Kies een effect")
    if (!(input.quantity! > 0)) throw new ManualError("Vul een aantal in")
    if (!(input.price! > 0)) throw new ManualError("Vul een koers in")
    instrumentId = await resolveInstrument(service, input.instrument)
    quantity = input.quantity!
    price = input.price!
    currency = (input.currency || "EUR").toUpperCase()
    const gross = quantity * price * (await eurPerUnit(service, currency, input.date))
    amountEur = input.type === "buy" ? -(gross + fee) : gross - fee
  } else {
    if (!(input.amountEur! > 0)) throw new ManualError("Vul een bedrag in")
    if (input.type === "dividend") {
      if (!input.instrument) throw new ManualError("Kies het effect waar het dividend bij hoort")
      instrumentId = await resolveInstrument(service, input.instrument)
    }
    amountEur = input.type === "deposit" || input.type === "dividend" ? input.amountEur! : -input.amountEur!
  }

  const externalId = `manual:${randomUUID()}`
  const { error } = await service.from("ledger_events").insert({
    portfolio_id: portfolioId,
    external_id: externalId,
    event_date: input.date,
    event_type: input.type,
    instrument_id: instrumentId,
    quantity,
    price,
    currency,
    amount_eur: round2(amountEur),
    fee_eur: input.type === "fee" ? round2(-amountEur) : round2(fee),
    note: input.note?.slice(0, 200) || null,
  })
  if (error) throw new ManualError(`Opslaan mislukt: ${error.message}`)
  return { externalId, instrumentId }
}
