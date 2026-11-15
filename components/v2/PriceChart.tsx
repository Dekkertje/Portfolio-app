"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { dateLong, dateMonth, dateShort, eur, quantity as fmtQty } from "@/lib/format"
import type { PositionDetail } from "@/lib/portfolio/position"

const PAD = { top: 14, right: 56, bottom: 26, left: 4 }

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || Math.abs(max) || 1
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-6; t += step) out.push(t)
  return out
}

/** Koers in EUR met aan-/verkoopmarkeringen en de gemiddelde aankoopkoers. */
export function PriceChart({
  series,
  trades,
  avgCost,
  height = 260,
}: {
  series: PositionDetail["series"]
  trades: PositionDetail["trades"]
  avgCost: number | null
  height?: number
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)

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

  const geo = useMemo(() => {
    if (series.length < 2 || !width) return null
    const index = new Map(series.map((p, i) => [p.d, i]))
    const visibleTrades = trades.filter((t) => index.has(t.d))
    const values = [...series.map((p) => p.p), ...visibleTrades.map((t) => t.priceEur), ...(avgCost ? [avgCost] : [])]
    let min = Math.min(...values)
    let max = Math.max(...values)
    const pad = (max - min) * 0.08 || max * 0.05 || 1
    min = Math.max(0, min - pad)
    max += pad
    const ticks = niceTicks(min, max)
    min = Math.min(min, ticks[0])
    max = Math.max(max, ticks.at(-1)!)
    const innerW = width - PAD.left - PAD.right
    const innerH = height - PAD.top - PAD.bottom
    const x = (i: number) => PAD.left + (i / (series.length - 1)) * innerW
    const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * innerH
    const line = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.p).toFixed(1)}`).join("")
    const area = `${line}L${x(series.length - 1).toFixed(1)},${PAD.top + innerH}L${x(0).toFixed(1)},${PAD.top + innerH}Z`
    const spanDays = (Date.parse(series.at(-1)!.d) - Date.parse(series[0].d)) / 86_400_000
    const n = Math.max(2, Math.min(5, Math.floor(innerW / 90)))
    const xTicks = Array.from({ length: n }, (_, k) => Math.round((k / (n - 1)) * (series.length - 1)))
    const markers = visibleTrades.map((t) => ({ ...t, cx: x(index.get(t.d)!), cy: y(t.priceEur) }))
    return { x, y, line, area, ticks, xTicks, innerW, innerH, fmtX: spanDays > 200 ? dateMonth : dateShort, markers, index }
  }, [series, trades, avgCost, width, height])

  const indexAt = (clientX: number) => {
    const el = wrap.current
    if (!el || !geo) return null
    const rel = (clientX - el.getBoundingClientRect().left - PAD.left) / geo.innerW
    return Math.max(0, Math.min(series.length - 1, Math.round(rel * (series.length - 1))))
  }

  const a = active != null ? series[active] : null
  const tradesOnActive = a ? trades.filter((t) => t.d === a.d) : []

  return (
    <div ref={wrap} className="relative w-full select-none" style={{ height }}>
      {geo && (
        <svg
          width={width}
          height={height}
          role="img"
          tabIndex={0}
          aria-label={`Koersverloop in euro van ${dateLong(series[0].d)} tot ${dateLong(series.at(-1)!.d)}, met ${trades.length} aan- en verkopen. Pijltjestoetsen lopen door de dagen.`}
          className="block touch-pan-y rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onPointerMove={(e) => setActive(indexAt(e.clientX))}
          onPointerDown={(e) => setActive(indexAt(e.clientX))}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? series.length) - 1))
            else if (e.key === "ArrowRight") setActive((i) => Math.min(series.length - 1, (i ?? series.length - 2) + 1))
            else return
            e.preventDefault()
          }}
        >
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={PAD.left + geo.innerW} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--grid)" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={width - PAD.right + 8} y={geo.y(t)} dy="0.32em" fontSize={11} fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
                {eur(t, { decimals: t < 10 ? 2 : 0 })}
              </text>
            </g>
          ))}
          {geo.xTicks.map((i, k) => (
            <text key={i} x={geo.x(i)} y={height - 6} fontSize={11} fill="var(--muted)" textAnchor={k === 0 ? "start" : k === geo.xTicks.length - 1 ? "end" : "middle"}>
              {geo.fmtX(series[i].d)}
            </text>
          ))}

          <path d={geo.area} fill="var(--accent-wash)" />
          {avgCost != null && (
            <line x1={PAD.left} x2={PAD.left + geo.innerW} y1={geo.y(avgCost)} y2={geo.y(avgCost)} stroke="var(--muted)" strokeWidth={1.5} shapeRendering="crispEdges" />
          )}
          <path d={geo.line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {geo.markers.map((m, k) =>
            m.type === "buy" ? (
              <circle key={k} cx={m.cx} cy={m.cy} r={4.5} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
            ) : (
              <circle key={k} cx={m.cx} cy={m.cy} r={4.5} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2} />
            ),
          )}

          {a && (
            <g>
              <line x1={geo.x(active!)} x2={geo.x(active!)} y1={PAD.top} y2={PAD.top + geo.innerH} stroke="var(--axis)" strokeWidth={1} shapeRendering="crispEdges" />
              <circle cx={geo.x(active!)} cy={geo.y(a.p)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}

      {a && geo && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-48 rounded-2xl bg-surface p-3 shadow-lg ring-1 ring-line animate-fade-in"
          style={{ left: Math.min(Math.max(geo.x(active!) - 96, 0), width - 192), transform: geo.y(a.p) < 100 ? `translateY(${height - 120}px)` : undefined }}
        >
          <p className="text-xs text-muted">{dateLong(a.d)}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{eur(a.p)}</p>
          {tradesOnActive.map((t, k) => (
            <p key={k} className="mt-1 text-xs text-ink-2">
              {t.type === "buy" ? "Koop" : "Verkoop"} {fmtQty(t.quantity)} × {eur(t.priceEur)}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
