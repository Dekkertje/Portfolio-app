"use client"

import { useState } from "react"
import { Eye, Loader2, Plus, Trash2 } from "lucide-react"
import type { InstrumentHit } from "@/app/api/v2/instruments/search/route"
import type { WatchItem } from "@/app/api/v2/watchlist/route"
import { money } from "@/lib/format"
import { displayName } from "@/lib/names"
import { authFetch } from "@/lib/supabase/client"
import { InstrumentPicker } from "./AddTransaction"
import { Sheet } from "./Sheet"
import { Card, Delta, Initials, SectionTitle } from "./ui"
import { useApi } from "./useApi"

/** Effecten volgen die je niet (meer) bezit. Koersmeldingen kun je erop zetten via Notificaties. */
export function Watchlist() {
  const { data, loading, refresh } = useApi<{ items: WatchItem[] }>("/api/v2/watchlist", 60_000)
  const [adding, setAdding] = useState(false)
  const items = data?.items ?? []

  async function remove(id: string) {
    await authFetch(`/api/v2/watchlist?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    refresh()
  }

  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle
        action={
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
            <Plus size={16} /> Toevoegen
          </button>
        }
      >
        Volglijst
      </SectionTitle>

      {loading && !data ? (
        <div className="h-16 animate-pulse rounded-2xl bg-surface-2" />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-8 text-center">
          <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-accent-wash text-accent">
            <Eye size={20} />
          </span>
          <p className="text-[14px] font-medium text-ink">Volg een aandeel dat je (nog) niet hebt</p>
          <p className="mt-1 max-w-xs text-[13px] text-ink-2">Je ziet de koers en het dagresultaat, en bij Notificaties kun je er een koersmelding op zetten.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((w) => (
            <WatchRow key={w.instrumentId} item={w} onRemove={() => remove(w.instrumentId)} />
          ))}
        </ul>
      )}

      {adding && (
        <AddWatchSheet
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false)
            refresh()
          }}
        />
      )}
    </Card>
  )
}

function WatchRow({ item, onRemove }: { item: WatchItem; onRemove: () => void }) {
  const [confirm, setConfirm] = useState(false)
  return (
    <li className="flex items-center gap-3 px-1 py-3">
      <Initials name={displayName(item.name)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-ink">{displayName(item.name)}</p>
        <p className="truncate text-[13px] text-muted">{item.symbol ?? "geen koers"}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[15px] font-semibold text-ink">{item.price != null && item.currency ? money(item.price, item.currency) : "—"}</p>
        {item.dayChangePct != null ? <Delta percent={item.dayChangePct} size="xs" /> : <span className="text-xs text-muted">—</span>}
      </div>
      {confirm ? (
        <button onClick={onRemove} className="h-8 shrink-0 rounded-full bg-down-wash px-3 text-[12px] font-medium text-down">
          Weg?
        </button>
      ) : (
        <button onClick={() => setConfirm(true)} aria-label={`${displayName(item.name)} niet meer volgen`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
          <Trash2 size={15} />
        </button>
      )}
    </li>
  )
}

function AddWatchSheet({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [hit, setHit] = useState<InstrumentHit | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    if (!hit) return
    setBusy(true)
    setError(null)
    const res = await authFetch("/api/v2/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instrument: { id: hit.id ?? undefined, symbol: hit.symbol ?? undefined, isin: hit.isin, name: hit.name } }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) setError(json.error ?? "Toevoegen mislukt")
    else onAdded()
  }

  return (
    <Sheet title="Volgen" onClose={onClose}>
      <div className="flex flex-col gap-4 px-3 pb-4">
        <InstrumentPicker value={hit} onChange={setHit} />
        {error && <p className="rounded-2xl bg-down-wash px-3 py-2 text-[13px] text-down">{error}</p>}
        <button onClick={add} disabled={!hit || busy} className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-surface disabled:opacity-40">
          {busy && <Loader2 size={18} className="animate-spin" />}
          Toevoegen aan volglijst
        </button>
      </div>
    </Sheet>
  )
}
