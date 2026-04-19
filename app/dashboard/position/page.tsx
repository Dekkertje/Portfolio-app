"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts"
import { ArrowLeft, ExternalLink, TrendingUp, TrendingDown } from "lucide-react"
import { useTheme } from "@/contexts/ThemeContext"
import type { YahooDetailedMetrics, YahooNewsItem, YahooChartPoint } from "@/lib/providers/yahoo"

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartRange = "1wk" | "1mo" | "3mo" | "6mo" | "1y" | "5y"

const RANGES: { label: string; value: ChartRange }[] = [
  { label: "1W",  value: "1wk" },
  { label: "1M",  value: "1mo" },
  { label: "3M",  value: "3mo" },
  { label: "6M",  value: "6mo" },
  { label: "1J",  value: "1y"  },
  { label: "5J",  value: "5y"  },
]

// ─── Helper formatters ────────────────────────────────────────────────────────

function fmtEur(v: number | null, decimals = 2): string {
  if (v === null) return "–"
  return new Intl.NumberFormat("nl-NL", {
    style: "currency", currency: "EUR", maximumFractionDigits: decimals,
  }).format(v)
}

function fmtNum(v: number | null, decimals = 2): string {
  if (v === null) return "–"
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(v)
}

function fmtLarge(v: number | null): string {
  if (v === null) return "–"
  if (v >= 1e12) return `€${(v / 1e12).toFixed(2)}B`  // biljoen
  if (v >= 1e9)  return `€${(v / 1e9).toFixed(2)}mrd`
  if (v >= 1e6)  return `€${(v / 1e6).toFixed(1)}mln`
  return fmtEur(v)
}

function fmtPct(v: number | null, decimals = 2): string {
  if (v === null) return "–"
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 60)   return `${mins}m geleden`
  if (hours < 24)  return `${hours}u geleden`
  if (days < 7)    return `${days}d geleden`
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-white dark:bg-[#0d1829] p-4 ring-1 ring-slate-200 dark:ring-[#1a2744]">
      <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</span>
      {sub && <span className="text-xs text-slate-400 dark:text-slate-500">{sub}</span>}
    </div>
  )
}

function ConsensusBadge({ rec }: { rec: string | null }) {
  const map: Record<string, { label: string; color: string }> = {
    strong_buy:   { label: "Sterk Kopen",   color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    buy:          { label: "Kopen",          color: "bg-green-500/20   text-green-400   border-green-500/30"   },
    hold:         { label: "Houden",         color: "bg-yellow-500/20  text-yellow-400  border-yellow-500/30"  },
    underperform: { label: "Onderperform",   color: "bg-orange-500/20  text-orange-400  border-orange-500/30"  },
    sell:         { label: "Verkopen",       color: "bg-red-500/20     text-red-400     border-red-500/30"     },
  }
  const entry = rec ? (map[rec] ?? { label: rec, color: "bg-slate-500/20 text-slate-400 border-slate-500/30" }) : null
  if (!entry) return <span className="text-sm text-slate-400">–</span>
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${entry.color}`}>
      {entry.label}
    </span>
  )
}

function AnalystBar({ strongBuy, buy, hold, sell, strongSell }: {
  strongBuy: number; buy: number; hold: number; sell: number; strongSell: number
}) {
  const total = strongBuy + buy + hold + sell + strongSell
  if (total === 0) return <span className="text-sm text-slate-400">Geen data</span>

  const pct = (n: number) => `${((n / total) * 100).toFixed(0)}%`

  const segments = [
    { count: strongBuy,  color: "bg-emerald-500", label: "Sterk Kopen"  },
    { count: buy,        color: "bg-green-400",   label: "Kopen"         },
    { count: hold,       color: "bg-yellow-400",  label: "Houden"        },
    { count: sell,       color: "bg-orange-400",  label: "Verkopen"      },
    { count: strongSell, color: "bg-red-500",     label: "Sterk Verkopen"},
  ].filter(s => s.count > 0)

  return (
    <div className="space-y-2">
      <div className="flex h-4 w-full overflow-hidden rounded-full gap-0.5">
        {segments.map(s => (
          <div
            key={s.label}
            title={`${s.label}: ${s.count}`}
            className={`${s.color} transition-all`}
            style={{ width: `${(s.count / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
        {segments.map(s => (
          <span key={s.label}>
            <span className="font-medium text-slate-200">{s.count}</span> {s.label} ({pct(s.count)})
          </span>
        ))}
      </div>
    </div>
  )
}

function NewsCard({ item }: { item: YahooNewsItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 p-4 rounded-xl bg-white dark:bg-[#0d1829] ring-1 ring-slate-200 dark:ring-[#1a2744] hover:ring-slate-400 dark:hover:ring-[#2a3a5e] transition-all group"
    >
      {item.thumbnail && (
        <img
          src={item.thumbnail}
          alt=""
          className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-slate-100 dark:bg-slate-800"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
        />
      )}
      <div className="flex flex-col gap-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
          {item.title}
          <ExternalLink className="inline h-3 w-3 ml-1 opacity-50" />
        </p>
        <p className="text-xs text-slate-400">
          {item.publisher} · {relativeTime(item.publishedAt)}
        </p>
      </div>
    </a>
  )
}

// ─── Chart ────────────────────────────────────────────────────────────────────

function PriceChart({
  data, symbol, avgPrice, currency, range, onRangeChange, loading,
}: {
  data: YahooChartPoint[]
  symbol: string
  avgPrice: number | null
  currency: string
  range: ChartRange
  onRangeChange: (r: ChartRange) => void
  loading: boolean
}) {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  const prices   = data.map(d => d.price)
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const padding  = (maxPrice - minPrice) * 0.05

  const firstPrice = data[0]?.price ?? null
  const lastPrice  = data[data.length - 1]?.price ?? null
  const change     = firstPrice && lastPrice ? ((lastPrice - firstPrice) / firstPrice) * 100 : null
  const positive   = change === null ? true : change >= 0

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    if (range === "5y") return `${d.toLocaleString("nl-NL", { month: "short" })} '${String(d.getFullYear()).slice(2)}`
    if (range === "1y") return `${d.getDate()} ${d.toLocaleString("nl-NL", { month: "short" })}`
    return `${d.getDate()} ${d.toLocaleString("nl-NL", { month: "short" })}`
  }

  const step   = Math.max(1, Math.floor(data.length / 6))
  const xTicks = data.filter((_, i) => i % step === 0 || i === data.length - 1).map(d => d.date)

  const lineColor   = positive ? "#a3e635" : "#f87171"
  const gradientId  = `grad-${symbol}`

  return (
    <div className="rounded-xl bg-white dark:bg-[#0d1829] ring-1 ring-slate-200 dark:ring-[#1a2744] p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {change !== null && (
            <span className={`flex items-center gap-1 text-sm font-semibold ${positive ? "text-lime-400" : "text-red-400"}`}>
              {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {fmtPct(change)}
            </span>
          )}
          <span className="text-xs text-slate-400">deze periode</span>
        </div>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => onRangeChange(r.value)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                range === r.value
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2744]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-52">
        {loading ? (
          <div className="flex h-full items-center justify-center text-slate-400 text-sm gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            Laden…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={lineColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1a2744" : "#e2e8f0"} />
              <XAxis
                dataKey="date"
                ticks={xTicks}
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: isDark ? "#64748b" : "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[minPrice - padding, maxPrice + padding]}
                tick={{ fontSize: 11, fill: isDark ? "#64748b" : "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toFixed(v < 10 ? 2 : 0)}
                width={52}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? "#0d1829" : "white",
                  border: `1px solid ${isDark ? "#1a2744" : "#e2e8f0"}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelFormatter={(label) => {
                  const d = new Date(label as string)
                  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })
                }}
                formatter={(val) => [`${currency} ${Number(val).toFixed(2)}`, "Prijs"]}
              />
              {avgPrice && avgPrice > 0 && (
                <ReferenceLine
                  y={avgPrice}
                  stroke="#6366f1"
                  strokeDasharray="4 3"
                  label={{ value: "Gem. aankoopprijs", position: "insideTopLeft", fontSize: 10, fill: "#6366f1" }}
                />
              )}
              <Area
                type="monotone"
                dataKey="price"
                stroke={lineColor}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 4, fill: lineColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

// ─── Main content (uses useSearchParams) ─────────────────────────────────────

function PositionDetailContent() {
  const router       = useRouter()
  const params       = useSearchParams()
  const { theme }    = useTheme()

  const product   = params.get("product") ?? ""
  const isin      = params.get("isin") || null
  const isCrypto  = params.get("isCrypto") === "true"
  const qty       = parseFloat(params.get("qty") ?? "0")
  const avgPrice  = parseFloat(params.get("avgPrice") ?? "0") || null
  const posValue  = parseFloat(params.get("value") ?? "0")
  const posPnl    = parseFloat(params.get("pnl") ?? "0")
  const passedSymbol = params.get("yahooSymbol") || null

  const [loading,      setLoading]      = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [symbol,       setSymbol]       = useState<string | null>(passedSymbol)
  const [metrics,      setMetrics]      = useState<YahooDetailedMetrics | null>(null)
  const [news,         setNews]         = useState<YahooNewsItem[]>([])
  const [chart,        setChart]        = useState<YahooChartPoint[]>([])
  const [range,        setRange]        = useState<ChartRange>("1y")

  // Initial load
  useEffect(() => {
    if (!product) return
    const qs = new URLSearchParams({ product })
    if (isin)          qs.set("isin", isin)
    if (passedSymbol)  qs.set("yahooSymbol", passedSymbol)

    setLoading(true)
    setError(null)

    fetch(`/api/position-detail?${qs}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setSymbol(data.symbol)
        setMetrics(data.metrics)
        setNews(data.news ?? [])
        setChart(data.chart ?? [])
      })
      .catch(() => setError("Fout bij ophalen van data"))
      .finally(() => setLoading(false))
  }, [product, isin, passedSymbol])

  // Chart range switch
  const handleRangeChange = useCallback((newRange: ChartRange) => {
    if (!symbol || newRange === range) return
    setRange(newRange)
    setChartLoading(true)
    fetch(`/api/position-chart?symbol=${encodeURIComponent(symbol)}&range=${newRange}`)
      .then(r => r.json())
      .then(data => setChart(data.chart ?? []))
      .catch(() => {})
      .finally(() => setChartLoading(false))
  }, [symbol, range])

  const isDark = theme === "dark"

  // ── Derived position stats ──────────────────────────────────────────────────
  const pnlPct      = posValue > 0 && posPnl !== 0 ? (posPnl / (posValue - posPnl)) * 100 : null
  const posPositive = posPnl >= 0

  // ── Loading / error states ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-3 text-slate-400">
        <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <span>Gegevens laden…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error}</p>
        <button onClick={() => router.back()} className="text-sm text-indigo-400 hover:underline">
          ← Terug
        </button>
      </div>
    )
  }

  const m = metrics
  const displayCurrency = m?.currency ?? "EUR"

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 px-6 py-6 max-w-5xl mx-auto">

      {/* Back + header */}
      <div className="space-y-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar dashboard
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {m?.name ?? product}
              </h1>
              {isCrypto && (
                <span className="rounded-full bg-orange-500/20 px-2.5 py-0.5 text-xs font-semibold text-orange-400 border border-orange-500/30">Crypto</span>
              )}
              {m?.quoteType === "ETF" && (
                <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs font-semibold text-purple-400 border border-purple-500/30">ETF</span>
              )}
              {symbol && (
                <span className="rounded-full bg-slate-500/20 px-2.5 py-0.5 text-xs font-medium text-slate-400 border border-slate-500/30">
                  {symbol}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              {m?.exchange ?? ""}{isin ? ` · ISIN: ${isin}` : ""}
            </p>
          </div>

          {/* Current price */}
          {m && (
            <div className="text-right">
              <div className="text-3xl font-bold text-slate-900 dark:text-white">
                {displayCurrency} {m.currentPrice.toFixed(m.currentPrice < 10 ? 4 : 2)}
              </div>
              <div className={`flex items-center justify-end gap-1 text-sm font-medium mt-0.5 ${m.dayChange >= 0 ? "text-lime-400" : "text-red-400"}`}>
                {m.dayChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {m.dayChange >= 0 ? "+" : ""}{m.dayChange.toFixed(2)} ({fmtPct(m.dayChangePercent)})
                <span className="text-xs text-slate-400 font-normal ml-1">vandaag</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Your position summary (if data passed) */}
      {qty > 0 && (
        <div className={`rounded-xl ring-1 p-4 flex flex-wrap gap-6 ${
          isDark
            ? "bg-[#0d1829] ring-[#1a2744]"
            : "bg-white ring-slate-200"
        }`}>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Jouw positie</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {qty.toLocaleString("nl-NL", { maximumFractionDigits: 4 })} stuks
              {avgPrice ? ` @ ${displayCurrency} ${avgPrice.toFixed(avgPrice < 10 ? 4 : 2)}` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Huidige waarde</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{fmtEur(posValue)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Winst / Verlies</p>
            <p className={`text-sm font-semibold ${posPositive ? "text-lime-400" : "text-red-400"}`}>
              {posPnl >= 0 ? "+" : ""}{fmtEur(posPnl)}
              {pnlPct !== null && ` (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)`}
            </p>
          </div>
        </div>
      )}

      {/* Price chart */}
      <PriceChart
        data={chart}
        symbol={symbol ?? ""}
        avgPrice={avgPrice}
        currency={displayCurrency}
        range={range}
        onRangeChange={handleRangeChange}
        loading={chartLoading}
      />

      {/* Key metrics grid */}
      {m && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
            Kerngegevens
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <MetricTile label="Koers / Winst (K/W)"  value={m.trailingPE  !== null ? fmtNum(m.trailingPE,  1) : "–"} sub="trailing" />
            <MetricTile label="Verwachte K/W"         value={m.forwardPE   !== null ? fmtNum(m.forwardPE,   1) : "–"} sub="forward" />
            <MetricTile label="Winst per aandeel (EPS)" value={m.trailingEps !== null ? `${displayCurrency} ${fmtNum(m.trailingEps)}` : "–"} sub={m.forwardEps !== null ? `Verwacht: ${displayCurrency} ${fmtNum(m.forwardEps)}` : undefined} />
            <MetricTile label="Marktwaarde"           value={fmtLarge(m.marketCap)} />
            <MetricTile label="Beta"                  value={m.beta !== null ? fmtNum(m.beta) : "–"} sub="volatiliteit t.o.v. markt" />
            <MetricTile label="52W Hoog"              value={m.fiftyTwoWeekHigh !== null ? `${displayCurrency} ${m.fiftyTwoWeekHigh.toFixed(2)}` : "–"} />
            <MetricTile label="52W Laag"              value={m.fiftyTwoWeekLow  !== null ? `${displayCurrency} ${m.fiftyTwoWeekLow.toFixed(2)}`  : "–"} />
            <MetricTile
              label="Dividend rendement"
              value={m.dividendYield !== null ? `${(m.dividendYield * 100).toFixed(2)}%` : "–"}
              sub={m.dividendRate !== null ? `${displayCurrency} ${fmtNum(m.dividendRate)} / jaar` : undefined}
            />
            {m.dayHigh !== null && <MetricTile label="Dag Hoog"  value={`${displayCurrency} ${m.dayHigh.toFixed(2)}`} />}
            {m.dayLow  !== null && <MetricTile label="Dag Laag"  value={`${displayCurrency} ${m.dayLow.toFixed(2)}`}  />}
            {m.volume  !== null && (
              <MetricTile
                label="Volume"
                value={m.volume.toLocaleString("nl-NL")}
                sub={m.avgVolume !== null ? `Gem: ${m.avgVolume.toLocaleString("nl-NL")}` : undefined}
              />
            )}
            {m.priceToBook !== null && <MetricTile label="Koers / Boekwaarde" value={fmtNum(m.priceToBook, 1)} />}
          </div>
        </div>
      )}

      {/* Analyst consensus */}
      {m && (m.recommendationKey || (m.strongBuy + m.buy + m.hold + m.sell + m.strongSell) > 0) && (
        <div className={`rounded-xl ring-1 p-5 space-y-4 ${
          isDark ? "bg-[#0d1829] ring-[#1a2744]" : "bg-white ring-slate-200"
        }`}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Analistenconsensus
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <ConsensusBadge rec={m.recommendationKey} />
            {m.numberOfAnalysts !== null && (
              <span className="text-sm text-slate-400">{m.numberOfAnalysts} analisten</span>
            )}
            {m.targetMeanPrice !== null && (
              <div className="text-sm text-slate-400">
                Koersdoel:{" "}
                <span className="font-semibold text-slate-200">
                  {displayCurrency} {m.targetMeanPrice.toFixed(2)}
                </span>
                {m.targetLowPrice !== null && m.targetHighPrice !== null && (
                  <span className="ml-1 text-slate-500">
                    ({displayCurrency} {m.targetLowPrice.toFixed(2)} – {m.targetHighPrice.toFixed(2)})
                  </span>
                )}
              </div>
            )}
          </div>
          <AnalystBar
            strongBuy={m.strongBuy}
            buy={m.buy}
            hold={m.hold}
            sell={m.sell}
            strongSell={m.strongSell}
          />
        </div>
      )}

      {/* News */}
      {news.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
            Nieuws
          </h2>
          <div className="space-y-3">
            {news.map((item, i) => (
              <NewsCard key={i} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function PositionDetailPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={
        <div className="flex h-[60vh] items-center justify-center gap-3 text-slate-400">
          <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        </div>
      }>
        <PositionDetailContent />
      </Suspense>
    </DashboardLayout>
  )
}
