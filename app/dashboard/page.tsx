"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { AllocationChart } from "@/components/dashboard/AllocationChart"
import { PerformanceChart } from "@/components/dashboard/PerformanceChart"
import { PositionsTable } from "@/components/dashboard/PositionsTable"
import { Button } from "@/components/ui/Button"
import { useToast } from "@/components/ui/Toast"
import { RefreshCw, Plus, DollarSign, BarChart2 } from "lucide-react"
import { Transaction, Price, Position, PriceAlert } from "@/lib/types"
import { formatCurrency, isETF, getSector, generatePerformanceData, generateBenchmarkData, BenchmarkType } from "@/lib/utils"
import { PeriodFilter, Period } from "@/components/dashboard/PeriodFilter"
import { BenchmarkChart } from "@/components/dashboard/BenchmarkChart"
import { BenchmarkSelector } from "@/components/dashboard/BenchmarkSelector"
import { AlertsPanel } from "@/components/dashboard/AlertsPanel"
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
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [portfolioId, setPortfolioId] = useState<string | null>(null)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
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
      const { data: userData, error: authError } = await supabase.auth.getUser()

      if (authError || !userData.user) {
        window.location.href = "/login"
        return
      }

      const { data: portfolio } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", userData.user.id)
        .single()

      if (!portfolio) {
        setLoading(false)
        return
      }

      setPortfolioId(portfolio.id)
      loadAlerts()

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
        // Prices loaded successfully (server-side logging only)
        for (const price of prices as Price[]) {
          const key = `${price.product}__${price.isin || ""}`

          if (!latestPriceMap[key]) {
            latestPriceMap[key] = price
          }
        }
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
          const isProductETF = isETF(tx.product)

          // Debug ETF classification for Netflix
          if (tx.product.toUpperCase().includes("NETFLIX")) {
            // eslint-disable-next-line no-console
            console.log(`🎬 Netflix classification: isETF=${isProductETF}, product="${tx.product}"`)
          }

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
            isETF: isProductETF,
          }
        }

        const absQuantity = Math.abs(Number(tx.quantity))
        const total = Math.abs(Number(tx.total_eur))
        const fees = Math.abs(Number(tx.transaction_fee || 0)) + Math.abs(Number(tx.autofx_cost || 0))

        // Track fees for informational purposes
        grouped[key].totalFees += fees

        // Debug ASML transactions
        if (tx.product.toUpperCase().includes("ASML")) {
          // eslint-disable-next-line no-console
          console.log(`ASML TX: ${tx.trade_date} | Type: ${tx.transaction_type} | Qty: ${tx.quantity} | Total: ${tx.total_eur} | Current position: ${grouped[key].quantity}`)
        }

        if (tx.transaction_type === "buy") {
          grouped[key].quantity += absQuantity
          // total_eur already includes fees from DEGIRO
          grouped[key].invested += total
        }

        if (tx.transaction_type === "sell") {
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

        // Debug ASML position after transaction
        if (tx.product.toUpperCase().includes("ASML")) {
          // eslint-disable-next-line no-console
          console.log(`  → After: ${grouped[key].quantity} aandelen | Invested: €${grouped[key].invested.toFixed(2)}`)
        }
      }

      // Add manual positions to grouped
      if (manualPositions && manualPositions.length > 0) {
        for (const mp of manualPositions) {
          const key = `${mp.product_name}__${mp.isin || mp.yahoo_symbol}`

          if (!grouped[key]) {
            grouped[key] = {
              product: mp.product_name,
              isin: mp.isin || mp.yahoo_symbol,
              quantity: mp.quantity,
              avgPrice: mp.average_price,
              invested: mp.quantity * mp.average_price,
              currentPrice: 0,
              currentValue: 0,
              totalFees: 0,
              realizedPnL: 0,
              isETF: isETF(mp.product_name),
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

          // Debug price source
          if (!priceData) {
            // eslint-disable-next-line no-console
            console.log(`⚠️  Using avg price for ${p.product}: €${avgPrice.toFixed(2)} (no market data)`)
          }

          // Daily P&L calculation - use previous_close from database
          // Note: If previous_close is not available, we cannot calculate daily P&L accurately
          const previousClose = priceData?.previous_close ? Number(priceData.previous_close) : undefined
          const dayChange = previousClose ? currentPrice - previousClose : undefined
          const dayChangePercent = (previousClose && dayChange) ? (dayChange / previousClose) * 100 : undefined
          const dayChangeValue = dayChange ? dayChange * p.quantity : undefined

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
    loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAlerts() {
    try {
      const res = await fetch("/api/alerts")
      if (res.ok) {
        const data = await res.json()
        setAlerts(data.alerts || [])
      }
    } catch (error) {
      console.error("Error loading alerts:", error)
    }
  }

  async function handleCreateAlert(alert: Omit<PriceAlert, "id" | "user_id" | "created_at">) {
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alert),
      })

      if (res.ok) {
        showToast("Alert aangemaakt!", "success")
        loadAlerts()
      } else {
        const data = await res.json()
        showToast(data.error || "Fout bij aanmaken alert", "error")
      }
    } catch (error) {
      console.error("Error creating alert:", error)
      showToast("Er ging iets mis bij het aanmaken van de alert", "error")
    }
  }

  async function handleDeleteAlert(id: string) {
    try {
      const res = await fetch(`/api/alerts?id=${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        showToast("Alert verwijderd", "success")
        loadAlerts()
      } else {
        const data = await res.json()
        showToast(data.error || "Fout bij verwijderen alert", "error")
      }
    } catch (error) {
      console.error("Error deleting alert:", error)
      showToast("Er ging iets mis bij het verwijderen van de alert", "error")
    }
  }

  async function savePortfolioSnapshot() {
    if (!portfolioId) return

    try {
      const res = await fetch("/api/save-snapshot", {
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
      const res = await fetch(`/api/cash-positions?portfolio_id=${portfolioId}`)
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
      const res = await fetch(`/api/cash-positions?id=${id}`, {
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
        const res = await fetch(`/api/manual-positions?id=${manualPositionId}`, {
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

        const res = await fetch(`/api/transactions?${params.toString()}`, {
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
    if (!silent) {
      // eslint-disable-next-line no-console
      console.log("🔄 Starting price refresh...")
    }
    try {
      const res = await fetch("/api/refresh-prices", {
        method: "POST",
      })

      if (!silent) {
        // eslint-disable-next-line no-console
        console.log(`📡 API Response status: ${res.status}`)
      }

      const data = await res.json()

      // Price refresh completed (sensitive data not logged to console)

      if (!res.ok) {
        if (!silent) {
          showToast(data.error || "Er ging iets mis bij het verversen van koersen.", "error")
        }
        return
      }

      if (!silent) {
        showToast(data.message || `${data.inserted} koersen ververst!`, "success")
      }
      await loadDashboard() // Reload data instead of full page refresh

      // Auto-save snapshot after successful price refresh
      if (!silent) {
        setTimeout(() => savePortfolioSnapshot(), 1000)
      }
    } catch (error) {
      if (!silent) {
        console.error("❌ Error refreshing prices:", error)
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
    }, 10000) // 10 seconds

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
  const { stocks, etfs, metrics, sectorData } = useMemo(() => {
    const stocksList = positions.filter(p => !p.isETF)
    const etfsList = positions.filter(p => p.isETF)

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
  const [performanceData, setPerformanceData] = useState<{ date: string; value: number; invested: number }[]>([])

  useEffect(() => {
    async function loadPerformanceData() {
      // Always generate simulated data as fallback first
      const simulatedData = generatePerformanceData(
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
        const res = await fetch(`/api/save-snapshot?portfolio_id=${portfolioId}&period=${selectedPeriod}`)
        if (res.ok) {
          const { snapshots } = await res.json()

          if (snapshots && snapshots.length > 0) {
            // Convert snapshots to chart points
            const snapshotPoints: { date: string; value: number; invested: number; isoDate: string }[] =
              snapshots.map((snap: any) => ({
                isoDate:  snap.snapshot_date as string,
                date:     new Date(snap.snapshot_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
                value:    Number(snap.total_value),
                invested: Number(snap.total_cost),
              }))

            const firstSnapIso = snapshots[0]?.snapshot_date as string | undefined

            // Prepend transaction-based cost-basis points for dates BEFORE the first
            // snapshot so the chart starts from when investments actually began.
            const preTxPoints: { date: string; value: number; invested: number }[] = []

            if (firstSnapIso && txTimeline.length > 0) {
              for (const pt of txTimeline) {
                if (pt.date < firstSnapIso) {
                  preTxPoints.push({
                    date:     new Date(pt.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit' }),
                    value:    pt.cost,   // before price data: value = cost (0 P&L)
                    invested: pt.cost,
                  })
                }
              }
            }

            const historicalData = [
              ...preTxPoints,
              ...snapshotPoints.map(({ isoDate: _iso, ...rest }) => rest),
            ]

            // Add today's live values if today not already in snapshots
            const today = new Date().toISOString().split('T')[0]
            const hasToday = snapshots.some((s: any) => s.snapshot_date === today)
            if (!hasToday) {
              historicalData.push({
                date:     new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
                value:    metrics.totalValue,
                invested: metrics.totalCost,
              })
            }

            setPerformanceData(historicalData)
          } else {
            // No snapshots, use simulated data
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
  }, [metrics.totalCost, metrics.totalValue, selectedPeriod, customStartDate, customEndDate, portfolioId, txTimeline])

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

  // Period-specific performance metrics
  const periodMetrics = useMemo(() => {
    if (performanceData.length < 2) {
      return { change: 0, changePercent: 0 }
    }

    const firstValue = performanceData[0].value
    const lastValue = performanceData[performanceData.length - 1].value
    const change = lastValue - firstValue
    const changePercent = firstValue > 0 ? (change / firstValue) * 100 : 0

    return { change, changePercent }
  }, [performanceData])

  // Benchmark data — portfolio line uses real snapshots (normalized to 100 at start),
  // benchmark line uses period-scaled historical average return.
  const benchmarkData = useMemo(() => {
    if (performanceData.length < 2) return generateBenchmarkData(selectedPeriod, selectedBenchmark)

    const firstValue = performanceData[0].value
    if (firstValue === 0) return generateBenchmarkData(selectedPeriod, selectedBenchmark)

    // Annualised average returns per index
    const annualReturns: Record<BenchmarkType, number> = {
      sp500: 0.10, nasdaq100: 0.13, aex: 0.08, msci_world: 0.09,
    }

    // Scale to the period
    const scaleFactor = (() => {
      if (selectedPeriod === '1W')  return 7   / 365
      if (selectedPeriod === '1M')  return 30  / 365
      if (selectedPeriod === '3M')  return 91  / 365
      if (selectedPeriod === '6M')  return 182 / 365
      if (selectedPeriod === '1Y')  return 1
      if (selectedPeriod === 'YTD') {
        const daysSinceJan1 = (Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86_400_000
        return daysSinceJan1 / 365
      }
      // ALL: approximate from number of data points (daily snapshots)
      return Math.max(performanceData.length, 1) / 252
    })()

    const totalBenchmarkReturn = annualReturns[selectedBenchmark] * scaleFactor
    const n = performanceData.length

    return performanceData.map((d, i) => {
      const progress = i / Math.max(n - 1, 1)
      return {
        date:      d.date,
        // Portfolio: actual relative return in %, e.g. +5.3 means +5.3%
        portfolio: ((d.value / firstValue) - 1) * 100,
        // Benchmark: simulated relative return in %
        benchmark: totalBenchmarkReturn * progress * 100,
      }
    })
  }, [performanceData, selectedBenchmark, selectedPeriod])

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
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4 sm:px-8 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Portfolio</h1>
          <div className="flex flex-wrap gap-2">
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
              totalCapitalDeployed={metrics.totalCapitalDeployed}
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
          <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/50">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Portfolio Prestaties</h2>
                {periodMetrics.change !== 0 && (
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
              </div>
              <div className="overflow-x-auto shrink-0">
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
            </div>
            <div className="h-64 sm:h-80">
              <PerformanceChart data={performanceData} costBasis={metrics.totalCost} />
            </div>
          </div>

          {/* Top posities */}
          <div className="lg:col-span-1 rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/50">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Top Posities</h2>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                <PrivacyText>{positions.length} totaal</PrivacyText>
              </span>
            </div>
            <TopPositionsChart positions={topPositions} />
          </div>
        </div>

        {/* LAYER 3 — Posities tabellen */}
        {positions.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-slate-800 p-12 text-center shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/50">
            <BarChart2 className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="font-medium text-slate-600 dark:text-slate-400">Geen posities gevonden</p>
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
              Importeer transacties of voeg handmatig aandelen toe
            </p>
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
          </>
        )}

        {/* LAYER 4 — Secundaire analyse (inklapbaar op mobiel) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Benchmark */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/50">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Benchmark</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Vergelijk met marktindex</p>
              </div>
              <BenchmarkSelector selectedBenchmark={selectedBenchmark} onBenchmarkChange={setSelectedBenchmark} />
            </div>
            <div className="h-64">
              <BenchmarkChart data={benchmarkData} benchmarkType={selectedBenchmark} />
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
            <AlertsPanel alerts={alerts} onCreateAlert={handleCreateAlert} onDeleteAlert={handleDeleteAlert} />
          </div>
        </div>

        {/* LAYER 5 — Tools */}
        <CompoundCalculator />

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