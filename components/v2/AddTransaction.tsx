"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Loader2, Search } from "lucide-react"
import type { InstrumentHit } from "@/app/api/v2/instruments/search/route"
import { eur } from "@/lib/format"
import { displayName } from "@/lib/names"
import { authFetch } from "@/lib/supabase/client"
import { Sheet } from "./Sheet"
import { Segmented } from "./ui"

type Kind = "buy" | "sell" | "dividend" | "deposit" | "withdrawal"

const KINDS: { value: Kind; label: string }[] = [
  { value: "buy", label: "Koop" },
  { value: "sell", label: "Verkoop" },
  { value: "dividend", label: "Dividend" },
  { value: "deposit", label: "Storting" },
  { value: "withdrawal", label: "Opname" },
]

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "DKK", "SEK", "NOK", "CAD", "JPY"]

/** Valuta raden uit de beurs van een Yahoo-zoekresultaat (aanpasbaar in het formulier) */
function guessCurrency(hit: InstrumentHit): string {
  const ex = (hit.exchange ?? "").toLowerCase()
  const sym = hit.symbol ?? ""
  if (/nasdaq|nyse|nms|nyq|amex|bats|otc|cboe/.test(ex) || (sym && !sym.includes("."))) return "USD"
  if (sym.endsWith(".L") || /london|lse/.test(ex)) return "GBP"
  if (sym.endsWith(".SW")) return "CHF"
  return "EUR"
}

const input = "h-12 w-full rounded-2xl bg-surface-2 px-4 text-[15px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
const num = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0

export function AddTransactionSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<Kind>("buy")
  const [instrument, setInstrument] = useState<InstrumentHit | null>(null)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [quantity, setQuantity] = useState("")
  const [price, setPrice] = useState("")
  const [currency, setCurrency] = useState("EUR")
  const [fee, setFee] = useState("")
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsInstrument = kind === "buy" || kind === "sell" || kind === "dividend"
  const isTrade = kind === "buy" || kind === "sell"
  const gross = num(quantity) * num(price)
  const valid = (!needsInstrument || instrument) && (isTrade ? num(quantity) > 0 && num(price) > 0 : num(amount) > 0)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    const res = await authFetch("/api/v2/ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: kind,
        date,
        instrument: instrument ? { id: instrument.id ?? undefined, symbol: instrument.symbol ?? undefined, isin: instrument.isin, name: instrument.name } : undefined,
        quantity: isTrade ? num(quantity) : undefined,
        price: isTrade ? num(price) : undefined,
        currency: isTrade ? currency : undefined,
        feeEur: isTrade ? num(fee) : undefined,
        amountEur: isTrade ? undefined : num(amount),
      }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(json.error ?? `Opslaan mislukt (${res.status})`)
      return
    }
    onSaved()
  }

  return (
    <Sheet title="Transactie toevoegen" onClose={onClose}>
      <form onSubmit={save} className="flex flex-col gap-4 px-3 pb-4">
        <Segmented label="Soort" value={kind} onChange={setKind} options={KINDS} fill />

        {needsInstrument && (
          <InstrumentPicker
            value={instrument}
            onChange={(hit) => {
              setInstrument(hit)
              if (hit && !hit.id) setCurrency(guessCurrency(hit))
            }}
          />
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">Datum</span>
          <input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className={input} required />
        </label>

        {isTrade ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-ink-2">Aantal</span>
                <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="10" className={input} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-ink-2">Koers per stuk</span>
                <div className="flex gap-1.5">
                  <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="125,50" className={`${input} min-w-0`} />
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Valuta" className="h-12 rounded-2xl bg-surface-2 px-2 text-[14px] text-ink outline-none focus:ring-2 focus:ring-accent">
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-2">Kosten (€)</span>
              <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" className={input} />
            </label>
            {gross > 0 && (
              <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
                {currency === "EUR" ? (
                  <>
                    Totaal <span className="font-semibold text-ink">{eur(kind === "buy" ? gross + num(fee) : gross - num(fee))}</span>
                  </>
                ) : (
                  <>
                    {gross.toLocaleString("nl-NL", { style: "currency", currency })} wordt omgerekend met de wisselkoers van {date}
                  </>
                )}
              </p>
            )}
          </>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-2">{kind === "dividend" ? "Netto ontvangen (€)" : "Bedrag (€)"}</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" className={input} />
          </label>
        )}

        {error && <p className="rounded-2xl bg-down-wash px-3 py-2 text-[13px] text-down">{error}</p>}

        <button type="submit" disabled={!valid || busy} className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-surface disabled:opacity-40">
          {busy && <Loader2 size={18} className="animate-spin" />}
          Opslaan
        </button>
        <p className="text-center text-[12px] text-muted">Voor transacties buiten DEGIRO, of een correctie. Een DEGIRO-import voegt zelf alles toe.</p>
      </form>
    </Sheet>
  )
}

function InstrumentPicker({ value, onChange }: { value: InstrumentHit | null; onChange: (hit: InstrumentHit | null) => void }) {
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<InstrumentHit[]>([])
  const [loading, setLoading] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    if (value || q.trim().length < 2) return
    const n = ++seq.current
    const t = setTimeout(async () => {
      setLoading(true)
      const res = await authFetch(`/api/v2/instruments/search?q=${encodeURIComponent(q.trim())}`)
      const json = await res.json().catch(() => ({ hits: [] }))
      // Alleen het antwoord op de laatste zoekopdracht tonen
      if (n === seq.current) {
        setHits(json.hits ?? [])
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, value])

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
        <Check size={18} className="shrink-0 text-up" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-ink">{displayName(value.name)}</p>
          <p className="truncate text-[12px] text-muted">{[value.symbol, value.exchange, value.type].filter(Boolean).join(" · ")}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-[13px] font-medium text-accent">
          Wijzig
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-2">Effect</span>
      <label className="relative flex items-center">
        <Search size={16} className="pointer-events-none absolute left-4 text-muted" />
        <span className="sr-only">Zoek een effect</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Naam, ticker of ISIN" className={`${input} pl-10`} autoComplete="off" />
        {loading && <Loader2 size={16} className="absolute right-4 animate-spin text-muted" />}
      </label>
      {hits.length > 0 && q.trim().length >= 2 && (
        <ul className="max-h-64 overflow-y-auto rounded-2xl ring-1 ring-line">
          {hits.map((h) => (
            <li key={`${h.id ?? ""}${h.symbol}`}>
              <button type="button" onClick={() => onChange(h)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-ink">{displayName(h.name)}</p>
                  <p className="truncate text-[12px] text-muted">{[h.symbol, h.exchange, h.type].filter(Boolean).join(" · ")}</p>
                </div>
                {h.id && <span className="shrink-0 rounded-full bg-accent-wash px-2 py-0.5 text-[11px] font-medium text-accent">bekend</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
