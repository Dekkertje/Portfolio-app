"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { dateLong, dateMonth, dateShort, eur, quantity as fmtQty } from "@/lib/format"
import type { PositionDetail, PositionTrade } from "@/lib/portfolio/position"
import { Delta } from "./ui"

/** Resultaat van een trade: verkoop = gerealiseerd, koop = hoe hij er nu voor staat */
export const tradeResult = (t: PositionTrade) => (t.type === "sell" ? t.realizedEur : t.sinceEur)
const resultColor = (t: PositionTrade) => {
  const r = tradeResult(t)
  return r == null || r === 0 ? "var(--ink)" : r > 0 ? "var(--up)" : "var(--down)"
}

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

/**
 * Koers in EUR met aan-/verkoopmarkeringen en de gemiddelde aankoopkoers.
 * Vorm = soort (koop gevuld, verkoop open), kleur = resultaat van die trade.
 */
export function PriceChart({
  series,
  trades,
  avgCost,
  highlightId = null,
  height = 260,
}: {
  series: PositionDetail["series"]
  trades: PositionDetail["trades"]
  avgCost: number | null
  /** Trade die in de lijst gekozen is: gemarkeerd en met tooltip */
  highlightId?: string | null
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

  const highlighted = highlightId ? trades.find((t) => t.id === highlightId) : undefined
  const highlightIndex = highlighted && geo ? (geo.index.get(highlighted.d) ?? null) : null
  const shown = active ?? highlightIndex
  const a = shown != null ? series[shown] : null
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

          {a && (
            <line x1={geo.x(shown!)} x2={geo.x(shown!)} y1={PAD.top} y2={PAD.top + geo.innerH} stroke="var(--axis)" strokeWidth={1} shapeRendering="crispEdges" />
          )}

          {geo.markers.map((m) => (
            <g key={m.id}>
              {m.id === highlightId && <circle cx={m.cx} cy={m.cy} r={10} fill="none" stroke="var(--ink)" strokeWidth={1.5} />}
              {m.type === "buy" ? (
                <circle cx={m.cx} cy={m.cy} r={5} fill={resultColor(m)} stroke="var(--surface)" strokeWidth={2} />
              ) : (
                <circle cx={m.cx} cy={m.cy} r={4.5} fill="var(--surface)" stroke={resultColor(m)} strokeWidth={2.5} />
              )}
            </g>
          ))}

          {a && !tradesOnActive.length && <circle cx={geo.x(shown!)} cy={geo.y(a.p)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />}
        </svg>
      )}

      {a && geo && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-56 rounded-2xl bg-surface p-3 shadow-lg ring-1 ring-line animate-fade-in"
          style={{ left: Math.min(Math.max(geo.x(shown!) - 112, 0), width - 224), transform: geo.y(a.p) < 110 ? `translateY(${height - 140}px)` : undefined }}
        >
          <p className="text-xs text-muted">{dateLong(a.d)}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{eur(a.p)}</p>
          {tradesOnActive.map((t) => (
            <div key={t.id} className="mt-2 border-t border-line pt-2">
              <p className="text-xs text-ink-2">
                {t.type === "buy" ? "Koop" : "Verkoop"} {fmtQty(t.quantity)} × {eur(t.priceEur)}
              </p>
              {tradeResult(t) != null ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  {t.type === "buy" ? (t.openQuantity != null && t.openQuantity < t.quantity - 1e-9 ? `nu (${fmtQty(t.openQuantity)} st.)` : "nu") : "resultaat"}
                  <Delta value={tradeResult(t)} percent={t.returnPct} size="xs" />
                </p>
              ) : t.type === "buy" && t.openQuantity === 0 ? (
                <p className="mt-0.5 text-xs text-muted">Inmiddels verkocht</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
