"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { eur } from "@/lib/format"

const PAD = { top: 16, right: 4, bottom: 24, left: 4 }
const monthFmt = new Intl.DateTimeFormat("nl-NL", { month: "short", timeZone: "UTC" })
const monthLong = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric", timeZone: "UTC" })

/** Kolommen per maand (één reeks): balk ≤ 24px, afgeronde top, tooltip per kolom. */
export function MonthBars({ months, height = 180 }: { months: { month: string; netEur: number }[]; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)
  const { privacyMode } = usePrivacy()

  useLayoutEffect(() => {
    if (wrap.current) setWidth(wrap.current.getBoundingClientRect().width)
  }, [])
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const max = Math.max(...months.map((m) => m.netEur), 1)
  const innerW = Math.max(0, width - PAD.left - PAD.right)
  const innerH = height - PAD.top - PAD.bottom
  const slot = innerW / months.length
  const barW = Math.min(24, slot * 0.6)
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH
  const best = months.reduce((bi, m, i) => (m.netEur > months[bi].netEur ? i : bi), 0)
  const a = active != null ? months[active] : null

  return (
    <div ref={wrap} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="list" aria-label="Netto dividend per maand, laatste 12 maanden">
          <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="var(--axis)" strokeWidth={1} shapeRendering="crispEdges" />
          {months.map((m, i) => {
            const cx = PAD.left + slot * i + slot / 2
            const h = m.netEur > 0 ? Math.max(2, PAD.top + innerH - y(m.netEur)) : 0
            const top = PAD.top + innerH - h
            const r = Math.min(4, h, barW / 2)
            // Afgeronde bovenhoeken, vierkant op de basislijn
            const d =
              h > 0
                ? `M${cx - barW / 2},${PAD.top + innerH}V${top + r}Q${cx - barW / 2},${top} ${cx - barW / 2 + r},${top}H${cx + barW / 2 - r}Q${cx + barW / 2},${top} ${cx + barW / 2},${top + r}V${PAD.top + innerH}Z`
                : ""
            const isActive = active === i
            return (
              <g
                key={m.month}
                role="listitem"
                tabIndex={0}
                aria-label={`${monthLong.format(new Date(m.month + "-01T00:00:00Z"))}: ${privacyMode ? "verborgen" : eur(m.netEur)}`}
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              >
                {/* hit area: de hele kolom */}
                <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent" />
                {d && <path d={d} fill="var(--accent)" opacity={active == null || isActive ? 1 : 0.45} />}
                {/* label alleen bij de hoogste maand, de rest via tooltip/tabel */}
                {i === best && m.netEur > 0 && active == null && (
                  <text x={cx} y={top - 5} textAnchor="middle" fontSize={11} fill="var(--ink-2)" fontWeight={600}>
                    {privacyMode ? "•••" : eur(m.netEur, { decimals: 0 })}
                  </text>
                )}
                <text x={cx} y={height - 6} textAnchor="middle" fontSize={11} fill={isActive ? "var(--ink)" : "var(--muted)"}>
                  {monthFmt.format(new Date(m.month + "-01T00:00:00Z")).replace(".", "")}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      {a && active != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-xl bg-surface px-3 py-2 shadow-lg ring-1 ring-line animate-fade-in"
          style={{ left: Math.min(Math.max(PAD.left + slot * active + slot / 2 - 70, 0), width - 140), width: 140 }}
        >
          <p className="text-[11px] text-muted">{monthLong.format(new Date(a.month + "-01T00:00:00Z"))}</p>
          <p className="text-sm font-semibold text-ink">{privacyMode ? "•••" : eur(a.netEur)}</p>
        </div>
      )}
    </div>
  )
}
