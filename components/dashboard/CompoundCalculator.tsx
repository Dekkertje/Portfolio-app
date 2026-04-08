"use client"

import { useState, useMemo } from "react"
import { Calculator } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { useTheme } from "@/contexts/ThemeContext"
import { PrivacyText } from "@/components/ui/PrivacyText"

export function CompoundCalculator() {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  const [initialAmount, setInitialAmount] = useState("10000")
  const [monthlyContribution, setMonthlyContribution] = useState("500")
  const [expectedReturn, setExpectedReturn] = useState("7")
  const [years, setYears] = useState("10")

  const chartData = useMemo(() => {
    const initial = parseFloat(initialAmount) || 0
    const monthly = parseFloat(monthlyContribution) || 0
    const rate = (parseFloat(expectedReturn) || 0) / 100
    const totalYears = parseInt(years) || 0

    const data = []
    let totalInvested = initial
    let totalValue = initial

    for (let year = 0; year <= totalYears; year++) {
      if (year > 0) {
        // Add monthly contributions
        totalInvested += monthly * 12
        
        // Calculate compound interest
        totalValue = totalValue * (1 + rate) + (monthly * 12 * (1 + rate / 2))
      }

      data.push({
        year,
        invested: Math.round(totalInvested),
        value: Math.round(totalValue),
        profit: Math.round(totalValue - totalInvested),
      })
    }

    return data
  }, [initialAmount, monthlyContribution, expectedReturn, years])

  const finalValue = chartData[chartData.length - 1]

  return (
    <div className="rounded-xl bg-white dark:bg-slate-800 p-6 shadow-sm ring-1 ring-slate-900/5 dark:ring-slate-700/50">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/30 p-2">
          <Calculator className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Compound Interest Calculator
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Projecteer je toekomstige vermogen
          </p>
        </div>
      </div>

      {/* Input Fields */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Startbedrag (€)
          </label>
          <input
            type="number"
            value={initialAmount}
            onChange={(e) => setInitialAmount(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Maandelijkse Inleg (€)
          </label>
          <input
            type="number"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Verwacht Rendement (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={expectedReturn}
            onChange={(e) => setExpectedReturn(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Jaren
          </label>
          <input
            type="number"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Results */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-4">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Totaal Geïnvesteerd</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            <PrivacyText>€{finalValue.invested.toLocaleString()}</PrivacyText>
          </p>
        </div>

        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 p-4">
          <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Eindwaarde</p>
          <p className="mt-1 text-2xl font-bold text-indigo-900 dark:text-indigo-100">
            <PrivacyText>€{finalValue.value.toLocaleString()}</PrivacyText>
          </p>
        </div>

        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4">
          <p className="text-xs font-medium text-green-700 dark:text-green-300">Winst</p>
          <p className="mt-1 text-2xl font-bold text-green-900 dark:text-green-100">
            <PrivacyText>€{finalValue.profit.toLocaleString()}</PrivacyText>
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={isDark ? "#334155" : "#e2e8f0"} 
            />
            <XAxis
              dataKey="year"
              stroke={isDark ? "#94a3b8" : "#64748b"}
              fontSize={12}
              tickFormatter={(value) => `Jaar ${value}`}
            />
            <YAxis
              stroke={isDark ? "#94a3b8" : "#64748b"}
              fontSize={12}
              tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#1e293b" : "white",
                border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
                borderRadius: "8px",
                color: isDark ? "#f1f5f9" : "#0f172a",
              }}
              formatter={(value: number) => `€${value.toLocaleString()}`}
            />
            <Legend
              wrapperStyle={{
                fontSize: "12px",
                color: isDark ? "#f1f5f9" : "#0f172a",
              }}
            />
            <Line
              type="monotone"
              dataKey="invested"
              name="Geïnvesteerd"
              stroke="#94a3b8"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="value"
              name="Waarde"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
