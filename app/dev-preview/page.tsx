import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { notFound } from "next/navigation"
import { PreviewClient } from "./PreviewClient"

// Alleen lokaal: toont de nieuwe interface met fixtures/overview.json, zonder login.
// In productie bestaat deze pagina niet.
export default async function DevPreviewPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound()
  const json = await readFile(join(process.cwd(), "fixtures", "overview.json"), "utf8").catch(() => null)
  if (!json) return <p style={{ padding: 24 }}>fixtures/overview.json ontbreekt</p>
  return <PreviewClient data={JSON.parse(json)} page={(await searchParams).page ?? "overzicht"} />
}
