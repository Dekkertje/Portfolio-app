"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { AlertTriangle, Check, ChevronDown, FileSpreadsheet, Loader2, Upload, X } from "lucide-react"
import type { ImportBatch, ImportPreview, ImportResult } from "@/app/api/v2/import/route"
import { detectDegiroFile } from "@/lib/import/detect"
import { dateLong, eur, timeAgo } from "@/lib/format"
import { displayName } from "./PositionList"
import { Card, Private, SectionTitle } from "./ui"

export type ImportFiles = { transactions?: { name: string; text: string }; account?: { name: string; text: string } }

export type ImportApi = {
  preview: (files: ImportFiles) => Promise<ImportPreview>
  commit: (files: ImportFiles) => Promise<ImportResult>
  history: () => Promise<ImportBatch[]>
}

const TYPE_LABELS: Record<string, string> = {
  buy: "Kopen",
  sell: "Verkopen",
  dividend: "Dividend",
  dividend_tax: "Bronbelasting",
  deposit: "Stortingen",
  withdrawal: "Opnames",
  fee: "Kosten",
  interest: "Rente",
  split: "Splits",
}

export function ImportView({
  api,
  initial,
  onImported,
}: {
  api: ImportApi
  initial?: { files?: ImportFiles; preview?: ImportPreview; result?: ImportResult }
  onImported?: () => void
}) {
  const [files, setFiles] = useState<ImportFiles>(initial?.files ?? {})
  const [preview, setPreview] = useState<ImportPreview | null>(initial?.preview ?? null)
  const [result, setResult] = useState<ImportResult | null>(initial?.result ?? null)
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rejected, setRejected] = useState<string[]>([])
  const [history, setHistory] = useState<ImportBatch[]>([])

  useEffect(() => {
    api.history().then(setHistory).catch(() => {})
  }, [api, result])

  const runPreview = useCallback(
    async (next: ImportFiles) => {
      if (!next.transactions) return
      setBusy("preview")
      setError(null)
      try {
        setPreview(await api.preview(next))
      } catch (e) {
        setPreview(null)
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(null)
      }
    },
    [api],
  )

  async function addFiles(list: FileList | File[]) {
    const next: ImportFiles = { ...files }
    const bad: string[] = []
    for (const file of Array.from(list)) {
      const text = await file.text()
      const kind = detectDegiroFile(text)
      if (kind) next[kind] = { name: file.name, text }
      else bad.push(file.name)
    }
    setRejected(bad)
    setResult(null)
    setFiles(next)
    runPreview(next)
  }

  function removeFile(kind: keyof ImportFiles) {
    const next = { ...files, [kind]: undefined }
    setFiles(next)
    setResult(null)
    if (next.transactions) runPreview(next)
    else setPreview(null)
  }

  async function commit() {
    setBusy("commit")
    setError(null)
    try {
      setResult(await api.commit(files))
      setPreview(null)
      setFiles({})
      onImported?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-5 pt-6 lg:pt-10">
      <header className="px-1">
        <h1 className="text-[28px] font-semibold tracking-tight lg:text-[32px]">Importeren</h1>
        <p className="text-[13px] text-muted">Lees je DEGIRO-exports in. Al geïmporteerde regels worden overgeslagen.</p>
      </header>

      {result && <ResultCard result={result} />}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] [&>*]:min-w-0">
        <div className="flex flex-col gap-5">
          <Card className="p-4 sm:p-6">
            <DropZone onFiles={addFiles} />
            {rejected.length > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-2xl bg-down-wash px-3 py-2 text-[13px] text-down">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                Niet herkend als DEGIRO-export: {rejected.join(", ")}
              </p>
            )}
            <ul className="mt-4 flex flex-col gap-2">
              <FileSlot
                label="Transacties"
                hint="Verplicht — al je kopen en verkopen"
                file={files.transactions}
                onRemove={() => removeFile("transactions")}
              />
              <FileSlot
                label="Rekeningoverzicht"
                hint="Aanbevolen — stortingen, dividend en kosten, voor je echte rendement"
                file={files.account}
                onRemove={() => removeFile("account")}
              />
            </ul>
          </Card>

          {error && (
            <Card className="flex items-start gap-3 p-4 text-sm">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-down" />
              <div>
                <p className="font-medium text-ink">Dat ging niet goed</p>
                <p className="text-ink-2">{error}</p>
              </div>
            </Card>
          )}

          {busy === "preview" && !preview && (
            <Card className="flex items-center gap-3 p-6 text-sm text-ink-2">
              <Loader2 size={18} className="animate-spin" /> Bestanden controleren…
            </Card>
          )}

          {preview && <PreviewCard preview={preview} busy={busy} onCommit={commit} />}
        </div>

        <div className="flex flex-col gap-5">
          <HowTo />
          {history.length > 0 && <HistoryCard history={history} />}
        </div>
      </div>
    </div>
  )
}

function DropZone({ onFiles }: { onFiles: (files: FileList) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
      }}
      className={`flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        over ? "border-accent bg-accent-wash" : "border-grid hover:border-muted hover:bg-surface-2/50"
      }`}
    >
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-accent-wash text-accent">
        <Upload size={22} />
      </span>
      <span className="text-[15px] font-medium text-ink">Kies of sleep je CSV-bestanden</span>
      <span className="mt-1 text-[13px] text-muted">Beide tegelijk mag — we herkennen zelf welk bestand wat is</span>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files)
          e.target.value = ""
        }}
      />
    </button>
  )
}

function FileSlot({ label, hint, file, onRemove }: { label: string; hint: string; file?: { name: string }; onRemove: () => void }) {
  return (
    <li className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${file ? "bg-surface-2" : "ring-1 ring-line"}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${file ? "bg-up-wash text-up" : "bg-surface-2 text-muted"}`}>
        {file ? <Check size={18} strokeWidth={2.5} /> : <FileSpreadsheet size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-ink">{label}</p>
        <p className="truncate text-[12px] text-muted">{file ? file.name : hint}</p>
      </div>
      {file && (
        <button onClick={onRemove} aria-label={`${label} verwijderen`} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink">
          <X size={16} />
        </button>
      )}
    </li>
  )
}

function PreviewCard({ preview, busy, onCommit }: { preview: ImportPreview; busy: "preview" | "commit" | null; onCommit: () => void }) {
  const [showAll, setShowAll] = useState(false)
  const rec = preview.reconciliation
  const diff = rec ? Math.abs(rec.ledgerCash - rec.degiroBalance) : 0
  const newInstruments = preview.instruments.filter((i) => !i.known)
  const shown = showAll ? preview.instruments : preview.instruments.filter((i) => i.open || !i.known).slice(0, 8)

  return (
    <Card className={`p-4 transition-opacity sm:p-6 ${busy === "preview" ? "opacity-60" : ""}`}>
      <p className="text-[13px] text-ink-2">Voorvertoning</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">
        {preview.newEvents === 0 ? "Alles is al geïmporteerd" : `${preview.newEvents} nieuwe regels`}
      </p>
      <p className="text-[13px] text-muted">
        {preview.total} regels in totaal
        {preview.period && ` · ${dateLong(preview.period.from)} – ${dateLong(preview.period.to)}`}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {Object.entries(preview.counts).map(([type, n]) => (
          <span key={type} className="rounded-full bg-surface-2 px-3 py-1 text-[12px] text-ink-2">
            {TYPE_LABELS[type] ?? type} <span className="font-semibold text-ink">{n}</span>
          </span>
        ))}
      </div>

      {rec && (
        <div className={`mt-4 flex items-start gap-3 rounded-2xl p-3 ${diff < 1 ? "bg-up-wash" : "bg-down-wash"}`}>
          <span className={`mt-0.5 ${diff < 1 ? "text-up" : "text-down"}`}>{diff < 1 ? <Check size={18} strokeWidth={2.5} /> : <AlertTriangle size={18} />}</span>
          <div className="text-[13px]">
            <p className="font-medium text-ink">{diff < 1 ? "Cash sluit aan op DEGIRO" : `Cash wijkt ${eur(diff)} af van DEGIRO`}</p>
            <p className="text-ink-2">
              Volgens bestand <Private>{eur(rec.ledgerCash)}</Private> · DEGIRO-saldo <Private>{eur(rec.degiroBalance)}</Private>
              {diff >= 1 && " — exporteer het rekeningoverzicht vanaf de opening van je rekening."}
            </p>
          </div>
        </div>
      )}
      {!preview.hasAccount && (
        <p className="mt-4 rounded-2xl bg-surface-2 p-3 text-[13px] text-ink-2">
          Zonder rekeningoverzicht ontbreken stortingen, dividend en kosten. Je posities kloppen wel, maar het rendement is minder nauwkeurig.
        </p>
      )}

      <div className="mt-5">
        <SectionTitle
          action={
            preview.instruments.length > shown.length || showAll ? (
              <button onClick={() => setShowAll(!showAll)} className="flex items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
                {showAll ? "Minder" : `Alle ${preview.instruments.length}`}
                <ChevronDown size={14} className={showAll ? "rotate-180" : ""} />
              </button>
            ) : null
          }
        >
          Effecten{newInstruments.length > 0 && <span className="ml-2 text-[13px] font-normal text-muted">{newInstruments.length} nieuw</span>}
        </SectionTitle>
        <ul className="divide-y divide-line">
          {shown.map((i) => (
            <li key={i.isin} className="flex items-center gap-3 px-1 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] text-ink">{displayName(i.name)}</p>
                <p className="text-[12px] text-muted">
                  {i.isin}
                  {i.symbol && ` · ${i.symbol}`}
                </p>
              </div>
              {!i.known ? (
                <span className="rounded-full bg-accent-wash px-2 py-0.5 text-[11px] font-medium text-accent">Nieuw</span>
              ) : !i.open ? (
                <span className="text-[11px] text-muted">gesloten</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {preview.warnings.length > 0 && (
        <details className="mt-4 rounded-2xl bg-surface-2 p-3 text-[13px]">
          <summary className="cursor-pointer font-medium text-ink">{preview.warnings.length} waarschuwingen</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
            {preview.warnings.slice(0, 50).map((w, k) => (
              <li key={k}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      {/* Op mobiel plakt de knop boven de tabbalk */}
      <div className="sticky bottom-20 z-10 -mx-1 mt-5 lg:static">
        <button
          onClick={onCommit}
          disabled={busy !== null || preview.newEvents === 0}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-surface shadow-lg transition disabled:opacity-40 lg:shadow-none"
        >
          {busy === "commit" && <Loader2 size={18} className="animate-spin" />}
          {busy === "commit" ? "Importeren en koersen ophalen…" : preview.newEvents === 0 ? "Niets nieuw om te importeren" : `${preview.newEvents} regels importeren`}
        </button>
      </div>
    </Card>
  )
}

function ResultCard({ result }: { result: ImportResult }) {
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-up-wash text-up">
          <Check size={20} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold text-ink">Import gelukt</p>
          <p className="text-[13px] text-ink-2">
            {result.inserted} nieuwe regels toegevoegd{result.total > result.inserted && `, ${result.total - result.inserted} bijgewerkt`}.
            {result.prices > 0 && ` ${result.prices} koersen opgehaald.`}
          </p>
          {result.matched.length > 0 && (
            <p className="mt-2 text-[13px] text-ink-2">
              Gekoppeld: {result.matched.map((m) => `${displayName(m.name)} (${m.symbol})`).join(", ")}
            </p>
          )}
          {result.unmatched.length > 0 && (
            <p className="mt-2 flex items-start gap-2 rounded-2xl bg-down-wash px-3 py-2 text-[13px] text-down">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Geen koers gevonden voor {result.unmatched.map((m) => displayName(m.name)).join(", ")}. Deze tellen tegen kostprijs.
            </p>
          )}
          <Link href="/overzicht" className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-sm font-medium text-surface">
            Naar overzicht
          </Link>
        </div>
      </div>
    </Card>
  )
}

function HowTo() {
  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle>Zo exporteer je uit DEGIRO</SectionTitle>
      <ol className="flex flex-col gap-3 text-[13px] text-ink-2">
        {[
          "Log in op DEGIRO in je browser (niet de app).",
          "Ga naar Postvak → Transacties, kies als begindatum de opening van je rekening, en klik Exporteren → CSV.",
          "Ga naar Postvak → Rekeningoverzicht, kies dezelfde periode en exporteer ook als CSV.",
          "Sleep beide bestanden hierheen.",
        ].map((step, k) => (
          <li key={k} className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold text-ink">{k + 1}</span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[12px] text-muted">Later opnieuw importeren is veilig: regels die er al zijn worden niet dubbel toegevoegd.</p>
    </Card>
  )
}

function HistoryCard({ history }: { history: ImportBatch[] }) {
  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle>Eerdere imports</SectionTitle>
      <ul className="divide-y divide-line">
        {history.map((b) => (
          <li key={b.id} className="py-2.5 text-[13px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-ink">{b.source === "migration" ? "Overgezet uit oude versie" : "DEGIRO-import"}</span>
              <span className="shrink-0 text-muted">{timeAgo(b.created_at)}</span>
            </div>
            <p className="text-muted">
              {b.inserted_count} nieuw van {b.event_count}
              {b.file_names.length > 0 && ` · ${b.file_names.join(", ")}`}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  )
}
