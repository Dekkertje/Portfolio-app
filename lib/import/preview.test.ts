import { describe, expect, it } from "vitest"
import { degiroToLedger } from "./degiro"
import { buildImportPreview } from "./preview"

const transactions = [
  "Datum,Tijd,Product,ISIN,Beurs,Uitvoeringsplaats,Aantal,Koers,,Lokale waarde,,Waarde EUR,Wisselkoers,AutoFX Kosten,Transactiekosten en/of kosten van derden EUR,Totaal EUR,Order ID",
  `03-02-2026,10:00,ASML HOLDING,NL0010273215,EAM,XAMS,1,"700,0000",EUR,"-700,00",EUR,"-700,00","0,0000","0,00","-2,00","-702,00",b`,
  `02-02-2026,10:00,OUD FONDS,NL0000000001,EAM,XAMS,-5,"10,0000",EUR,"50,00",EUR,"50,00","0,0000","0,00",,"50,00",a2`,
  `01-02-2026,10:00,OUD FONDS,NL0000000001,EAM,XAMS,5,"8,0000",EUR,"-40,00",EUR,"-40,00","0,0000","0,00",,"-40,00",a1`,
].join("\n")
const account = [
  "Datum,Tijd,Valutadatum,Product,ISIN,Omschrijving,FX,Mutatie,,Saldo,,Order Id",
  `31-01-2026,12:00,31-01-2026,,,iDEAL storting,,EUR,"1000,00",EUR,"1000,00",`,
].join("\n")

describe("buildImportPreview", () => {
  const parsed = degiroToLedger({ transactions, account })

  it("telt nieuwe events en zet nieuwe effecten bovenaan", () => {
    const existing = new Set([parsed.events[0].id])
    const p = buildImportPreview({ ...parsed, existing, known: new Map([["NL0010273215", "ASML.AS"]]), account })
    expect(p.total).toBe(4)
    expect(p.newEvents).toBe(3)
    expect(p.counts).toEqual({ buy: 2, sell: 1, deposit: 1 })
    expect(p.period).toEqual({ from: "2026-01-31", to: "2026-02-03" })
    expect(p.instruments.map((i) => [i.isin, i.open, i.known, i.symbol])).toEqual([
      ["NL0000000001", false, false, null],
      ["NL0010273215", true, true, "ASML.AS"],
    ])
  })

  it("vergelijkt cash met het DEGIRO-saldo", () => {
    const p = buildImportPreview({ ...parsed, existing: new Set(), known: new Map(), account })
    // 1000 − 40 + 50 − 702 = 308; het bestand toont als laatste saldo 1000
    expect(p.reconciliation).toEqual({ ledgerCash: 308, degiroBalance: 1000 })
  })
})
