import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { buildState } from "@/lib/core"
import { classifyAccountDescription, degiroToLedger, latestBalance, parseDegiroAccount, parseDegiroTransactions } from "./degiro"

const TX_HEADER =
  "Datum,Tijd,Product,ISIN,Beurs,Uitvoeringsplaats,Aantal,Koers,,Lokale waarde,,Waarde EUR,Wisselkoers,AutoFX Kosten,Transactiekosten en/of kosten van derden EUR,Totaal EUR,Order ID"
const ACC_HEADER = "Datum,Tijd,Valutadatum,Product,ISIN,Omschrijving,FX,Mutatie,,Saldo,,Order Id"

describe("classifyAccountDescription", () => {
  it.each([
    ["iDEAL Deposit", "deposit"],
    ["iDEAL storting", "deposit"],
    ["Reservation iDEAL", "internal"],
    ["Terugstorting", "withdrawal"],
    ["flatex terugstorting", "withdrawal"],
    ["Processed Flatex Withdrawal", "internal"],
    ["Dividend", "dividend"],
    ["Dividendbelasting", "dividend_tax"],
    ["Koop 9 @ 148,76 EUR", "trade"],
    ["Verkoop 5 @ 331,11 USD", "trade"],
    ["DEGIRO Transactiekosten en/of kosten van derden", "trade"],
    ["SPLIT AANPASSING: 24 CrowdStrike Holdings, Inc. Class A @ 169,825 EUR (US22788C1053)", "trade"],
    ["DEGIRO Aansluitingskosten 2026 (Tradegate AG - TDG)", "fee"],
    ["Flatex Interest Income", "interest"],
    ["Valuta Debitering", "fx_conversion"],
    ["Valuta Creditering", "internal"],
    ["Degiro Cash Sweep Transfer", "internal"],
    ["Overboeking van uw geldrekening bij flatexDEGIRO Bank 1.367,72 EUR", "internal"],
    ["Koersverandering geldmarktfonds (EUR)", "internal"],
    ["Conversie geldmarktfonds: Koop 98,43 @ 1 EUR", "internal"],
    ["Iets heel nieuws van DEGIRO", null],
  ])("%s → %s", (description, kind) => {
    expect(classifyAccountDescription(description)).toBe(kind)
  })
})

describe("degiroToLedger", () => {
  const transactions = [
    TX_HEADER,
    // nieuwste eerst, zoals DEGIRO exporteert
    `02-07-2026,00:00,CROWDSTRIKE,US22788C1053,TDG,,24,"169,8250",EUR,"-4075,80",EUR,"-4075,80","0,0000","0,00",,"-4075,80",`,
    `02-07-2026,00:00,CROWDSTRIKE,US22788C1053,TDG,,-6,"679,3000",EUR,"4075,80",EUR,"4075,80","0,0000","0,00",,"4075,80",`,
    `25-03-2026,20:02,MONGODB,US60937P1066,NDQ,BATS,5,"245,5000",USD,"-1227,50",USD,"-1061,67","1,1562","-2,65","-2,00","-1066,33",c5841a65`,
    `01-02-2026,10:00,CROWDSTRIKE,US22788C1053,TDG,XGAT,6,"500,0000",EUR,"-3000,00",EUR,"-3000,00","0,0000","0,00","-3,90","-3003,90",aaaa`,
  ].join("\n")

  const account = [
    ACC_HEADER,
    `31-10-2026,06:31,30-10-2026,,,Valuta Creditering,,EUR,"0,97",EUR,"73,51",`,
    `31-10-2026,06:31,30-10-2026,,,Valuta Debitering,"1,1187",USD,"-1,09",USD,"0,00",`,
    `30-10-2026,07:17,29-10-2026,MONGODB,US60937P1066,Dividend,,USD,"1,28",USD,"1,09",`,
    `30-10-2026,07:17,29-10-2026,MONGODB,US60937P1066,Dividendbelasting,,USD,"-0,19",USD,"-0,19",`,
    `01-02-2026,10:00,01-02-2026,CROWDSTRIKE,US22788C1053,DEGIRO Transactiekosten en/of kosten van derden,,EUR,"-3,90",EUR,"0,00",aaaa`,
    `01-02-2026,10:00,01-02-2026,CROWDSTRIKE,US22788C1053,"Koop 6 @ 500 EUR",,EUR,"-3000,00",EUR,"3,90",aaaa`,
    `31-01-2026,12:00,31-01-2026,,,iDEAL Deposit,,EUR,"5000,00",EUR,"5000,00",`,
    `31-01-2026,12:00,31-01-2026,,,Reservation iDEAL,,EUR,"-5000,00",EUR,"0,00",`,
    `30-01-2026,12:00,30-01-2026,,,Reservation iDEAL,,EUR,"5000,00",EUR,"5000,00",`,
  ].join("\n")

  const result = degiroToLedger({ transactions, account })
  const state = buildState(result.events)

  it("herkent de split en behoudt de kostprijs", () => {
    expect(result.events.filter((e) => e.type === "split")).toHaveLength(1)
    const crwd = state.positions.get("US22788C1053")!
    expect(crwd.quantity).toBe(24)
    expect(crwd.costBasisEur).toBeCloseTo(3003.9, 6)
    expect(crwd.realizedEur).toBe(0)
  })

  it("neemt EUR-totaal en kosten incl. AutoFX over uit Transacties", () => {
    const mdb = result.events.find((e) => e.instrumentId === "US60937P1066" && e.type === "buy")!
    expect(mdb.amountEur).toBe(-1066.33)
    expect(mdb.feeEur).toBeCloseTo(4.65, 6)
    expect(mdb.currency).toBe("USD")
  })

  it("rekent dollardividend om met de koers van de eerstvolgende valutaconversie", () => {
    const div = result.events.find((e) => e.type === "dividend")!
    expect(div.amountEur).toBeCloseTo(Math.round((1.28 / 1.1187) * 100) / 100, 6)
    expect(state.positions.get("US60937P1066")!.dividendsEur).toBeCloseTo(1.14 - 0.17, 6)
  })

  it("telt een iDEAL-storting één keer, ondanks de reserveringen", () => {
    expect(state.netDepositsEur).toBe(5000)
  })

  it("geeft identieke id's bij opnieuw importeren", () => {
    const again = degiroToLedger({ transactions, account })
    expect(again.events.map((e) => e.id)).toEqual(result.events.map((e) => e.id))
    expect(new Set(result.events.map((e) => e.id)).size).toBe(result.events.length)
  })

  it("waarschuwt bij onbekende regels in plaats van ze stil te negeren", () => {
    const r = degiroToLedger({
      transactions: TX_HEADER,
      account: `${ACC_HEADER}\n01-01-2026,10:00,01-01-2026,,,Nieuw soort boeking,,EUR,"-1,00",EUR,"0,00",`,
    })
    expect(r.warnings).toHaveLength(1)
  })

  it("weigert een verkeerd bestand", () => {
    expect(() => degiroToLedger({ transactions: ACC_HEADER })).toThrow(/Transacties/)
  })
})

// ─── Echte exports (alleen lokaal; fixtures/ staat in .gitignore) ─────────────

const FIXTURES = join(process.cwd(), "fixtures")
const find = (prefix: string) =>
  existsSync(FIXTURES) ? readdirSync(FIXTURES).find((f) => f.startsWith(prefix) && f.endsWith(".csv")) : undefined
const txFile = find("Transactions")
const accFile = find("Account")

describe.runIf(txFile && accFile)("echte DEGIRO-export", () => {
  const transactions = readFileSync(join(FIXTURES, txFile!), "utf8")
  const account = readFileSync(join(FIXTURES, accFile!), "utf8")
  const result = degiroToLedger({ transactions, account })
  const state = buildState(result.events)

  it("heeft geen onbekende regels", () => {
    expect(result.warnings).toEqual([])
  })

  it("cash volgens grootboek sluit aan op het laatste EUR-saldo van DEGIRO (binnen €1)", () => {
    const balance = latestBalance(parseDegiroAccount(account))
    expect(balance).not.toBeNull()
    expect(Math.abs(state.cashEur - balance!)).toBeLessThan(1)
  })

  it("aantallen per positie kloppen met de som uit Transacties", () => {
    const expected = new Map<string, number>()
    for (const t of parseDegiroTransactions(transactions)) expected.set(t.isin, (expected.get(t.isin) ?? 0) + t.quantity)
    for (const [isin, qty] of expected) expect(state.positions.get(isin)?.quantity ?? 0).toBeCloseTo(qty, 6)
  })
})
