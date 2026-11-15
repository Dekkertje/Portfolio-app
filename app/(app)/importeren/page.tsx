"use client"

import { useMemo } from "react"
import type { ImportBatch } from "@/app/api/v2/import/route"
import { ImportView, type ImportApi, type ImportFiles } from "@/components/v2/ImportView"
import { invalidatePortfolio } from "@/components/v2/usePortfolio"
import { authFetch } from "@/lib/supabase/client"

async function post(files: ImportFiles, dryRun: boolean) {
  const res = await authFetch("/api/v2/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transactions: files.transactions?.text,
      account: files.account?.text,
      fileNames: [files.transactions?.name, files.account?.name].filter(Boolean),
      dryRun,
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json
}

export default function ImporterenPage() {
  const api = useMemo<ImportApi>(
    () => ({
      preview: (files) => post(files, true),
      commit: (files) => post(files, false),
      history: async () => {
        const res = await authFetch("/api/v2/import")
        return res.ok ? ((await res.json()).batches as ImportBatch[]) : []
      },
    }),
    [],
  )
  return <ImportView api={api} onImported={() => invalidatePortfolio()} />
}
