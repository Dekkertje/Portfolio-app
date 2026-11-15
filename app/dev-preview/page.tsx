import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { notFound } from "next/navigation"
import { degiroToLedger } from "@/lib/import/degiro"
import { buildImportPreview } from "@/lib/import/preview"
import { PreviewClient } from "./PreviewClient"

// Alleen lokaal: toont de nieuwe interface met fixtures/overview.json, zonder login.
// In productie bestaat deze pagina niet.
export default async function DevPreviewPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound()
  const json = await readFile(join(process.cwd(), "fixtures", "overview.json"), "utf8").catch(() => null)
  if (!json) return <p style={{ padding: 24 }}>fixtures/overview.json ontbreekt</p>
  const page = (await searchParams).page ?? "overzicht"

  // Importvoorvertoning op de echte exports; doet alsof alles behalve de laatste 12 regels al bestaat
  let importPreview = null
  if (page === "importeren") {
    const dir = join(process.cwd(), "fixtures")
    const [transactions, account] = await Promise.all([
      readFile(join(dir, "Transactions (6).csv"), "utf8"),
      readFile(join(dir, "Account (1).csv"), "utf8"),
    ])
    const parsed = degiroToLedger({ transactions, account })
    const existing = new Set(parsed.events.slice(12).map((e) => e.id))
    const known = new Map([...parsed.instruments.keys()].slice(2).map((isin) => [isin, null] as [string, null]))
    importPreview = buildImportPreview({ ...parsed, existing, known, account })
  }
  return <PreviewClient data={JSON.parse(json)} page={page} importPreview={importPreview} />
}
