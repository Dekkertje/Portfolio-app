"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { BenchmarkType, getBenchmarkName } from "@/lib/utils"

type BenchmarkChartProps = {
  data: {
    date: string
    portfolio: number
    benchmark: number
  }[]
  benchmarkType: BenchmarkType
}

export function BenchmarkChart({ data, benchmarkType }: BenchmarkChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Geen data beschikbaar
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          stroke="#64748b"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke="#64748b"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => `${value.toFixed(0)}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px'
          }}
          formatter={(value) => `${Number(value).toFixed(2)}%`}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px' }}
        />
        <Line
          type="monotone"
          dataKey="portfolio"
          name="Jouw Portfolio"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="benchmark"
          name={getBenchmarkName(benchmarkType)}
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          strokeDasharray="5 5"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

