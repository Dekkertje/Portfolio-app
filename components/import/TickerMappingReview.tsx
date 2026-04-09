"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { CheckCircle2, AlertTriangle, XCircle, Edit2, Search } from "lucide-react"

type TickerSuggestion = {
  isin: string
  product: string
  exchange: string | null
  suggested_ticker: string | null
  yahoo_symbol: string | null
  confidence_score: number
  match_method: string
  is_approved: boolean
}

type TickerMappingReviewProps = {
  suggestions: TickerSuggestion[]
  onApprove: (suggestion: TickerSuggestion) => void
  onEdit: (suggestion: TickerSuggestion) => void
  onSkip: (suggestion: TickerSuggestion) => void
  onContinue: () => void
}

export function TickerMappingReview({
  suggestions,
  onApprove,
  onEdit,
  onSkip,
  onContinue,
}: TickerMappingReviewProps) {
  const [approvedCount, setApprovedCount] = useState(
    suggestions.filter(s => s.is_approved).length
  )

  const getConfidenceStars = (score: number) => {
    const stars = Math.round(score * 5)
    return "⭐".repeat(stars) + "☆".repeat(5 - stars)
  }

  const getStatusColor = (score: number, method: string) => {
    if (method === "approved_mapping") return "border-green-500 bg-green-50 dark:bg-green-900/10"
    if (method === "no_match") return "border-red-500 bg-red-50 dark:bg-red-900/10"
    if (score >= 0.9) return "border-green-500 bg-green-50 dark:bg-green-900/10"
    if (score >= 0.7) return "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10"
    return "border-orange-500 bg-orange-50 dark:bg-orange-900/10"
  }

  const getStatusIcon = (score: number, method: string) => {
    if (method === "approved_mapping") return <CheckCircle2 className="h-6 w-6 text-green-600" />
    if (method === "no_match") return <XCircle className="h-6 w-6 text-red-600" />
    if (score >= 0.9) return <CheckCircle2 className="h-6 w-6 text-green-600" />
    if (score >= 0.7) return <AlertTriangle className="h-6 w-6 text-yellow-600" />
    return <AlertTriangle className="h-6 w-6 text-orange-600" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg bg-white dark:bg-slate-800 p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          📋 Controleer Ticker Mapping
        </h2>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          {suggestions.length} aandelen gevonden in CSV. Controleer de gesuggereerde tickers voordat je importeert.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-green-600">{approvedCount}</span> van{" "}
            <span className="font-semibold">{suggestions.length}</span> goedgekeurd
          </div>
          <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 transition-all duration-300"
              style={{ width: `${(approvedCount / suggestions.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Suggestions */}
      <div className="space-y-4">
        {suggestions.map((suggestion, index) => (
          <div
            key={suggestion.isin}
            className={`rounded-lg border-2 p-6 shadow-sm transition-all ${getStatusColor(
              suggestion.confidence_score,
              suggestion.match_method
            )}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {/* Status Icon */}
                <div className="mt-1">
                  {getStatusIcon(suggestion.confidence_score, suggestion.match_method)}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {suggestion.product}
                  </h3>
                  <div className="mt-1 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="font-medium">ISIN:</span> {suggestion.isin}
                    </div>
                    {suggestion.exchange && (
                      <div>
                        <span className="font-medium">Beurs:</span> {suggestion.exchange}
                      </div>
                    )}
                  </div>

                  {/* Suggested Ticker */}
                  {suggestion.suggested_ticker ? (
                    <div className="mt-4 rounded-lg bg-white dark:bg-slate-800 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Gesuggereerde ticker
                          </div>
                          <div className="mt-1 text-xl font-bold text-indigo-600 dark:text-indigo-400">
                            {suggestion.yahoo_symbol}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Confidence
                          </div>
                          <div className="mt-1">
                            <span className="text-sm">{getConfidenceStars(suggestion.confidence_score)}</span>
                            <span className="ml-2 text-sm font-semibold">
                              {Math.round(suggestion.confidence_score * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      {suggestion.confidence_score < 0.9 && (
                        <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                          ⚠️ Controleer of deze ticker correct is
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
                      <div className="text-sm font-semibold text-red-700 dark:text-red-400">
                        ❌ Geen ticker gevonden
                      </div>
                      <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                        Handmatige invoer vereist
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                {suggestion.suggested_ticker && !suggestion.is_approved && (
                  <Button
                    onClick={() => {
                      onApprove(suggestion)
                      setApprovedCount(c => c + 1)
                    }}
                    variant="primary"
                    className="gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Goedkeuren
                  </Button>
                )}
                <Button
                  onClick={() => onEdit(suggestion)}
                  variant="secondary"
                  className="gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Aanpassen
                </Button>
                <Button
                  onClick={() => onSkip(suggestion)}
                  variant="secondary"
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Overslaan
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Continue Button */}
      <div className="flex justify-end gap-4">
        <Button variant="secondary" onClick={() => window.history.back()}>
          ← Terug
        </Button>
        <Button
          onClick={onContinue}
          disabled={approvedCount === 0}
          variant="primary"
          className="gap-2"
        >
          Importeer {approvedCount} van {suggestions.length} →
        </Button>
      </div>
    </div>
  )
}
