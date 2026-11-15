/** Nederlandse opmaak voor bedragen, percentages en datums. */

const eur0 = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
const eur2 = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 })
const eurCompact = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 })

export function eur(value: number, opts: { decimals?: 0 | 2; sign?: boolean; compact?: boolean } = {}): string {
  const f = opts.compact ? eurCompact : opts.decimals === 0 ? eur0 : eur2
  const s = f.format(Math.abs(value))
  if (opts.sign) return (value > 0 ? "+" : value < 0 ? "−" : "") + s
  return value < 0 ? "−" + s : s
}

export function pct(value: number, opts: { sign?: boolean; decimals?: number } = {}): string {
  const s = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: opts.decimals ?? 1,
    maximumFractionDigits: opts.decimals ?? 1,
  }).format(Math.abs(value * 100))
  const sign = opts.sign ? (value > 0 ? "+" : value < 0 ? "−" : "") : value < 0 ? "−" : ""
  return `${sign}${s}%`
}

export function money(value: number, currency: string): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

export function quantity(value: number): string {
  return new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 4 }).format(value)
}

const dayFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const monthFmt = new Intl.DateTimeFormat("nl-NL", { month: "short", year: "2-digit", timeZone: "UTC" })
const shortDayFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", timeZone: "UTC" })

export const dateLong = (iso: string) => dayFmt.format(new Date(iso + "T00:00:00Z"))
export const dateMonth = (iso: string) => monthFmt.format(new Date(iso + "T00:00:00Z"))
export const dateShort = (iso: string) => shortDayFmt.format(new Date(iso + "T00:00:00Z"))

export function timeAgo(isoTimestamp: string): string {
  const d = new Date(isoTimestamp)
  const sameDay = d.toDateString() === new Date().toDateString()
  const time = d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
  return sameDay ? time : `${d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })} ${time}`
}
