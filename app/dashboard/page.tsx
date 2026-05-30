"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase, authFetch } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { AllocationChart } from "@/components/dashboard/AllocationChart"
import { AllocationBreakdown } from "@/components/dashboard/AllocationBreakdown"
import { PerformanceChart, ChartMode, PerformanceData as PerfPoint } from "@/components/dashboard/PerformanceChart"
import { PositionsTable } from "@/components/dashboard/PositionsTable"
import { Button } from "@/components/ui/Button"
import { useToast } from "@/components/ui/Toast"
import { RefreshCw, Plus, DollarSign, BarChart2 } from "lucide-react"
import { Transaction, Price, Position } from "@/lib/types"
import { formatCurrency, isETF, isCrypto, getSector, generatePerformanceData, BenchmarkType } from "@/lib/utils"
import { PeriodFilter, Period } from "@/components/dashboard/PeriodFilter"
import { BenchmarkChart } from "@/components/dashboard/BenchmarkChart"
import { BenchmarkSelector } from "@/components/dashboard/BenchmarkSelector"
import { PrivacyText } from "@/components/ui/PrivacyText"
import { AddManualPositionModal } from "@/components/dashboard/AddManualPositionModal"
import { CashPositionModal } from "@/components/dashboard/CashPositionModal"
import { CompoundCalculator } from "@/components/dashboard/CompoundCalculator"
import { CashPositionCard } from "@/components/dashboard/CashPositionCard"
import { ConfirmModal } from "@/components/ui/ConfirmModal"
import { HeroCard } from "@/components/dashboard/HeroCard"
import { RiskPanel } from "@/components/dashboard/RiskPanel"
import { TopPositionsChart, TopPosition } from "@/components/dashboard/TopPositionsChart"

export default function DashboardPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('1M')
  const [selectedBenchmark, setSelectedBenchmark] = useState<BenchmarkType>('sp500')
  const [benchmarkPeriod, setBenchmarkPeriod] = useState<Period>('ALL')
  const [benchmarkCustomStart, setBenchmarkCustomStart] = useState('')
  const [benchmarkCustomEnd, setBenchmarkCustomEnd] = useState('')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [portfolioId, setPortfolioId] = useState<string | null>(null)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [portfolioTargetAmount, setPortfolioTargetAmount] = useState<number | null>(null)
  const [showAddPositionModal, setShowAddPositionModal] = useState(false)
  const [showCashModal, setShowCashModal] = useState(false)
  const [cashPositions, setCashPositions] = useState<any[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean
    isin: string
    product: string
    isManual: boolean
    manualPositionId?: string
  }>({ show: false, isin: '', product: '', isManual: false })

  // All-time snapshots for max drawdown + YTD calculation
  const [allSnapshots, setAllSnapshots] = useState<{ snapshot_date: string; total_value: number; total_cost: number }[]>([])

  // Transaction-based timeline: one entry per unique trade date with cumulative
  // cost basis.  Used to fill in history before the first portfolio snapshot.
  const [txTimeline, setTxTimeline] = useState<{ date: string; cost: number }[]>([])

  // Full reconstructed portfolio history from Yahoo Finance prices.
  // Fetched once via /api/portfolio-history and used for pre-snapshot P&L.
  const [portfolioHistory, setPortfolioHistory] = useState<{ date: string; value: number; cost: number; pnl: number }[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  // Real benchmark data from Yahoo Finance
  const [benchmarkHistory, setBenchmarkHistory] = useState<{ date: string; value: number }[] | null>(null)
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)

  // Portfolio-level totals that can't be derived from open positions alone:
  // - realizedPnLAll: includes fully sold positions (quantity = 0) which are filtered out of `positions`
  // - soldCostBasis: total cost of all sold shares (needed for correct return % denominator)
  // - totalDividendsReceived: all dividends ever received (not included in P&L above)
  const [portfolioTotals, setPortfolioTotals] = useState({
    realizedPnLAll: 0,
    soldCostBasis: 0,
    totalDividendsReceived: 0,
  })
  const { showToast } = useToast()

  async function loadDashboard() {
    try {
      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session?.user) {
        window.location.href = "/login"
        return
      }

      const userId = sessionData.session.user.id

      // Use limit(1) + maybeSingle() so duplicate portfolios (edge case) never
      // cause .single() to error and silently create yet another empty portfolio.
      let { data: portfolio } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()

      if (!portfolio) {
        const { data: created } = await supabase
          .from("portfolios")
          .insert({ user_id: userId, name: "Mijn Portfolio" })
          .select("id")
          .single()
        portfolio = created
      }

      if (!portfolio) {
        setLoading(false)
        return
      }

      setPortfolioId(portfolio.id)

      // Load target amount for compound calculator
      const { data: portfolioData } = await supabase
        .from("portfolios").select("target_amount").eq("id", portfolio.id).maybeSingle()
      if (portfolioData?.target_amount != null) setPortfolioTargetAmount(Number(portfolioData.target_amount))

      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .eq("portfolio_id", portfolio.id)
        .order("trade_date", { ascending: true })
        .order("trade_time", { ascending: true })

      const { data: prices, error: priceError } = await supabase
        .from("prices")
        .select("*")
        .order("price_date", { ascending: false })

      // Fetch securities data for earnings dates and dividend info
      const { data: securities } = await supabase
        .from("securities")
        .select("isin, next_earnings_date, annual_dividend, dividend_frequency")

      // Fetch total dividends received per position
      const { data: dividendData } = await supabase
        .from("transactions")
        .select("product, isin, total_eur")
        .eq("portfolio_id", portfolio.id)
        .ilike("transaction_type", "%dividend%")

      // Fetch manual positions
      const { data: manualPositions } = await supabase
        .from("manual_positions")
        .select("*")
        .eq("portfolio_id", portfolio.id)

      if (txError || !transactions) {
        showToast("Fout bij laden van transacties", "error")
        setLoading(false)
        return
      }

      // Build securities map by ISIN
      const securitiesMap: Record<string, { nextEarningsDate?: string, annualDividend?: number, dividendFrequency?: string }> = {}
      if (securities) {
        for (const sec of securities) {
          if (sec.isin) {
            securitiesMap[sec.isin] = {
              nextEarningsDate: sec.next_earnings_date || undefined,
              annualDividend: sec.annual_dividend || undefined,
              dividendFrequency: sec.dividend_frequency || undefined
            }
          }
        }
      }

      // Build dividends received map
      const dividendsReceivedMap: Record<string, number> = {}
      if (dividendData) {
        for (const div of dividendData) {
          const key = `${div.product}__${div.isin || ""}`
          dividendsReceivedMap[key] = (dividendsReceivedMap[key] || 0) + Math.abs(div.total_eur || 0)
        }
      }

      const latestPriceMap: Record<string, Price> = {}

      if (!priceError && prices) {
        for (const price of prices as Price[]) {
          const key = `${price.product}__${price.isin || ""}`
          if (!latestPriceMap[key]) {
            latestPriceMap[key] = price
          }
        }
        // Track the most recent price_date across all loaded prices
        const latestDate = (prices as Price[]).reduce<string | null>((max, p) => {
          if (!p.price_date) return max
          return max === null || p.price_date > max ? p.price_date : max
        }, null)
        if (latestDate) setLastRefreshed(new Date(latestDate))
      }

      const grouped: Record<string, Position> = {}

      // Portfolio-level accumulators (not derivable from open positions only)
      let accRealizedPnL = 0
      let accSoldCostBasis = 0

      // Build a per-date cost-basis timeline from transactions so we can show
      // portfolio history for dates before the first portfolio_snapshot exists.
      let runningCost = 0
      const costByDate = new Map<string, number>()

      for (const tx of transactions as Transaction[]) {
        if (!tx.trade_date) continue
        const total = Math.abs(Number(tx.total_eur || 0))
        if (tx.transaction_type === 'buy')  runningCost += total
        else if (tx.transaction_type === 'sell') runningCost = Math.max(0, runningCost - total)
        costByDate.set(tx.trade_date, runningCost)
      }

      const builtTxTimeline = Array.from(costByDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, cost]) => ({ date, cost }))

      for (const tx of transactions as Transaction[]) {
        const key = `${tx.product}__${tx.isin || ""}`

        if (!grouped[key]) {
          grouped[key] = {
            product: tx.product,
            isin: tx.isin,
            quantity: 0,
            avgPrice: 0,
            invested: 0,
            currentPrice: 0,
            currentValue: 0,
            totalFees: 0,
            realizedPnL: 0,
            isETF: isETF(tx.product),
            isCrypto: isCrypto(tx.product, tx.isin),
          }
        }

        const absQuantity = Math.abs(Number(tx.quantity))
        const total = Math.abs(Number(tx.total_eur))
        const fees = Math.abs(Number(tx.transaction_fee || 0)) + Math.abs(Number(tx.autofx_cost || 0))

        // Track fees for informational purposes
        grouped[key].totalFees += fees

        // Treat "unknown" type as buy/sell based on total_eur sign.
        // This handles DEGIRO CSVs where the local_value column was missing/zero.
        const resolvedType = tx.transaction_type === "unknown"
          ? (Number(tx.total_eur) < 0 ? "buy" : Number(tx.total_eur) > 0 ? "sell" : "unknown")
          : tx.transaction_type

        if (resolvedType === "buy") {
          grouped[key].quantity += absQuantity
          // total_eur already includes fees from DEGIRO
          grouped[key].invested += total
        }

        if (resolvedType === "sell") {
          // Calculate average price before selling
          const avgPriceBeforeSell = grouped[key].quantity > 0
            ? grouped[key].invested / grouped[key].quantity
            : 0

          // Reduce quantity
          grouped[key].quantity -= absQuantity

          // Reduce invested amount proportionally
          const costBasis = avgPriceBeforeSell * absQuantity
          grouped[key].invested -= costBasis

          // Calculate realized profit/loss on this sale
          // total_eur for a sell is the proceeds (negative in CSV, but we use abs)
          // realizedPnL = proceeds - cost basis (fees already included in total)
          const realizedGainOnSale = total - costBasis
          grouped[key].realizedPnL += realizedGainOnSale

          // Accumulate portfolio-level totals (survive even if this position hits qty=0)
          accRealizedPnL   += realizedGainOnSale
          accSoldCostBasis += costBasis

          // Make sure invested doesn't go negative due to rounding
          if (grouped[key].invested < 0) grouped[key].invested = 0
        }

      }

      // Add manual positions to grouped
      if (manualPositions && manualPositions.length > 0) {
        for (const mp of manualPositions) {
          const key = `${mp.product_name}__${mp.isin || ""}`

          if (!grouped[key]) {
            grouped[key] = {
              product: mp.product_name,
              isin: mp.isin || null,
              quantity: mp.quantity,
              avgPrice: mp.average_price,
              invested: mp.quantity * mp.average_price,
              currentPrice: 0,
              currentValue: 0,
              totalFees: 0,
              realizedPnL: 0,
              isETF: isETF(mp.product_name),
              isCrypto: isCrypto(mp.product_name, mp.isin),
              isManual: true,
              manualPositionId: mp.id,
            }
          }
        }
      }

      const calculatedPositions = Object.entries(grouped)
        .map(([key, p]) => {
          if (p.quantity <= 0) return null

          const avgPrice = p.quantity > 0 ? p.invested / p.quantity : 0
          const priceData = latestPriceMap[key]
          const currentPrice = priceData ? Number(priceData.price) : avgPrice
          const currentValue = p.quantity * currentPrice

          // Daily P&L calculation - use previous_close from database
          // Note: If previous_close is not available, we cannot calculate daily P&L accurately
          const previousClose = priceData?.previous_close != null ? Number(priceData.previous_close) : undefined
          const dayChange = previousClose != null ? currentPrice - previousClose : undefined
          const dayChangePercent = (previousClose != null && previousClose !== 0 && dayChange != null)
            ? (dayChange / previousClose) * 100
            : undefined
          const dayChangeValue = dayChange != null ? dayChange * p.quantity : undefined

          // Get sector
          const sector = getSector(p.product, p.isin)

          // Get earnings and dividend data from securities
          const securityData = p.isin ? securitiesMap[p.isin] : undefined
          const totalDividendsReceived = dividendsReceivedMap[key] || 0

          return {
            product: p.product,
            isin: p.isin,
            quantity: p.quantity,
            avgPrice,
            invested: p.invested,
            currentPrice,
            currentValue,
            totalFees: p.totalFees,
            realizedPnL: p.realizedPnL,
            isETF: p.isETF,
            isCrypto: p.isCrypto,
            sector,
            previousClose,
            dayChange,
            dayChangePercent,
            dayChangeValue,
            annualDividend: securityData?.annualDividend,
            dividendYield: securityData?.annualDividend && currentPrice > 0
              ? (securityData.annualDividend / currentPrice) * 100
              : undefined,
            totalDividendsReceived,
            nextEarningsDate: securityData?.nextEarningsDate,
            isManual: p.isManual || false,  // ← CRITICAL FIX!
            manualPositionId: p.manualPositionId,  // ← CRITICAL FIX!
          }
        })
        .filter(Boolean) as Position[]

      const sortedPositions = calculatedPositions.sort((a, b) => b.currentValue - a.currentValue)

      // Total dividends received across ALL positions (including sold ones)
      const totalDividendsReceived = (dividendData || [])
        .reduce((sum, d) => sum + Math.abs(d.total_eur || 0), 0)

      setPortfolioTotals({
        realizedPnLAll:         accRealizedPnL,
        soldCostBasis:          accSoldCostBasis,
        totalDividendsReceived,
      })
      setTxTimeline(builtTxTimeline)
      setPositions(sortedPositions)
      setLoading(false)
    } catch (error) {
      console.error("Error loading dashboard:", error)
      showToast("Fout bij laden van dashboard", "error")
      setLoading(false)
    }
  }

  useEffect(() => {
    // Load dashboard data, then immediately refresh prices so new imports show current prices
    loadDashboard().then(() => {
      handleRefreshPrices(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  async function savePortfolioSnapshot() {
    if (!portfolioId) return

    try {
      const res = await authFetch("/api/save-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolio_id: portfolioId,
          total_value: metrics.totalValue,
          total_cost: metrics.totalCost,
          total_return: metrics.totalReturn,
          total_return_pct: metrics.totalReturnPct,
          position_count: positions.length,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        showToast(data.message || "Snapshot opgeslagen", "success")
      }
    } catch (error) {
      console.error("Error saving snapshot:", error)
    }
  }

  async function loadCashPositions() {
    if (!portfolioId) return

    try {
      const res = await authFetch(`/api/cash-positions?portfolio_id=${portfolioId}`)
      const data = await res.json()
      if (data.positions) {
        setCashPositions(data.positions)
      }
    } catch (error) {
      console.error("Error loading cash positions:", error)
    }
  }

  async function handleDeleteCash(id: string) {
    try {
      const res = await authFetch(`/api/cash-positions?id=${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        showToast("Cash positie verwijderd", "success")
        loadCashPositions()
      }
    } catch (error) {
      showToast("Fout bij verwijderen", "error")
    }
  }

  function handleEditCash(position: any) {
    // Pre-fill modal with existing data
    setShowCashModal(true)
  }

  function handleDeletePosition(isin: string, product: string, isManual: boolean, manualPositionId?: string) {
    setDeleteConfirm({
      show: true,
      isin,
      product,
      isManual,
      manualPositionId
    })
  }

  async function confirmDeletePosition() {
    const { isManual, manualPositionId, isin, product } = deleteConfirm

    try {
      if (isManual && manualPositionId) {
        // Delete manual position
        const res = await authFetch(`/api/manual-positions?id=${manualPositionId}`, {
          method: "DELETE",
        })

        if (res.ok) {
          showToast(`${product} verwijderd!`, "success")
          loadDashboard()
        } else {
          const errorData = await res.json()
          showToast(`Fout bij verwijderen: ${errorData.error || 'Unknown error'}`, "error")
        }
      } else if (portfolioId && (isin || product)) {
        // Delete DEGIRO position - delete ALL transactions with this ISIN/product
        const params = new URLSearchParams({
          portfolio_id: portfolioId,
        })
        if (isin) params.append('isin', isin)
        if (product) params.append('product', product)

        const res = await authFetch(`/api/transactions?${params.toString()}`, {
          method: "DELETE",
        })

        if (res.ok) {
          const result = await res.json()
          showToast(`${product} verwijderd (${result.deleted_count} transacties)!`, "success")

          // Force reload dashboard to refresh positions
          await loadDashboard()
        } else {
          const errorData = await res.json()
          showToast(`Fout bij verwijderen: ${errorData.error || 'Unknown error'}`, "error")
        }
      } else {
        showToast("Kan positie niet verwijderen: ontbrekende gegevens", "error")
      }
    } catch (error: any) {
      showToast(`Fout bij verwijderen: ${error.message || 'Unknown error'}`, "error")
    }

    setDeleteConfirm({ show: false, isin: '', product: '', isManual: false })
  }

  async function handleRefreshPrices(silent = false) {
    setRefreshing(true)
    try {
      const res = await authFetch("/api/refresh-prices", { method: "POST" })
      const data = await res.json()

      if (!res.ok) {
        if (!silent) {
          showToast(data.error || "Er ging iets mis bij het verversen van koersen.", "error")
        }
        return
      }

      if (!silent) {
        const msg = data.message || `${data.inserted} koersen ververst!`
        showToast(msg, data.inserted === 0 ? "error" : "success")
      }
      await loadDashboard() // Reload data instead of full page refresh

      // Auto-save snapshot after successful price refresh
      if (!silent) {
        setTimeout(() => savePortfolioSnapshot(), 1000)
      }
    } catch {
      if (!silent) {
        showToast("Er ging iets mis bij het verversen van koersen.", "error")
      }
    } finally {
      setRefreshing(false)
    }
  }

  // Auto-refresh prices every 10 seconds
  useEffect(() => {
    if (!autoRefreshEnabled) return

    const interval = setInterval(() => {
      handleRefreshPrices(true) // Silent refresh
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [autoRefreshEnabled])

  // Scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }


  // Memoized calculations to prevent unnecessary re-renders
  const { stocks, etfs, crypto, metrics, sectorData } = useMemo(() => {
    const stocksList = positions.filter(p => !p.isETF && !p.isCrypto)
    const etfsList   = positions.filter(p => p.isETF)
    const cryptoList = positions.filter(p => p.isCrypto)

    // ── Basis ────────────────────────────────────────────────────────────────
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0)
    const totalCost  = positions.reduce((sum, p) => sum + p.invested,     0)
    const totalFees  = positions.reduce((sum, p) => sum + p.totalFees,    0)

    // ── Unrealized P&L ───────────────────────────────────────────────────────
    // Current market value minus cost basis of open positions.
    const unrealizedPnL = totalValue - totalCost

    // ── Realized P&L ────────────────────────────────────────────────────────
    // Bug fix: use portfolioTotals.realizedPnLAll instead of summing positions[].realizedPnL.
    // Reason: positions with quantity=0 (fully sold) are filtered out, losing their P&L.
    const totalRealizedPnL = portfolioTotals.realizedPnLAll

    // ── Dividends ────────────────────────────────────────────────────────────
    // Bug fix: dividends received are return, not just informational.
    const totalDividendsReceived = portfolioTotals.totalDividendsReceived

    // ── Total return ─────────────────────────────────────────────────────────
    // = unrealized gain on open positions
    // + realized gain from ALL sells (including fully closed positions)
    // + dividends received
    const totalReturn = unrealizedPnL + totalRealizedPnL + totalDividendsReceived

    // ── Return % ─────────────────────────────────────────────────────────────
    // Bug fix: denominator must be total capital ever deployed, not just current cost basis.
    // Using only open-position cost basis inflates % when proceeds from sells are reinvested.
    // Total capital deployed = cost basis of open positions + cost basis of sold positions.
    const totalCapitalDeployed = totalCost + portfolioTotals.soldCostBasis
    const totalReturnPct = totalCapitalDeployed > 0
      ? (totalReturn / totalCapitalDeployed) * 100
      : 0

    // ── Daily P&L ────────────────────────────────────────────────────────────
    const totalDailyPnL = positions.reduce((sum, p) => {
      if (p.dayChange === undefined || p.previousClose === undefined) return sum
      return sum + p.dayChange * p.quantity
    }, 0)

    // Bug fix: daily % should use yesterday's portfolio value as denominator, not today's.
    // Today's value already includes the gain, so dividing by it understates the move.
    const yesterdayValue = totalValue - totalDailyPnL
    const totalDailyPnLPercent = yesterdayValue > 0
      ? (totalDailyPnL / yesterdayValue) * 100
      : 0

    // Calculate sector allocation
    const sectorMap: Record<string, { value: number; count: number }> = {}
    positions.forEach(p => {
      const sector = p.sector || 'Other'
      if (!sectorMap[sector]) {
        sectorMap[sector] = { value: 0, count: 0 }
      }
      sectorMap[sector].value += p.currentValue
      sectorMap[sector].count += 1
    })

    const sectorAllocation = Object.entries(sectorMap)
      .map(([name, data]) => ({
        name,
        value: data.value,
        count: data.count,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)

    return {
      stocks: stocksList,
      etfs: etfsList,
      crypto: cryptoList,
      metrics: {
        totalValue,
        totalCost,
        totalFees,
        totalRealizedPnL,
        totalDividendsReceived,
        unrealizedPnL,
        totalReturn,
        totalReturnPct,
        totalCapitalDeployed,
        totalDailyPnL,
        totalDailyPnLPercent,
      },
      sectorData: sectorAllocation,
    }
  }, [positions, portfolioTotals])

  // ── Max Drawdown ────────────────────────────────────────────────────────────
  const maxDrawdownPct = useMemo(() => {
    if (allSnapshots.length < 2) return 0
    let peak = 0
    let maxDD = 0
    for (const s of allSnapshots) {
      const v = Number(s.total_value)
      if (v > peak) peak = v
      const dd = peak > 0 ? (peak - v) / peak * 100 : 0
      if (dd > maxDD) maxDD = dd
    }
    return maxDD
  }, [allSnapshots])

  // ── YTD return ───────────────────────────────────────────────────────────────
  const ytdReturnPct = useMemo(() => {
    if (allSnapshots.length === 0 || metrics.totalValue === 0) return null
    const jan1 = `${new Date().getFullYear()}-01-01`
    // Find the last snapshot on or before Jan 1
    const ytdBase = [...allSnapshots]
      .filter(s => s.snapshot_date <= jan1)
      .pop()
    if (!ytdBase || Number(ytdBase.total_value) === 0) return null
    return (metrics.totalValue - Number(ytdBase.total_value)) / Number(ytdBase.total_value) * 100
  }, [allSnapshots, metrics.totalValue])

  // ── Cash total + Exposure ────────────────────────────────────────────────────
  const cashTotal = useMemo(
    () => cashPositions.reduce((s: number, c: any) => s + Number(c.amount || 0), 0),
    [cashPositions]
  )

  const exposurePct = useMemo(() => {
    const total = metrics.totalValue + cashTotal
    return total > 0 ? (metrics.totalValue / total) * 100 : 100
  }, [metrics.totalValue, cashTotal])

  // ── Top positions for bar chart ──────────────────────────────────────────────
  const topPositions = useMemo((): TopPosition[] => {
    return positions.map(p => {
      const pnlEur = p.currentValue - p.invested
      const pnlPct = p.invested > 0 ? (pnlEur / p.invested) * 100 : 0
      return {
        product:      p.product,
        isin:         p.isin,
        currentValue: p.currentValue,
        weight:       metrics.totalValue > 0 ? (p.currentValue / metrics.totalValue) * 100 : 0,
        pnlEur,
        pnlPct,
        isETF:        p.isETF,
      }
    })
  }, [positions, metrics.totalValue])

  // Allocation data for pie charts
  const stocksAllocationData = useMemo(() => {
    const stocksTotal = stocks.reduce((sum, p) => sum + p.currentValue, 0)
    return stocks.map((pos) => ({
      name: pos.product,
      value: pos.currentValue,
      percentage: stocksTotal > 0 ? (pos.currentValue / stocksTotal) * 100 : 0,
    }))
  }, [stocks])

  const etfsAllocationData = useMemo(() => {
    const etfsTotal = etfs.reduce((sum, p) => sum + p.currentValue, 0)
    return etfs.map((pos) => ({
      name: pos.product,
      value: pos.currentValue,
      percentage: etfsTotal > 0 ? (pos.currentValue / etfsTotal) * 100 : 0,
    }))
  }, [etfs])

  // Combined allocation for overview
  const allocationData = useMemo(() => {
    const stocksTotal = stocks.reduce((sum, p) => sum + p.currentValue, 0)
    const etfsTotal = etfs.reduce((sum, p) => sum + p.currentValue, 0)
    const combined = []

    if (stocksTotal > 0) {
      combined.push({
        name: 'Aandelen',
        value: stocksTotal,
        percentage: metrics.totalValue > 0 ? (stocksTotal / metrics.totalValue) * 100 : 0,
      })
    }

    if (etfsTotal > 0) {
      combined.push({
        name: 'ETFs',
        value: etfsTotal,
        percentage: metrics.totalValue > 0 ? (etfsTotal / metrics.totalValue) * 100 : 0,
      })
    }

    return combined
  }, [stocks, etfs, metrics.totalValue])

  // Performance data for line chart - based on selected period
  // Use real historical snapshot data if available
  const [performanceData, setPerformanceData] = useState<PerfPoint[]>([])
  const [isIntraday, setIsIntraday] = useState(false)

  // Toggle between portfolio-value view and P&L view
  const [chartMode, setChartMode] = useState<ChartMode>("value")

  useEffect(() => {
    async function loadPerformanceData() {
      // ── 1D intraday: fetch 5-minute portfolio values ─────────────────────
      if (selectedPeriod === '1D') {
        setIsIntraday(true)
        if (!portfolioId) return
        try {
          const res  = await fetch(`/api/portfolio-intraday?portfolio_id=${portfolioId}`)
          const data = await res.json()
          const pts: PerfPoint[] = (data.points ?? []).map((p: { time: string; value: number }) => ({
            date:     p.time,
            isoDate:  p.time,   // re-used as X-axis key in intraday mode
            value:    p.value,
            invested: metrics.totalCost,
            pnl:      p.value - metrics.totalCost,
          }))
          setPerformanceData(pts.length > 0 ? pts : [])
        } catch {
          setPerformanceData([])
        }
        return
      }

      setIsIntraday(false)

      // Always generate simulated data as fallback first
      const simulatedData: PerfPoint[] = generatePerformanceData(
        metrics.totalCost,
        metrics.totalValue,
        selectedPeriod,
        customStartDate,
        customEndDate
      )

      if (!portfolioId) {
        setPerformanceData(simulatedData)
        return
      }

      try {
        // Fetch historical snapshots from database
        const snapParams = new URLSearchParams({ portfolio_id: portfolioId, period: selectedPeriod })
        if (selectedPeriod === 'CUSTOM' && customStartDate && customEndDate) {
          snapParams.set('start', customStartDate)
          snapParams.set('end', customEndDate)
        }
        // Calculate period start/end — used whether or not snapshots are found
        let periodStartIso: string
        if (selectedPeriod === 'CUSTOM' && customStartDate) {
          periodStartIso = customStartDate
        } else {
          const periodStart = new Date()
          if      (selectedPeriod === '1W')  periodStart.setDate(periodStart.getDate() - 7)
          else if (selectedPeriod === '1M')  periodStart.setMonth(periodStart.getMonth() - 1)
          else if (selectedPeriod === '3M')  periodStart.setMonth(periodStart.getMonth() - 3)
          else if (selectedPeriod === '6M')  periodStart.setMonth(periodStart.getMonth() - 6)
          else if (selectedPeriod === '1Y')  periodStart.setFullYear(periodStart.getFullYear() - 1)
          else if (selectedPeriod === 'YTD') { periodStart.setMonth(0); periodStart.setDate(1) }
          else if (selectedPeriod === 'ALL') periodStart.setFullYear(2000)
          periodStartIso = periodStart.toISOString().split('T')[0]
        }
        const periodEndIso = selectedPeriod === 'CUSTOM' && customEndDate ? customEndDate : new Date().toISOString().split('T')[0]

        const res = await fetch(`/api/save-snapshot?${snapParams}`)
        if (res.ok) {
          const { snapshots } = await res.json()

          if (snapshots && snapshots.length > 0) {
            // Convert snapshots to chart points
            // pnl = snap.total_return (unrealized + realized + dividends stored at snapshot time)
            // fallback: value - invested (unrealized only) when total_return is not available
            const snapshotPoints: (PerfPoint & { isoDate: string })[] =
              snapshots.map((snap: any) => {
                const value    = Number(snap.total_value)
                const invested = Number(snap.total_cost)
                const pnl      = snap.total_return != null
                  ? Number(snap.total_return)
                  : value - invested
                return {
                  isoDate: snap.snapshot_date as string,
                  date:    new Date(snap.snapshot_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
                  value,
                  invested,
                  pnl,
                }
              })

            const firstSnapIso = snapshots[0]?.snapshot_date as string | undefined

            // Prepend transaction-based cost-basis points for dates that fall
            // within the selected period but BEFORE the first snapshot.
            const preTxPoints: PerfPoint[] = []

            if (firstSnapIso && txTimeline.length > 0) {
              for (const pt of txTimeline) {
                if (pt.date >= periodStartIso && pt.date < firstSnapIso) {
                  preTxPoints.push({
                    isoDate:  pt.date,
                    date:     new Date(pt.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit' }),
                    value:    pt.cost,
                    invested: pt.cost,
                    pnl:      0,
                  })
                }
              }
            }

            // Replace flat pnl=0 pre-snapshot points with real Yahoo-reconstructed values.
            if (portfolioHistory && portfolioHistory.length > 0 && firstSnapIso) {
              const realPre: PerfPoint[] = portfolioHistory
                .filter(h => h.date >= periodStartIso && h.date < firstSnapIso)
                .map(h => ({
                  isoDate:  h.date,
                  date:     new Date(h.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit' }),
                  value:    h.value,
                  invested: h.cost,
                  pnl:      h.pnl,
                }))
              if (realPre.length > 0) {
                preTxPoints.splice(0, preTxPoints.length, ...realPre)
              }
            }

            const historicalData: PerfPoint[] = [
              ...preTxPoints,
              // Keep isoDate in snapshot points (don't strip it)
              ...snapshotPoints.map(({ isoDate, ...rest }) => ({ ...rest, isoDate })),
            ]

            // Add today's live values if today not already in snapshots,
            // but only when today falls within the selected period's end date.
            const today = new Date().toISOString().split('T')[0]
            const hasToday = snapshots.some((s: any) => s.snapshot_date === today)
            if (!hasToday && today <= periodEndIso) {
              historicalData.push({
                isoDate:  today,
                date:     new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
                value:    metrics.totalValue,
                invested: metrics.totalCost,
                pnl:      metrics.totalReturn,
              })
            }

            setPerformanceData(historicalData)
          } else if (portfolioHistory && portfolioHistory.length > 0) {
            // No snapshots for this range, but we have reconstructed history — use it directly.
            const filtered: PerfPoint[] = portfolioHistory
              .filter(h => h.date >= periodStartIso && h.date <= periodEndIso)
              .map(h => ({
                isoDate:  h.date,
                date:     new Date(h.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit' }),
                value:    h.value,
                invested: h.cost,
                pnl:      h.pnl,
              }))
            const todayIso = new Date().toISOString().split('T')[0]
            if (filtered.length > 0 && todayIso <= periodEndIso && !filtered.some(p => p.isoDate === todayIso)) {
              filtered.push({
                isoDate:  todayIso,
                date:     new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
                value:    metrics.totalValue,
                invested: metrics.totalCost,
                pnl:      metrics.totalReturn,
              })
            }
            setPerformanceData(filtered.length > 0 ? filtered : simulatedData)
          } else {
            // No snapshots and no history — fall back to simulated data
            setPerformanceData(simulatedData)
          }
        } else {
          // Fetch failed, use simulated data
          setPerformanceData(simulatedData)
        }
      } catch (error) {
        console.error('Error loading performance data:', error)
        // Fallback to simulated data on error
        setPerformanceData(simulatedData)
      }
    }

    loadPerformanceData()
  }, [metrics.totalCost, metrics.totalValue, selectedPeriod, customStartDate, customEndDate, portfolioId, txTimeline, portfolioHistory])

  // Load cash positions when portfolio ID is available
  useEffect(() => {
    if (portfolioId) {
      loadCashPositions()
    }
  }, [portfolioId])

  // Load all-time snapshots for max drawdown + YTD (once per portfolio load)
  useEffect(() => {
    if (!portfolioId) return
    async function loadAllSnapshots() {
      try {
        const res = await fetch(`/api/save-snapshot?portfolio_id=${portfolioId}&period=ALL`)
        if (res.ok) {
          const { snapshots } = await res.json()
          setAllSnapshots(snapshots || [])
        }
      } catch { /* non-critical */ }
    }
    loadAllSnapshots()
  }, [portfolioId])

  // Reconstruct full price history via Yahoo Finance and backfill portfolio_snapshots.
  // This runs once per portfolio load and may take a few seconds on first load.
  useEffect(() => {
    if (!portfolioId) return
    const controller = new AbortController()
    setHistoryLoading(true)
    fetch(`/api/portfolio-history?portfolio_id=${portfolioId}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.history && Array.isArray(data.history)) setPortfolioHistory(data.history)
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
    return () => controller.abort()
  }, [portfolioId])

  // Fetch real benchmark data whenever benchmark type or period changes
  useEffect(() => {
    const controller = new AbortController()
    setBenchmarkLoading(true)
    const params = new URLSearchParams({ benchmark: selectedBenchmark, period: benchmarkPeriod })
    if (benchmarkPeriod === 'CUSTOM' && benchmarkCustomStart && benchmarkCustomEnd) {
      params.set('from', benchmarkCustomStart)
      params.set('to',   benchmarkCustomEnd)
    }
    fetch(`/api/benchmark-history?${params}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.history && Array.isArray(data.history)) setBenchmarkHistory(data.history)
      })
      .catch(() => {})
      .finally(() => setBenchmarkLoading(false))
    return () => controller.abort()
  }, [selectedBenchmark, benchmarkPeriod, benchmarkCustomStart, benchmarkCustomEnd])

  // Period-specific performance metrics
  const periodMetrics = useMemo(() => {
    if (performanceData.length < 2) {
      return { change: 0, changePercent: 0, pnlChange: 0, pnlChangePercent: 0 }
    }

    const first = performanceData[0]
    const last  = performanceData[performanceData.length - 1]

    const change        = last.value - first.value
    const changePercent = first.value > 0 ? (change / first.value) * 100 : 0

    // P&L change over the period (absolute and % of invested at start)
    const pnlChange        = last.pnl - first.pnl
    const pnlChangePercent = first.invested > 0 ? (pnlChange / first.invested) * 100 : 0

    return { change, changePercent, pnlChange, pnlChangePercent }
  }, [performanceData])

  // Benchmark chart data — merges real portfolio performance with real benchmark prices.
  // Both series start at 0% at the first date they share in the benchmark period.
  // Deliberately independent of performanceData so the benchmark period filter works.
  const benchmarkData = useMemo(() => {
    if (!benchmarkHistory || benchmarkHistory.length < 2) return []

    const benchFirst = benchmarkHistory[0].date
    const benchLast  = benchmarkHistory[benchmarkHistory.length - 1].date

    // Build portfolio point series for the benchmark period independently
    // of the main chart's performanceData (which uses a different period).
    const portfolioPoints: { date: string; value: number }[] = []

    if (portfolioHistory && portfolioHistory.length > 0) {
      for (const h of portfolioHistory) {
        if (h.date >= benchFirst && h.date <= benchLast) {
          portfolioPoints.push({ date: h.date, value: h.value })
        }
      }
    }

    // Fill gaps with saved snapshots
    const snapshotDates = new Set(portfolioPoints.map(p => p.date))
    for (const s of allSnapshots) {
      if (s.snapshot_date >= benchFirst && s.snapshot_date <= benchLast && !snapshotDates.has(s.snapshot_date)) {
        portfolioPoints.push({ date: s.snapshot_date, value: Number(s.total_value) })
      }
    }
    portfolioPoints.sort((a, b) => a.date.localeCompare(b.date))

    // Add today's live value if it falls within the benchmark range
    const today = new Date().toISOString().split("T")[0]
    if (today >= benchFirst && !portfolioPoints.some(p => p.date === today) && metrics.totalValue > 0) {
      portfolioPoints.push({ date: today, value: metrics.totalValue })
    }

    if (portfolioPoints.length < 2) return []

    // Build benchmark lookup with forward-fill for weekends/holidays
    const benchLookup: Record<string, number> = {}
    for (const b of benchmarkHistory) benchLookup[b.date] = b.value
    const sortedBenchDates = benchmarkHistory.map(b => b.date).sort()

    function benchValueAt(iso: string): number | null {
      for (let i = sortedBenchDates.length - 1; i >= 0; i--) {
        if (sortedBenchDates[i] <= iso) return benchLookup[sortedBenchDates[i]] ?? null
      }
      return null
    }

    const basePortfolio = portfolioPoints[0].value

    return portfolioPoints
      .map(p => {
        const bench = benchValueAt(p.date)
        if (bench === null) return null
        return {
          date:      new Date(p.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }),
          isoDate:   p.date,
          portfolio: basePortfolio > 0 ? ((p.value / basePortfolio) - 1) * 100 : 0,
          benchmark: bench,
        }
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
  }, [portfolioHistory, allSnapshots, benchmarkHistory, metrics.totalValue])

  // Dividend metrics
  const dividendMetrics = useMemo(() => {
    let totalAnnualDividend = 0
    let totalDividendValue = 0

    positions.forEach(p => {
      if (p.annualDividend && p.annualDividend > 0) {
        const annualIncome = p.annualDividend * p.quantity
        totalAnnualDividend += annualIncome
        totalDividendValue += p.currentValue
      }
    })

    const averageYield = totalDividendValue > 0 ? (totalAnnualDividend / totalDividendValue) * 100 : 0

    return {
      totalAnnualDividend,
      averageYield,
      dividendPositions: positions.filter(p => p.annualDividend && p.annualDividend > 0).length,
    }
  }, [positions])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
            <p className="text-slate-600">Gegevens laden...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0b1120] px-4 py-4 sm:px-8 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Portfolio</h1>
          <div className="flex flex-wrap items-center gap-2">
            {lastRefreshed && (
              <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
                Koersen: {lastRefreshed.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} {lastRefreshed.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <Button onClick={() => setShowAddPositionModal(true)} variant="secondary" className="gap-1.5 text-sm">
              <Plus className="h-3.5 w-3.5" /> Aandeel
            </Button>
            <Button onClick={() => setShowCashModal(true)} variant="secondary" className="gap-1.5 text-sm">
              <DollarSign className="h-3.5 w-3.5" /> Cash
            </Button>
            <Button
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              variant={autoRefreshEnabled ? "primary" : "secondary"}
              className="gap-1.5 text-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${autoRefreshEnabled && refreshing ? "animate-spin" : ""}`} />
              Auto {autoRefreshEnabled ? "Aan" : "Uit"}
            </Button>
            <Button onClick={() => handleRefreshPrices(false)} disabled={refreshing} variant="primary" className="gap-1.5 text-sm">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Bezig…" : "Verversen"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">

        {/* LAYER 1 — Hero + Risk (2/3 + 1/3 on desktop, stacked on mobile) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HeroCard
              totalValue={metrics.totalValue}
              netPnL={metrics.totalReturn}
              totalReturnPct={metrics.totalReturnPct}
              dailyPnL={metrics.totalDailyPnL}
              dailyPnLPct={metrics.totalDailyPnLPercent}
              ytdReturnPct={ytdReturnPct}
              portfolioId={portfolioId}
            />
          </div>
          <div className="lg:col-span-1">
            <RiskPanel
              maxDrawdownPct={maxDrawdownPct}
              exposurePct={exposurePct}
              investedValue={metrics.totalValue}
              cashValue={cashTotal}
              realizedPnL={metrics.totalRealizedPnL + metrics.totalDividendsReceived}
              dividendYTD={portfolioTotals.totalDividendsReceived}
            />
          </div>
        </div>

        {/* Cash positions (compact, only when present) */}
        {cashPositions.length > 0 && (
          <CashPositionCard
            positions={cashPositions}
            onEdit={handleEditCash}
            onDelete={handleDeleteCash}
          />
        )}

        {/* LAYER 2 — Performance chart (2/3) + Top posities (1/3) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Performance chart */}
          <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-[#0d1829] p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80">
            {/* Header row: title + mode toggle */}
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Portfolio Prestaties</h2>
                {chartMode === "value" && periodMetrics.change !== 0 && (
                  <p className={`text-sm font-medium mt-0.5 ${
                    periodMetrics.change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}>
                    <PrivacyText>
                      {periodMetrics.change >= 0 ? "+" : ""}{formatCurrency(periodMetrics.change)}
                      {" "}({periodMetrics.changePercent >= 0 ? "+" : ""}{periodMetrics.changePercent.toFixed(2)}%)
                      {" "}deze periode
                    </PrivacyText>
                  </p>
                )}
                {chartMode === "pnl" && (
                  <p className={`text-sm font-medium mt-0.5 ${
                    periodMetrics.pnlChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}>
                    <PrivacyText>
                      {periodMetrics.pnlChange >= 0 ? "+" : ""}{formatCurrency(periodMetrics.pnlChange)}
                      {" "}({periodMetrics.pnlChangePercent >= 0 ? "+" : ""}{periodMetrics.pnlChangePercent.toFixed(2)}%)
                      {" "}W/V deze periode
                    </PrivacyText>
                  </p>
                )}
              </div>
              {/* Waarde / Winst-Verlies toggle */}
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-[#0b1120] border border-slate-200 dark:border-[#1a2744] p-1 shrink-0 self-start">
                <button
                  onClick={() => setChartMode("value")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    chartMode === "value"
                      ? "bg-lime-500 text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  Waarde
                </button>
                <button
                  onClick={() => setChartMode("pnl")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    chartMode === "pnl"
                      ? "bg-lime-500 text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  Winst / Verlies
                </button>
              </div>
            </div>

            {/* Period filter */}
            <div className="mb-4 overflow-x-auto">
              <PeriodFilter
                selectedPeriod={selectedPeriod}
                onPeriodChange={setSelectedPeriod}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
                onCustomDateChange={(start, end) => {
                  setCustomStartDate(start)
                  setCustomEndDate(end)
                }}
              />
            </div>

            <div className="relative h-64 sm:h-80">
              <PerformanceChart
                data={performanceData}
                mode={chartMode}
                costBasis={chartMode === "value" && !isIntraday ? metrics.totalCost : undefined}
                intraday={isIntraday}
              />
              {historyLoading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 dark:bg-[#0d1829]/80 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-lime-500" />
                    Historische data laden…
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top posities + Verdeling */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="rounded-2xl bg-white dark:bg-[#0d1829] p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Top Posities</h2>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  <PrivacyText>{positions.length} totaal</PrivacyText>
                </span>
              </div>
              <TopPositionsChart positions={topPositions} />
            </div>
            <AllocationBreakdown positions={positions.map(p => ({
              product:      p.product,
              currentValue: p.currentValue,
              isETF:        p.isETF,
              isCrypto:     p.isCrypto,
              sector:       p.sector,
            }))} />
          </div>
        </div>

        {/* LAYER 3 — Posities tabellen */}
        {positions.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#0d1829] shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80 overflow-hidden">
            <div className="px-8 py-10 text-center border-b border-slate-100 dark:border-[#1a2744]">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-lime-500/10 border border-lime-500/20">
                <BarChart2 className="h-7 w-7 text-lime-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Welkom bij DekkerTracker</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Importeer je DEGIRO transacties om je portfolio te zien</p>
            </div>
            <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-[#1a2744] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                { step: "1", title: "Export uit DEGIRO", desc: "Ga naar Account → Transacties → Export → CSV formaat", icon: "📥" },
                { step: "2", title: "Importeer het bestand", desc: "Klik op Importeren in het menu en upload je CSV bestand", icon: "📤" },
                { step: "3", title: "Bekijk je portfolio", desc: "Koersen worden automatisch opgehaald via Yahoo Finance", icon: "📊" },
              ].map(({ step, title, desc, icon }) => (
                <div key={step} className="flex flex-col items-center gap-2 px-8 py-8 text-center">
                  <span className="text-3xl">{icon}</span>
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-lime-500 text-xs font-bold text-white">{step}</span>
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{title}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{desc}</p>
                </div>
              ))}
            </div>
            <div className="px-8 py-5 text-center bg-slate-50 dark:bg-[#0b1120]">
              <a href="/import" className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lime-400 transition-colors">
                Ga naar importeren →
              </a>
            </div>
          </div>
        ) : (
          <>
            {stocks.length > 0 && (
              <div id="stocks-section" className="scroll-mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Aandelen
                    <span className="ml-2 text-sm font-normal text-slate-400 dark:text-slate-500">
                      <PrivacyText>{stocks.length} · {formatCurrency(stocks.reduce((s, p) => s + p.currentValue, 0))}</PrivacyText>
                    </span>
                  </h2>
                </div>
                <PositionsTable positions={stocks} onDeletePosition={handleDeletePosition} />
              </div>
            )}
            {etfs.length > 0 && (
              <div id="etfs-section" className="scroll-mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    ETFs
                    <span className="ml-2 text-sm font-normal text-slate-400 dark:text-slate-500">
                      <PrivacyText>{etfs.length} · {formatCurrency(etfs.reduce((s, p) => s + p.currentValue, 0))}</PrivacyText>
                    </span>
                  </h2>
                </div>
                <PositionsTable positions={etfs} onDeletePosition={handleDeletePosition} />
              </div>
            )}
            {crypto.length > 0 && (
              <div id="crypto-section" className="scroll-mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span className="text-lg">₿</span>
                    Crypto
                    <span className="ml-1 text-sm font-normal text-slate-400 dark:text-slate-500">
                      <PrivacyText>{crypto.length} · {formatCurrency(crypto.reduce((s, p) => s + p.currentValue, 0))}</PrivacyText>
                    </span>
                  </h2>
                </div>
                <PositionsTable positions={crypto} onDeletePosition={handleDeletePosition} />
              </div>
            )}
          </>
        )}

        {/* LAYER 4 — Secundaire analyse (inklapbaar op mobiel) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Benchmark */}
          <div className="rounded-2xl bg-white dark:bg-[#0d1829] p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-[#1a2744]/80">
            <div className="mb-3 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Benchmark</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Vergelijk met marktindex</p>
                </div>
                <BenchmarkSelector selectedBenchmark={selectedBenchmark} onBenchmarkChange={setSelectedBenchmark} />
              </div>
              <PeriodFilter
                selectedPeriod={benchmarkPeriod}
                onPeriodChange={setBenchmarkPeriod}
                customStartDate={benchmarkCustomStart}
                customEndDate={benchmarkCustomEnd}
                onCustomDateChange={(s, e) => { setBenchmarkCustomStart(s); setBenchmarkCustomEnd(e) }}
              />
            </div>
            <div className="h-64">
              <BenchmarkChart data={benchmarkData} benchmarkType={selectedBenchmark} loading={benchmarkLoading} />
            </div>
          </div>

          {/* Dividend + Alerts */}
          <div className="space-y-4">
            {dividendMetrics.totalAnnualDividend > 0 && (
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 p-5 ring-1 ring-emerald-900/5 dark:ring-emerald-700/30">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">Dividend Inkomen</h2>
                <div className="flex gap-6">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Jaarlijks</p>
                    <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-400">
                      <PrivacyText>{formatCurrency(dividendMetrics.totalAnnualDividend)}</PrivacyText>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Gem. Yield</p>
                    <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-400">
                      {dividendMetrics.averageYield.toFixed(2)}%
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {dividendMetrics.dividendPositions} {dividendMetrics.dividendPositions === 1 ? "positie betaalt" : "posities betalen"} dividend
                </p>
              </div>
            )}
          </div>
        </div>

        {/* LAYER 5 — Tools */}
        <CompoundCalculator
          currentPortfolioValue={metrics.totalValue}
          targetAmount={portfolioTargetAmount}
        />

      </div>

      {/* Modals */}
      <AddManualPositionModal
        isOpen={showAddPositionModal}
        onClose={() => setShowAddPositionModal(false)}
        portfolioId={portfolioId || ""}
        onSuccess={() => {
          setShowAddPositionModal(false)
          showToast("Aandeel succesvol toegevoegd!", "success")
          loadDashboard()
        }}
      />
      <CashPositionModal
        isOpen={showCashModal}
        onClose={() => setShowCashModal(false)}
        portfolioId={portfolioId || ""}
        onSuccess={() => {
          setShowCashModal(false)
          showToast("Cash positie opgeslagen!", "success")
          loadCashPositions()
        }}
      />
      <ConfirmModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, isin: '', product: '', isManual: false })}
        onConfirm={confirmDeletePosition}
        title="Positie Verwijderen"
        message={`Weet je zeker dat je "${deleteConfirm.product}" wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.`}
        confirmText="Ja, Verwijderen"
        cancelText="Annuleren"
        variant="danger"
      />
    </DashboardLayout>
  )
}