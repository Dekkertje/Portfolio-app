import { useState } from 'react'
import { Calendar } from 'lucide-react'

type Period = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'ALL' | 'CUSTOM'

type PeriodFilterProps = {
  selectedPeriod: Period
  onPeriodChange: (period: Period) => void
  customStartDate?: string
  customEndDate?: string
  onCustomDateChange?: (startDate: string, endDate: string) => void
}

const PERIODS: { value: Period; label: string }[] = [
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1J' },
  { value: 'YTD', label: 'YTD' },
  { value: 'ALL', label: 'Alles' },
]

export function PeriodFilter({
  selectedPeriod,
  onPeriodChange,
  customStartDate,
  customEndDate,
  onCustomDateChange
}: PeriodFilterProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [startDate, setStartDate] = useState(customStartDate || '')
  const [endDate, setEndDate] = useState(customEndDate || '')

  const handleCustomClick = () => {
    setShowCustom(!showCustom)
    if (!showCustom) {
      onPeriodChange('CUSTOM')
    }
  }

  const handleApplyCustom = () => {
    if (startDate && endDate && onCustomDateChange) {
      onCustomDateChange(startDate, endDate)
      setShowCustom(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="inline-flex rounded-lg bg-slate-100 p-1">
        {PERIODS.map((period) => (
          <button
            key={period.value}
            onClick={() => onPeriodChange(period.value)}
            className={`
              rounded-md px-3 py-1.5 text-sm font-medium transition-all
              ${
                selectedPeriod === period.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }
            `}
          >
            {period.label}
          </button>
        ))}
        <button
          onClick={handleCustomClick}
          className={`
            rounded-md px-3 py-1.5 text-sm font-medium transition-all flex items-center gap-1
            ${
              selectedPeriod === 'CUSTOM'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }
          `}
        >
          <Calendar className="h-4 w-4" />
          Aangepast
        </button>
      </div>

      {showCustom && (
        <div className="rounded-lg bg-white p-4 shadow-lg ring-1 ring-slate-200 flex flex-col gap-3">
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Van</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Tot</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApplyCustom}
              disabled={!startDate || !endDate}
              className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              Toepassen
            </button>
            <button
              onClick={() => setShowCustom(false)}
              className="flex-1 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export type { Period }

