import { useState, useMemo } from "react"
import { TrendingUp, TrendingDown, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

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
  dayChangeValue?: number
  totalDividendsReceived?: number
  nextEarningsDate?: string
  annualDividend?: number
  dividendYield?: number
}

type PositionsTableProps = {
  positions: Position[]
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

export function PositionsTable({ positions }: PositionsTableProps) {
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
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('product')}
              >
                <div className="flex items-center gap-2">
                  Product
                  <SortIcon field="product" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('quantity')}
              >
                <div className="flex items-center justify-end gap-2">
                  Aantal
                  <SortIcon field="quantity" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('avgPrice')}
              >
                <div className="flex items-center justify-end gap-2">
                  Gem. Prijs
                  <SortIcon field="avgPrice" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('currentPrice')}
              >
                <div className="flex items-center justify-end gap-2">
                  Huidige Prijs
                  <SortIcon field="currentPrice" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('currentValue')}
              >
                <div className="flex items-center justify-end gap-2">
                  Waarde
                  <SortIcon field="currentValue" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('pnl')}
              >
                <div className="flex items-center justify-end gap-2">
                  Winst/Verlies
                  <SortIcon field="pnl" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600"
              >
                Dividenden
              </th>
              <th
                className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600"
              >
                Earnings
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {sortedPositions.map((position, index) => {
              // Unrealized P&L for current open position
              const unrealizedPnL = position.currentValue - position.invested

              // Total P&L = unrealized + realized - fees for this position
              const totalPnL = unrealizedPnL + position.realizedPnL - position.totalFees

              const profitLossPercentage = position.invested > 0
                ? (totalPnL / position.invested) * 100
                : 0
              const isProfit = totalPnL >= 0

              return (
                <tr key={index} className="transition-colors hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-slate-900">{position.product}</div>
                      {position.isETF && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                          ETF
                        </span>
                      )}
                    </div>
                    {position.isin && (
                      <div className="text-xs text-slate-500">{position.isin}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-slate-900">
                    {formatNumber(position.quantity)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-slate-900">
                    {formatCurrency(position.avgPrice)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                    {formatCurrency(position.currentPrice)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                    {formatCurrency(position.currentValue)}
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
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end gap-1">
                      {position.totalDividendsReceived && position.totalDividendsReceived > 0 ? (
                        <>
                          <div className="text-sm font-medium text-green-600">
                            {formatCurrency(position.totalDividendsReceived)}
                          </div>
                          {position.dividendYield && position.dividendYield > 0 && (
                            <div className="text-xs text-slate-500">
                              Yield: {position.dividendYield.toFixed(2)}%
                            </div>
                          )}
                        </>
                      ) : position.annualDividend && position.annualDividend > 0 ? (
                        <div className="text-xs text-slate-400">
                          €{position.annualDividend.toFixed(2)}/jr
                        </div>
                      ) : (
                        <div className="text-xs text-slate-300">-</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {position.nextEarningsDate ? (
                      <div className="text-xs text-slate-600">
                        {new Date(position.nextEarningsDate).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-300">-</div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

