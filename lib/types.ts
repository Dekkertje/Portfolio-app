// Database types
export type Transaction = {
  id: string
  portfolio_id?: string
  trade_date: string | null
  trade_time: string | null
  product: string
  isin: string | null
  exchange?: string | null
  venue?: string | null
  quantity: number
  price: number
  local_value?: number
  value_eur?: number
  fx_rate?: number
  autofx_cost?: number
  transaction_fee?: number
  total_eur: number
  order_id?: string | null
  transaction_type: string | null
}

export type Price = {
  id: string
  product: string
  isin: string | null
  price: number
  currency?: string
  price_date: string | null
  source?: string
  previous_close?: number
  change_percent?: number
  sector?: string
}

export type Portfolio = {
  id: string
  user_id: string
  name?: string
  created_at?: string
}

export type Position = {
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
  sector?: string
  previousClose?: number
  dayChange?: number
  dayChangePercent?: number
  dayChangeValue?: number // Total € change for this position today
  dividendYield?: number
  annualDividend?: number
  totalDividendsReceived?: number // Total dividends received for this position
  nextDividendDate?: string
  nextEarningsDate?: string // Next earnings announcement date
  isManual?: boolean // Flag to identify manual positions
  manualPositionId?: string // ID for manual positions
}

// Portfolio Snapshots for historical tracking
export type PortfolioSnapshot = {
  id: string
  portfolio_id: string
  snapshot_date: string
  total_value: number
  total_cost: number
  total_return: number
  total_return_pct: number
  position_count: number
  created_at?: string
}

// Dividend tracking
export type Dividend = {
  id: string
  product: string
  isin: string | null
  ex_date: string
  payment_date: string | null
  amount_per_share: number
  currency: string
  frequency: 'annual' | 'quarterly' | 'monthly' | null
  created_at?: string
}

// Price alerts
export type PriceAlert = {
  id: string
  user_id: string
  product: string
  isin: string | null
  alert_type: 'above' | 'below' | 'change_percent'
  target_value: number
  current_value?: number
  is_active: boolean
  triggered_at?: string | null
  created_at?: string
}

// Benchmark data
export type BenchmarkData = {
  date: string
  sp500: number
  aex: number
}

// UI/Display types
export type User = {
  id: string
  email: string | null
}

