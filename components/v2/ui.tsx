"use client"

import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { eur, pct } from "@/lib/format"

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`rounded-3xl bg-surface ring-1 ring-line ${className}`}>{children}</section>
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{children}</h2>
      {action}
    </div>
  )
}

/** Bedrag dat vervaagt in privacymodus */
export function Private({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { privacyMode } = usePrivacy()
  return <span className={`${privacyMode ? "privacy-blur" : ""} ${className}`}>{children}</span>
}

export function Amount({ value, className = "", decimals = 2, compact }: { value: number; className?: string; decimals?: 0 | 2; compact?: boolean }) {
  return <Private className={className}>{eur(value, { decimals, compact })}</Private>
}

/**
 * Winst/verlies: altijd met teken én pijl, nooit alleen kleur.
 * `variant="pill"` voor een zachte achtergrond.
 */
export function Delta({
  value,
  percent,
  variant = "text",
  className = "",
  size = "sm",
}: {
  value?: number | null
  percent?: number | null
  variant?: "text" | "pill"
  className?: string
  size?: "xs" | "sm" | "md"
}) {
  const basis = percent ?? value ?? 0
  const dir = basis > 0 ? "up" : basis < 0 ? "down" : "flat"
  const color = dir === "up" ? "text-up" : dir === "down" ? "text-down" : "text-ink-2"
  const bg = variant === "pill" ? (dir === "up" ? "bg-up-wash" : dir === "down" ? "bg-down-wash" : "bg-surface-2") : ""
  const Icon = dir === "down" ? ArrowDownRight : ArrowUpRight
  const text = size === "xs" ? "text-xs" : size === "md" ? "text-[15px]" : "text-sm"
  const icon = size === "md" ? 16 : 14

  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap font-medium ${color} ${bg} ${variant === "pill" ? "rounded-full px-2 py-0.5" : ""} ${text} ${className}`}>
      {dir !== "flat" && <Icon size={icon} strokeWidth={2.4} aria-hidden />}
      {value != null && <Private>{eur(value, { sign: true })}</Private>}
      {value != null && percent != null && <span className="opacity-40">·</span>}
      {percent != null && <span>{pct(percent, { sign: true })}</span>}
      <span className="sr-only">{dir === "up" ? "winst" : dir === "down" ? "verlies" : "onveranderd"}</span>
    </span>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  fill = false,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
  /** Knoppen verdelen de volle breedte (voor korte labels, zoals periodes) */
  fill?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`no-scrollbar flex gap-1 ${fill ? "" : "-mx-1 overflow-x-auto px-1"}`}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`h-8 rounded-full text-[13px] font-medium transition-colors ${fill ? "min-w-0 flex-1 px-1 sm:flex-none sm:px-3.5" : "shrink-0 px-3.5"} ${
              active ? "bg-ink text-surface" : "text-ink-2 hover:bg-surface-2"
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Initials({ name }: { name: string }) {
  const letters = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
  return (
    <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-[13px] font-semibold text-ink-2">
      {letters || "?"}
    </span>
  )
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-surface-2 ${className}`} />
}
