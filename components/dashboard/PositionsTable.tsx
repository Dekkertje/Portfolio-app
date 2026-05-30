import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { TrendingUp, TrendingDown, ArrowUpDown, ArrowUp, ArrowDown, Trash2 } from "lucide-react"

type Position = {
  product: string
  isin: string | null
  quantity: number
  avgPrice: number
  invested: number
  currentPrice: number
  currentValue: number
  totalFees: number
  realizedPnL: number
  isETF: boolean
  isCrypto?: boolean
  dayChangeValue?: number
  dayChangePercent?: number
  totalDividendsReceived?: number
  nextEarningsDate?: string
  annualDividend?: number
  dividendYield?: number
  isManual?: boolean
  manualPositionId?: string
}

type PositionsTableProps = {
  positions: Position[]
  onDeletePosition?: (isin: string, product: string, isManual: boolean, manualPositionId?: string) => void
}

type SortField = 'product' | 'quantity' | 'avgPrice' | 'currentPrice' | 'currentValue' | 'pnl'
type SortDirection = 'asc' | 'desc' | null

function formatCurrency(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function PositionsTable({ positions, onDeletePosition }: PositionsTableProps) {
  const router = useRouter()
  const [sortField, setSortField] = useState<SortField>('currentValue')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: desc -> asc -> null -> desc
      if (sortDirection === 'desc') {
        setSortDirection('asc')
      } else if (sortDirection === 'asc') {
        setSortDirection(null)
        setSortField('currentValue')
      }
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortedPositions = useMemo(() => {
    if (!sortDirection) return positions

    return [...positions].sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (sortField) {
        case 'product':
          aVal = a.product
          bVal = b.product
          break
        case 'quantity':
          aVal = a.quantity
          bVal = b.quantity
          break
        case 'avgPrice':
          aVal = a.avgPrice
          bVal = b.avgPrice
          break
        case 'currentPrice':
          aVal = a.currentPrice
          bVal = b.currentPrice
          break
        case 'currentValue':
          aVal = a.currentValue
          bVal = b.currentValue
          break
        case 'pnl':
          const aPnL = (a.currentValue - a.invested) + a.realizedPnL - a.totalFees
          const bPnL = (b.currentValue - b.invested) + b.realizedPnL - b.totalFees
          aVal = aPnL
          bVal = bPnL
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
  }, [positions, sortField, sortDirection])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-slate-400" />
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4 text-indigo-600" />
    }
    return <ArrowDown className="h-4 w-4 text-indigo-600" />
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white dark:bg-[#0d1829] shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80">

      {/* ── Mobile card view (< md) ─────────────────────────────────────────── */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-[#1a2744]">
        {sortedPositions.map((position, index) => {
          const unrealizedPnL = position.currentValue - position.invested
          const totalPnL = unrealizedPnL + position.realizedPnL - position.totalFees
          const profitLossPercentage = position.invested > 0 ? (totalPnL / position.invested) * 100 : 0
          const isProfit = totalPnL >= 0

          const handleCardClick = (e: React.MouseEvent) => {
            if ((e.target as HTMLElement).closest("button")) return
            const qs = new URLSearchParams({
              product: position.product,
              qty: String(position.quantity),
              avgPrice: String(position.avgPrice),
              value: String(position.currentValue),
              pnl: String(totalPnL),
            })
            if (position.isin) qs.set("isin", position.isin)
            if (position.isCrypto) qs.set("isCrypto", "true")
            router.push(`/dashboard/position?${qs}`)
          }

          return (
            <div key={index} onClick={handleCardClick} className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1a2744]/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  isProfit ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"
                }`}>
                  {position.product.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{position.product}</p>
                    {position.isETF && <span className="shrink-0 rounded-full bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-400">ETF</span>}
                  </div>
                  <p className="text-xs text-slate-400">{formatNumber(position.quantity)} × {formatCurrency(position.avgPrice)}</p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(position.currentValue)}</p>
                <p className={`text-xs font-medium ${isProfit ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                  {isProfit ? "+" : ""}{formatCurrency(totalPnL)} ({profitLossPercentage >= 0 ? "+" : ""}{profitLossPercentage.toFixed(1)}%)
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Desktop table view (≥ md) ────────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-[#1a2744]">
          <thead className="bg-slate-50 dark:bg-[#0b1120]">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1a2744]/40 transition-colors"
                onClick={() => handleSort('product')}
              >
                <div className="flex items-center gap-2">
                  Product
                  <SortIcon field="product" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1a2744]/40 transition-colors"
                onClick={() => handleSort('quantity')}
              >
                <div className="flex items-center justify-end gap-2">
                  Aantal
                  <SortIcon field="quantity" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1a2744]/40 transition-colors"
                onClick={() => handleSort('avgPrice')}
              >
                <div className="flex items-center justify-end gap-2">
                  Gem. Prijs
                  <SortIcon field="avgPrice" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1a2744]/40 transition-colors"
                onClick={() => handleSort('currentPrice')}
              >
                <div className="flex items-center justify-end gap-2">
                  Huidige Prijs
                  <SortIcon field="currentPrice" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1a2744]/40 transition-colors"
                onClick={() => handleSort('currentValue')}
              >
                <div className="flex items-center justify-end gap-2">
                  Waarde
                  <SortIcon field="currentValue" />
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Dag
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1a2744]/40 transition-colors"
                onClick={() => handleSort('pnl')}
              >
                <div className="flex items-center justify-end gap-2">
                  Winst/Verlies
                  <SortIcon field="pnl" />
                </div>
              </th>
              {onDeletePosition && (
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Acties
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-[#1a2744] bg-white dark:bg-[#0d1829]">
            {sortedPositions.map((position, index) => {
              // Unrealized P&L for current open position
              const unrealizedPnL = position.currentValue - position.invested

              // Total P&L = unrealized + realized - fees for this position
              const totalPnL = unrealizedPnL + position.realizedPnL - position.totalFees

              const profitLossPercentage = position.invested > 0
                ? (totalPnL / position.invested) * 100
                : 0
              const isProfit = totalPnL >= 0

              const handleRowClick = (e: React.MouseEvent) => {
                // Don't navigate when clicking the delete button
                if ((e.target as HTMLElement).closest("button")) return
                const qs = new URLSearchParams({
                  product: position.product,
                  qty:     String(position.quantity),
                  avgPrice: String(position.avgPrice),
                  value:   String(position.currentValue),
                  pnl:     String(totalPnL),
                })
                if (position.isin)     qs.set("isin",     position.isin)
                if (position.isCrypto) qs.set("isCrypto", "true")
                router.push(`/dashboard/position?${qs}`)
              }

              return (
                <tr
                  key={index}
                  onClick={handleRowClick}
                  className="transition-colors hover:bg-slate-50 dark:hover:bg-[#1a2744]/30 cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{position.product}</div>
                      {position.isETF && (
                        <span className="rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-400">
                          ETF
                        </span>
                      )}
                      {position.isCrypto && (
                        <span className="rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-400">
                          Crypto
                        </span>
                      )}
                    </div>
                    {position.isin && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">{position.isin}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-slate-900 dark:text-slate-100">
                    {formatNumber(position.quantity)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-slate-900 dark:text-slate-100">
                    {formatCurrency(position.avgPrice)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(position.currentPrice)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(position.currentValue)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {position.dayChangeValue !== undefined ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={`text-sm font-medium ${position.dayChangeValue >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {position.dayChangeValue >= 0 ? "+" : ""}{formatCurrency(position.dayChangeValue)}
                        </span>
                        {position.dayChangePercent !== undefined && (
                          <span className={`text-xs ${position.dayChangePercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {position.dayChangePercent >= 0 ? "+" : ""}{position.dayChangePercent.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1">
                        {isProfit ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <div
                          className={`text-sm font-semibold ${
                            isProfit ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {formatCurrency(totalPnL)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={isProfit ? "text-green-600" : "text-red-600"}
                        >
                          {profitLossPercentage >= 0 ? "+" : ""}
                          {profitLossPercentage.toFixed(2)}%
                        </span>
                        {position.totalFees > 0 && (
                          <span className="text-slate-400" title="Totale kosten">
                            (fees: {formatCurrency(position.totalFees)})
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  {onDeletePosition && (
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => onDeletePosition(
                          position.isin || '',
                          position.product,
                          position.isManual || false,
                          position.manualPositionId
                        )}
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Verwijder positie"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {/* end desktop table */}
    </div>
  )
}

