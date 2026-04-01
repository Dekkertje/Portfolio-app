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
import { Wallet, TrendingUp, PiggyBank, Percent, RefreshCw } from "lucide-react"
import { Transaction, Price, Position, PriceAlert } from "@/lib/types"
import { formatCurrency, isETF, getSector, generatePerformanceData, generateBenchmarkData, calculateDividendYield, BenchmarkType } from "@/lib/utils"
import { PeriodFilter, Period } from "@/components/dashboard/PeriodFilter"
import { BenchmarkChart } from "@/components/dashboard/BenchmarkChart"
import { BenchmarkSelector } from "@/components/dashboard/BenchmarkSelector"
import { AlertsPanel } from "@/components/dashboard/AlertsPanel"

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

      if (txError || !transactions) {
        showToast("Fout bij laden van transacties", "error")
        setLoading(false)
        return
      }

      const latestPriceMap: Record<string, Price> = {}

      if (!priceError && prices) {
        // eslint-disable-next-line no-console
        console.log(`📊 Loaded ${prices.length} price records from database`)
        for (const price of prices as Price[]) {
          const key = `${price.product}__${price.isin || ""}`

          if (!latestPriceMap[key]) {
            latestPriceMap[key] = price
            // eslint-disable-next-line no-console
            console.log(`  💰 ${price.product}: €${price.price} | prev_close: ${price.previous_close || 'NULL'} (${price.source}, ${price.price_date})`)
          }
        }
      } else {
        // eslint-disable-next-line no-console
        console.log('⚠️  No prices loaded from database')
      }

      const grouped: Record<string, Position> = {}

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

          // Make sure invested doesn't go negative due to rounding
          if (grouped[key].invested < 0) grouped[key].invested = 0
        }

        // Debug ASML position after transaction
        if (tx.product.toUpperCase().includes("ASML")) {
          // eslint-disable-next-line no-console
          console.log(`  → After: ${grouped[key].quantity} aandelen | Invested: €${grouped[key].invested.toFixed(2)}`)
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

          // Get sector
          const sector = getSector(p.product, p.isin)

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
          }
        })
        .filter(Boolean) as Position[]

      const sortedPositions = calculatedPositions.sort((a, b) => b.currentValue - a.currentValue)

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

      if (!silent) {
        // eslint-disable-next-line no-console
        console.log("📦 API Response data:", data)

        if (data.errors && data.errors.length > 0) {
          // eslint-disable-next-line no-console
          console.error("🚨 Price refresh errors:")
          data.errors.forEach((err: string) => {
            // eslint-disable-next-line no-console
            console.error("  ", err)
          })
        }
      }

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

      // Auto-save snapshot after successful price refresh (disabled for now due to table issues)
      // setTimeout(() => savePortfolioSnapshot(), 1000)
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

    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0)
    const totalCost = positions.reduce((sum, p) => sum + p.invested, 0)
    const totalFees = positions.reduce((sum, p) => sum + p.totalFees, 0)
    const totalRealizedPnL = positions.reduce((sum, p) => sum + p.realizedPnL, 0)

    // Unrealized P&L = current value of open positions - cost basis
    const unrealizedPnL = totalValue - totalCost

    // Total return = unrealized gains on open positions + realized gains from closed positions
    // Fees are already included in total_eur from DEGIRO, so we don't subtract them again
    const totalReturn = unrealizedPnL + totalRealizedPnL
    const totalReturnPct = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0

    // Calculate daily P&L
    let positionsWithPreviousClose = 0
    let positionsWithoutPreviousClose = 0

    const totalDailyPnL = positions.reduce((sum, p) => {
      const hasPreviousClose = p.dayChange !== undefined && p.previousClose !== undefined
      const dailyChange = hasPreviousClose ? (p.dayChange! * p.quantity) : 0

      if (hasPreviousClose) {
        positionsWithPreviousClose++
        // Log ALL positions with previous close data - comparing to DEGIRO
        // eslint-disable-next-line no-console
        console.log(`💵 ${p.product}: qty=${p.quantity}, current=€${p.currentPrice.toFixed(2)}, prev=€${p.previousClose!.toFixed(2)}, change=€${p.dayChange!.toFixed(2)}, total=€${dailyChange.toFixed(2)}`)

        // Calculate what previous_close SHOULD be based on DEGIRO data
        // For debugging: if we know DEGIRO's W/V, what would previous_close need to be?
        // Formula: previous_close = current - (DEGIRO_WV / quantity)
        // eslint-disable-next-line no-console
        console.log(`   📊 To match DEGIRO, if W/V should be different, recalculate: currentPrice=${p.currentPrice.toFixed(2)}, qty=${p.quantity}`)
      } else {
        positionsWithoutPreviousClose++
        // eslint-disable-next-line no-console
        console.log(`⚠️  ${p.product}: NO previous_close data (qty=${p.quantity}, value=€${p.currentValue.toFixed(2)})`)
      }

      return sum + dailyChange
    }, 0)

    // eslint-disable-next-line no-console
    console.log(`\n📊 Daily P&L Summary:`)
    // eslint-disable-next-line no-console
    console.log(`   ✅ Positions with previous_close: ${positionsWithPreviousClose}`)
    // eslint-disable-next-line no-console
    console.log(`   ⚠️  Positions WITHOUT previous_close: ${positionsWithoutPreviousClose}`)
    // eslint-disable-next-line no-console
    console.log(`   💰 Total Daily P&L: €${totalDailyPnL.toFixed(2)}\n`)

    const totalDailyPnLPercent = totalValue > 0 ? (totalDailyPnL / totalValue) * 100 : 0

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
        unrealizedPnL,
        totalReturn,
        totalReturnPct,
        totalDailyPnL,
        totalDailyPnLPercent,
      },
      sectorData: sectorAllocation,
    }
  }, [positions])

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
  const performanceData = useMemo(() => {
    return generatePerformanceData(
      metrics.totalCost,
      metrics.totalValue,
      selectedPeriod,
      customStartDate,
      customEndDate
    )
  }, [metrics.totalCost, metrics.totalValue, selectedPeriod, customStartDate, customEndDate])

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

  // Benchmark data for comparison
  const benchmarkData = useMemo(() => {
    return generateBenchmarkData(selectedPeriod, selectedBenchmark)
  }, [selectedPeriod, selectedBenchmark])

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
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              Welkom terug! Bekijk je portfolio prestaties
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={savePortfolioSnapshot}
              disabled={!portfolioId}
              variant="secondary"
              className="gap-2"
            >
              <PiggyBank className="h-4 w-4" />
              Snapshot Opslaan
            </Button>
            <Button
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              variant={autoRefreshEnabled ? "primary" : "secondary"}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${autoRefreshEnabled ? "animate-spin" : ""}`} />
              Auto-refresh {autoRefreshEnabled ? "Aan" : "Uit"}
            </Button>
            <Button
              onClick={() => handleRefreshPrices(false)}
              disabled={refreshing}
              variant="primary"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Bezig..." : "Nu Verversen"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8">
        {/* Overview Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div
            className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-sm ring-1 ring-blue-100 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => scrollToSection('stocks-section')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-600">Aandelen</p>
                <p className="mt-1 text-2xl font-bold text-blue-900">
                  {stocks.length}
                </p>
                <p className="mt-1 text-sm text-blue-700">
                  {formatCurrency(stocks.reduce((sum, p) => sum + p.currentValue, 0))}
                </p>
              </div>
              <div className="rounded-lg bg-blue-100 p-2">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div
            className="rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 p-4 shadow-sm ring-1 ring-purple-100 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => scrollToSection('etfs-section')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-purple-600">ETFs</p>
                <p className="mt-1 text-2xl font-bold text-purple-900">
                  {etfs.length}
                </p>
                <p className="mt-1 text-sm text-purple-700">
                  {formatCurrency(etfs.reduce((sum, p) => sum + p.currentValue, 0))}
                </p>
              </div>
              <div className="rounded-lg bg-purple-100 p-2">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 p-4 shadow-sm ring-1 ring-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-green-600">Gerealiseerd</p>
                <p className="mt-1 text-2xl font-bold text-green-900">
                  {formatCurrency(metrics.totalRealizedPnL)}
                </p>
                <p className="mt-1 text-sm text-green-700">
                  Uit verkopen
                </p>
              </div>
              <div className="rounded-lg bg-green-100 p-2">
                <Wallet className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm ring-1 ring-amber-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-amber-600">Ongerealiseerd</p>
                <p className={`mt-1 text-2xl font-bold ${metrics.unrealizedPnL >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                  {formatCurrency(metrics.unrealizedPnL)}
                </p>
                <p className="mt-1 text-sm text-amber-700">
                  Huidige posities
                </p>
              </div>
              <div className="rounded-lg bg-amber-100 p-2">
                <PiggyBank className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className={`rounded-xl bg-gradient-to-br p-4 shadow-sm ring-1 ${
            metrics.totalDailyPnL >= 0
              ? 'from-teal-50 to-cyan-50 ring-teal-100'
              : 'from-rose-50 to-red-50 ring-rose-100'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-medium ${metrics.totalDailyPnL >= 0 ? 'text-teal-600' : 'text-rose-600'}`}>
                  Dagwinst/Verlies
                </p>
                <p className={`mt-1 text-2xl font-bold ${metrics.totalDailyPnL >= 0 ? 'text-teal-900' : 'text-rose-900'}`}>
                  {formatCurrency(metrics.totalDailyPnL)}
                </p>
                <p className={`mt-1 text-sm ${metrics.totalDailyPnL >= 0 ? 'text-teal-700' : 'text-rose-700'}`}>
                  {metrics.totalDailyPnLPercent >= 0 ? '+' : ''}{metrics.totalDailyPnLPercent.toFixed(2)}%
                </p>
              </div>
              <div className={`rounded-lg p-2 ${metrics.totalDailyPnL >= 0 ? 'bg-teal-100' : 'bg-rose-100'}`}>
                <TrendingUp className={`h-6 w-6 ${metrics.totalDailyPnL >= 0 ? 'text-teal-600' : 'text-rose-600'}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Main Metrics Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Portfolio Waarde"
            value={formatCurrency(metrics.totalValue)}
            change={{
              value: `${metrics.totalReturnPct >= 0 ? "+" : ""}${metrics.totalReturnPct.toFixed(2)}%`,
              isPositive: metrics.totalReturnPct >= 0,
            }}
            icon={Wallet}
            iconColor="bg-indigo-600"
          />
          <MetricCard
            title="Geïnvesteerd"
            value={formatCurrency(metrics.totalCost)}
            icon={PiggyBank}
            iconColor="bg-purple-600"
          />
          <MetricCard
            title="Totaal Rendement"
            value={formatCurrency(metrics.totalReturn)}
            change={{
              value: `Incl. fees & verkopen`,
              isPositive: metrics.totalReturn >= 0,
            }}
            icon={TrendingUp}
            iconColor={metrics.totalReturn >= 0 ? "bg-green-600" : "bg-red-600"}
          />
          <MetricCard
            title="Return %"
            value={`${metrics.totalReturnPct >= 0 ? "+" : ""}${metrics.totalReturnPct.toFixed(2)}%`}
            icon={Percent}
            iconColor={metrics.totalReturnPct >= 0 ? "bg-emerald-600" : "bg-rose-600"}
          />
        </div>

        {/* Charts Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Performance Chart */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
            <div className="mb-4 flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Portfolio Prestaties</h2>
                  <p className="text-sm text-slate-500">Waarde ontwikkeling over tijd</p>
                </div>
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
              {/* Period-specific metrics */}
              <div className="flex items-center gap-4 rounded-lg bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-slate-500">Periode Rendement</p>
                  <p className={`text-lg font-bold ${periodMetrics.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(periodMetrics.change)}
                  </p>
                </div>
                <div className="h-8 w-px bg-slate-300" />
                <div>
                  <p className="text-xs font-medium text-slate-500">Percentage</p>
                  <p className={`text-lg font-bold ${periodMetrics.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {periodMetrics.changePercent >= 0 ? '+' : ''}{periodMetrics.changePercent.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
            <div className="h-[320px]">
              <PerformanceChart data={performanceData} />
            </div>
          </div>

          {/* Asset Type Allocation */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Verdeling Type</h2>
              <p className="text-sm text-slate-500">Aandelen vs ETFs</p>
            </div>
            <div className="h-[320px]">
              {allocationData.length > 0 ? (
                <AllocationChart data={allocationData} />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">
                  Geen data beschikbaar
                </div>
              )}
            </div>
          </div>

          {/* Stocks Allocation */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Aandelen Verdeling</h2>
              <p className="text-sm text-slate-500">{stocks.length} posities</p>
            </div>
            <div className="h-[320px]">
              {stocksAllocationData.length > 0 ? (
                <AllocationChart data={stocksAllocationData} />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">
                  Geen aandelen posities
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ETFs Allocation Chart - separate row if ETFs exist */}
        {etfsAllocationData.length > 0 && (
          <div className="mb-8">
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">ETFs Verdeling</h2>
                <p className="text-sm text-slate-500">{etfs.length} posities</p>
              </div>
              <div className="h-[320px]">
                <AllocationChart data={etfsAllocationData} />
              </div>
            </div>
          </div>
        )}

        {/* Sector Allocation Chart */}
        {sectorData.length > 0 && (
          <div className="mb-8">
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Sector Verdeling</h2>
                <p className="text-sm text-slate-500">Portfolio allocatie per sector</p>
              </div>
              <div className="h-[320px]">
                <AllocationChart data={sectorData} />
              </div>
            </div>
          </div>
        )}

        {/* Benchmark Comparison & Dividend/Alerts Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Benchmark Comparison */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Benchmark Vergelijking</h2>
                <p className="text-sm text-slate-500">Vergelijk je portfolio met marktindices</p>
              </div>
              <BenchmarkSelector
                selectedBenchmark={selectedBenchmark}
                onBenchmarkChange={setSelectedBenchmark}
              />
            </div>
            <div className="h-[320px]">
              <BenchmarkChart data={benchmarkData} benchmarkType={selectedBenchmark} />
            </div>
          </div>

          {/* Dividend Metrics & Alerts */}
          <div className="space-y-6">
            {/* Dividend Metrics Card */}
            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-sm ring-1 ring-emerald-900/5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Dividend Inkomen</h2>
                <p className="text-sm text-slate-500">Verwacht jaarlijks inkomen</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-600">Jaarlijks Inkomen</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700">
                    {formatCurrency(dividendMetrics.totalAnnualDividend)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">Gemiddeld Yield</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700">
                    {dividendMetrics.averageYield.toFixed(2)}%
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-white/50 px-3 py-2">
                <p className="text-sm text-slate-600">
                  {dividendMetrics.dividendPositions} {dividendMetrics.dividendPositions === 1 ? 'positie betaalt' : 'posities betalen'} dividend
                </p>
              </div>
            </div>

            {/* Price Alerts */}
            <AlertsPanel
              alerts={alerts}
              onCreateAlert={handleCreateAlert}
              onDeleteAlert={handleDeleteAlert}
            />
          </div>
        </div>

        {/* Aandelen Table */}
        {stocks.length > 0 && (
          <div id="stocks-section" className="mb-8 scroll-mt-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Aandelen</h2>
                <p className="text-sm text-slate-500">
                  {stocks.length} positie{stocks.length !== 1 ? "s" : ""} · Waarde: {formatCurrency(stocks.reduce((sum, p) => sum + p.currentValue, 0))}
                </p>
              </div>
            </div>
            <PositionsTable positions={stocks} />
          </div>
        )}

        {/* ETFs Table */}
        {etfs.length > 0 && (
          <div id="etfs-section" className="mb-8 scroll-mt-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">ETFs</h2>
                <p className="text-sm text-slate-500">
                  {etfs.length} positie{etfs.length !== 1 ? "s" : ""} · Waarde: {formatCurrency(etfs.reduce((sum, p) => sum + p.currentValue, 0))}
                </p>
              </div>
            </div>
            <PositionsTable positions={etfs} />
          </div>
        )}

        {/* Empty State */}
        {positions.length === 0 && (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-900/5">
            <p className="text-slate-500">Geen posities gevonden</p>
            <p className="mt-2 text-sm text-slate-400">
              Importeer transacties om je portfolio te vullen
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}