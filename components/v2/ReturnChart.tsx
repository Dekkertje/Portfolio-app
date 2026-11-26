"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { dateLong, dateMonth, dateShort, pct } from "@/lib/format"
import type { ComparePoint } from "@/lib/portfolio/compare"

const PAD = { top: 12, right: 52, bottom: 26, left: 4 }

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 0.01
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-6; t += step) out.push(Math.abs(t) < 1e-12 ? 0 : t)
  return out
}

/**
 * Cumulatief rendement van jou (blauw) en een index (oranje) op één %-as.
 * Beide reeksen hebben dezelfde eenheid, dus één as is eerlijk.
 */
export function ReturnChart({ points, benchLabel, height = 240 }: { points: ComparePoint[]; benchLabel: string; height?: number }) {
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
    if (points.length < 2 || !width) return null
    const vals = points.flatMap((p) => (p.bench == null ? [p.mine] : [p.mine, p.bench]))
    let min = Math.min(0, ...vals)
    let max = Math.max(0, ...vals)
    const pad = (max - min) * 0.08 || 0.01
    min -= pad
    max += pad
    const ticks = niceTicks(min, max)
    min = Math.min(min, ticks[0])
    max = Math.max(max, ticks.at(-1)!)
    const innerW = width - PAD.left - PAD.right
    const innerH = height - PAD.top - PAD.bottom
    const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW
    const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * innerH
    const path = (get: (p: ComparePoint) => number | null) => {
      let d = ""
      let pen = false
      points.forEach((p, i) => {
        const v = get(p)
        if (v == null) {
          pen = false
          return
        }
        d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`
        pen = true
      })
      return d
    }
    const spanDays = (Date.parse(points.at(-1)!.d) - Date.parse(points[0].d)) / 86_400_000
    const n = Math.max(2, Math.min(5, Math.floor(innerW / 90)))
    const xTicks = Array.from({ length: n }, (_, k) => Math.round((k / (n - 1)) * (points.length - 1)))
    return { x, y, ticks, innerW, innerH, mine: path((p) => p.mine), bench: path((p) => p.bench), xTicks, fmtX: spanDays > 200 ? dateMonth : dateShort }
  }, [points, width, height])

  const indexAt = (clientX: number) => {
    const el = wrap.current
    if (!el || !geo) return null
    const rel = (clientX - el.getBoundingClientRect().left - PAD.left) / geo.innerW
    return Math.max(0, Math.min(points.length - 1, Math.round(rel * (points.length - 1))))
  }

  const last = points.at(-1)
  const a = active != null ? points[active] : null

  return (
    <div ref={wrap} className="relative w-full select-none" style={{ height }}>
      {geo && last && (
        <svg
          width={width}
          height={height}
          role="img"
          tabIndex={0}
          aria-label={`Rendement van ${dateLong(points[0].d)} tot ${dateLong(last.d)}: jij ${pct(last.mine, { sign: true })}${last.bench != null ? `, ${benchLabel} ${pct(last.bench, { sign: true })}` : ""}.`}
          className="block touch-pan-y rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onPointerMove={(e) => setActive(indexAt(e.clientX))}
          onPointerDown={(e) => setActive(indexAt(e.clientX))}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? points.length) - 1))
            else if (e.key === "ArrowRight") setActive((i) => Math.min(points.length - 1, (i ?? points.length - 2) + 1))
            else return
            e.preventDefault()
          }}
        >
          {geo.ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + geo.innerW}
                y1={geo.y(t)}
                y2={geo.y(t)}
                stroke={t === 0 ? "var(--axis)" : "var(--grid)"}
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text x={width - PAD.right + 8} y={geo.y(t)} dy="0.32em" fontSize={11} fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
                {pct(t, { sign: t !== 0, decimals: 0 })}
              </text>
            </g>
          ))}
          {geo.xTicks.map((i, k) => (
            <text key={i} x={geo.x(i)} y={height - 6} fontSize={11} fill="var(--muted)" textAnchor={k === 0 ? "start" : k === geo.xTicks.length - 1 ? "end" : "middle"}>
              {geo.fmtX(points[i].d)}
            </text>
          ))}

          <path d={geo.bench} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={geo.mine} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {a ? (
            <g>
              <line x1={geo.x(active!)} x2={geo.x(active!)} y1={PAD.top} y2={PAD.top + geo.innerH} stroke="var(--axis)" strokeWidth={1} shapeRendering="crispEdges" />
              {a.bench != null && <circle cx={geo.x(active!)} cy={geo.y(a.bench)} r={4.5} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />}
              <circle cx={geo.x(active!)} cy={geo.y(a.mine)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          ) : (
            <>
              {last.bench != null && <circle cx={geo.x(points.length - 1)} cy={geo.y(last.bench)} r={4.5} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />}
              <circle cx={geo.x(points.length - 1)} cy={geo.y(last.mine)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
            </>
          )}
        </svg>
      )}

      {a && geo && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-52 rounded-2xl bg-surface p-3 shadow-lg ring-1 ring-line animate-fade-in"
          style={{ left: Math.min(Math.max(geo.x(active!) - 104, 0), width - 208), transform: geo.y(Math.max(a.mine, a.bench ?? a.mine)) < 110 ? `translateY(${height - 128}px)` : undefined }}
        >
          <p className="text-xs text-muted">{dateLong(a.d)}</p>
          <Row color="var(--accent)" label="Jij" value={a.mine} />
          {a.bench != null && <Row color="var(--series-2)" label={benchLabel} value={a.bench} />}
          {a.bench != null && (
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2 text-xs">
              <span className="text-ink-2">Verschil</span>
              <span className={`font-semibold ${a.mine - a.bench >= 0 ? "text-up" : "text-down"}`}>
                {(a.mine - a.bench >= 0 ? "+" : "−") + Math.abs((a.mine - a.bench) * 100).toLocaleString("nl-NL", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} pp
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="mt-1.5 flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-xs text-ink-2">
        <span className="h-0.5 w-3 rounded-full" style={{ background: color }} aria-hidden />
        {label}
      </span>
      <span className="text-sm font-semibold text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>
        {pct(value, { sign: true })}
      </span>
    </div>
  )
}
