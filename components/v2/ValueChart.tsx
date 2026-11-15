"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { dateLong, dateMonth, dateShort, eur } from "@/lib/format"
import type { OverviewPoint } from "@/lib/portfolio/overview"

const PAD = { top: 12, right: 52, bottom: 26, left: 4 }

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || Math.abs(max) || 1
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const ticks: number[] = []
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-6; t += step) ticks.push(t)
  return ticks
}

/** Lijngrafiek van portfoliowaarde en netto inleg, met crosshair-tooltip. */
export function ValueChart({ points, height = 240 }: { points: OverviewPoint[]; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)
  const { privacyMode } = usePrivacy()

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    // Meteen meten (vóór de paint), daarna bijhouden bij resize
    setWidth(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const geo = useMemo(() => {
    if (points.length < 2 || width === 0) return null
    const values = points.flatMap((p) => [p.v, p.n])
    let min = Math.min(...values)
    let max = Math.max(...values)
    const padY = (max - min) * 0.08 || Math.abs(max) * 0.05 || 1
    min = Math.max(0, min - padY)
    max += padY
    const ticks = niceTicks(min, max)
    min = Math.min(min, ticks[0])
    max = Math.max(max, ticks[ticks.length - 1])

    const innerW = width - PAD.left - PAD.right
    const innerH = height - PAD.top - PAD.bottom
    const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW
    const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * innerH

    const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("")
    const area = `${line}L${x(points.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)}L${x(0).toFixed(1)},${(PAD.top + innerH).toFixed(1)}Z`
    // Inleg verandert in stappen (stortingen), dus een trapfunctie
    const invested = points
      .map((p, i) => (i ? `H${x(i).toFixed(1)}V${y(p.n).toFixed(1)}` : `M${x(0).toFixed(1)},${y(p.n).toFixed(1)}`))
      .join("")

    // 3–5 datumlabels, gelijk verdeeld
    const spanDays = (Date.parse(points[points.length - 1].d) - Date.parse(points[0].d)) / 86_400_000
    const labelCount = Math.max(2, Math.min(5, Math.floor(innerW / 90)))
    const xTicks = Array.from({ length: labelCount }, (_, k) => Math.round((k / (labelCount - 1)) * (points.length - 1)))
    const fmtX = spanDays > 200 ? dateMonth : dateShort

    return { x, y, line, area, invested, ticks, xTicks, fmtX, innerH, innerW }
  }, [points, width, height])

  function indexAt(clientX: number) {
    const el = wrap.current
    if (!el || !geo) return null
    const rect = el.getBoundingClientRect()
    const rel = (clientX - rect.left - PAD.left) / geo.innerW
    return Math.max(0, Math.min(points.length - 1, Math.round(rel * (points.length - 1))))
  }

  const last = points[points.length - 1]
  const a = active != null ? points[active] : null

  return (
    <div ref={wrap} className="relative w-full select-none" style={{ height }}>
      {geo && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Portfoliowaarde van ${dateLong(points[0].d)} tot ${dateLong(last.d)}; laatste waarde ${privacyMode ? "verborgen" : eur(last.v, { decimals: 0 })}. Gebruik pijltjestoetsen om door de dagen te lopen.`}
          tabIndex={0}
          className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-xl"
          onPointerMove={(e) => setActive(indexAt(e.clientX))}
          onPointerDown={(e) => setActive(indexAt(e.clientX))}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? points.length) - 1))
            else if (e.key === "ArrowRight") setActive((i) => Math.min(points.length - 1, (i ?? points.length - 2) + 1))
            else if (e.key === "Escape") setActive(null)
            else return
            e.preventDefault()
          }}
        >
          {/* raster */}
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={PAD.left + geo.innerW} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--grid)" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={width - PAD.right + 8} y={geo.y(t)} dy="0.32em" fontSize={11} fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
                {privacyMode ? "•••" : eur(t, { compact: true })}
              </text>
            </g>
          ))}
          {geo.xTicks.map((i, k) => (
            <text
              key={i}
              x={geo.x(i)}
              y={height - 6}
              fontSize={11}
              fill="var(--muted)"
              textAnchor={k === 0 ? "start" : k === geo.xTicks.length - 1 ? "end" : "middle"}
            >
              {geo.fmtX(points[i].d)}
            </text>
          ))}

          {/* data */}
          <path d={geo.area} fill="var(--accent-wash)" />
          <path d={geo.invested} fill="none" stroke="var(--muted)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={geo.line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* crosshair of eindpunt */}
          {a ? (
            <g>
              <line x1={geo.x(active!)} x2={geo.x(active!)} y1={PAD.top} y2={PAD.top + geo.innerH} stroke="var(--axis)" strokeWidth={1} shapeRendering="crispEdges" />
              <circle cx={geo.x(active!)} cy={geo.y(a.n)} r={4} fill="var(--muted)" stroke="var(--surface)" strokeWidth={2} />
              <circle cx={geo.x(active!)} cy={geo.y(a.v)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          ) : (
            <circle cx={geo.x(points.length - 1)} cy={geo.y(last.v)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
          )}
        </svg>
      )}

      {a && geo && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-48 rounded-2xl bg-surface p-3 shadow-lg ring-1 ring-line animate-fade-in"
          style={{
            left: Math.min(Math.max(geo.x(active!) - 96, 0), width - 192),
            transform: geo.y(a.v) < 110 ? `translateY(${height - 132}px)` : undefined,
          }}
        >
          <p className="text-xs text-muted">{dateLong(a.d)}</p>
          <TooltipRow color="var(--accent)" label="Waarde" value={a.v} hidden={privacyMode} />
          <TooltipRow color="var(--muted)" label="Netto inleg" value={a.n} hidden={privacyMode} />
          <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2 text-xs">
            <span className="text-ink-2">Resultaat</span>
            <span className={`font-semibold ${a.v - a.n >= 0 ? "text-up" : "text-down"}`}>
              {privacyMode ? "•••" : eur(a.v - a.n, { sign: true, decimals: 0 })}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function TooltipRow({ color, label, value, hidden }: { color: string; label: string; value: number; hidden: boolean }) {
  return (
    <div className="mt-1.5 flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-xs text-ink-2">
        <span className="h-0.5 w-3 rounded-full" style={{ background: color }} aria-hidden />
        {label}
      </span>
      <span className="text-sm font-semibold text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>
        {hidden ? "•••" : eur(value, { decimals: 0 })}
      </span>
    </div>
  )
}
