/**
 * Snelle controle van een DEGIRO-import zonder database:
 *   npx tsx scripts/degiro-summary.ts fixtures/Transactions.csv fixtures/Account.csv
 */
import { readFileSync } from "node:fs"
import { buildState } from "@/lib/core"
import { degiroToLedger } from "@/lib/import/degiro"

const [txPath, accountPath] = process.argv.slice(2)
if (!txPath) {
  console.error("Gebruik: npx tsx scripts/degiro-summary.ts <Transactions.csv> [Account.csv]")
  process.exit(1)
}

const result = degiroToLedger({
  transactions: readFileSync(txPath, "utf8"),
  account: accountPath ? readFileSync(accountPath, "utf8") : undefined,
})
const state = buildState(result.events)
const eur = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" })

const counts: Record<string, number> = {}
for (const e of result.events) counts[e.type] = (counts[e.type] ?? 0) + 1
console.log("Events:", counts)

console.log("\nOpen posities:")
for (const p of [...state.positions.values()].filter((p) => p.quantity > 0).sort((a, b) => b.costBasisEur - a.costBasisEur)) {
  const name = result.instruments.get(p.instrumentId)?.name ?? p.instrumentId
  console.log(`  ${name.padEnd(42)} ${String(+p.quantity.toFixed(6)).padStart(8)} st  kostprijs ${eur(p.costBasisEur).padStart(12)}  gem ${eur(p.costBasisEur / p.quantity)}`)
}

const all = [...state.positions.values()]
const sum = (f: (p: (typeof all)[number]) => number) => all.reduce((s, p) => s + f(p), 0)
console.log("\nTotalen:")
console.log("  Kostprijs open posities:", eur(sum((p) => p.costBasisEur)))
console.log("  Gerealiseerd resultaat: ", eur(sum((p) => p.realizedEur)))
console.log("  Dividend (netto):       ", eur(sum((p) => p.dividendsEur)))
console.log("  Transactiekosten:       ", eur(sum((p) => p.feesEur)))
console.log("  Overige kosten:         ", eur(state.otherCostsEur))
console.log("  Rente:                  ", eur(state.interestEur))
console.log("  Netto inleg:            ", eur(state.netDepositsEur))
console.log("  Cash volgens grootboek: ", eur(state.cashEur))

if (result.warnings.length) {
  console.log(`\nWaarschuwingen (${result.warnings.length}):`)
  for (const w of result.warnings) console.log("  -", w)
}
