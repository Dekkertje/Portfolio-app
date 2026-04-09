"use client"

import { useState } from "react"
import Papa from "papaparse"
import { supabase } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/Toast"
import { Button } from "@/components/ui/Button"
import { Card, CardHeader } from "@/components/ui/Card"
import { parseEuropeanNumber, parseDegiroDate, detectTransactionType } from "@/lib/utils"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Upload } from "lucide-react"
import { TickerMappingReview } from "@/components/import/TickerMappingReview"
import { TickerEditModal } from "@/components/import/TickerEditModal"

type TickerSuggestion = {
  isin: string
  product: string
  exchange: string | null
  suggested_ticker: string | null
  yahoo_symbol: string | null
  confidence_score: number
  match_method: string
  is_approved: boolean
  total_quantity?: number
  avg_purchase_price?: number
  currency?: string
}

export default function ImportPage() {
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [importComplete, setImportComplete] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [uniqueProducts, setUniqueProducts] = useState<{
    isin: string
    product: string
    exchange: string | null
    total_quantity?: number
    avg_purchase_price?: number
    currency?: string
  }[]>([])
  const [showTickerReview, setShowTickerReview] = useState(false)
  const [tickerSuggestions, setTickerSuggestions] = useState<TickerSuggestion[]>([])
  const [editingTicker, setEditingTicker] = useState<TickerSuggestion | null>(null)
  const { showToast } = useToast()

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null
    setSelectedFile(file)
    setPreview([])
    setImportComplete(false)
    setShowTickerReview(false)

    if (file) {
      showToast(`Bestand geselecteerd: ${file.name}`, "info")
    }
  }

  async function handleStartTickerReview() {
    try {
      setLoading(true)
      const res = await fetch("/api/ticker-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions: uniqueProducts })
      })

      const data = await res.json()

      // Merge API suggestions with local transaction data
      const enrichedSuggestions = (data.suggestions || []).map((s: any) => {
        const localData = uniqueProducts.find(p => p.isin === s.isin)
        return {
          ...s,
          total_quantity: localData?.total_quantity,
          avg_purchase_price: localData?.avg_purchase_price,
          currency: localData?.currency
        }
      })

      setTickerSuggestions(enrichedSuggestions)
      setShowTickerReview(true)
    } catch (error) {
      showToast("Fout bij ophalen ticker suggesties", "error")
    } finally {
      setLoading(false)
    }
  }

  function handleSkipTickerReview() {
    window.location.href = "/dashboard"
  }

  async function handleApproveTicker(suggestion: TickerSuggestion) {
    try {
      const { supabase } = await import("@/lib/supabase/client")
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase
        .from("ticker_mappings")
        .upsert({
          isin: suggestion.isin,
          product_name: suggestion.product,
          exchange: suggestion.exchange,
          yahoo_symbol: suggestion.yahoo_symbol,
          suggested_ticker: suggestion.suggested_ticker,
          confidence_score: suggestion.confidence_score,
          match_method: suggestion.match_method,
          is_approved: true,
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        }, {
          onConflict: "isin,product_name"
        })

      if (error) {
        console.error("Approve error:", error)
        throw error
      }

      setTickerSuggestions(prev =>
        prev.map(s =>
          s.isin === suggestion.isin ? { ...s, is_approved: true } : s
        )
      )
      showToast(`${suggestion.product} goedgekeurd!`, "success")
    } catch (error: any) {
      console.error("Approve ticker error:", error)
      showToast(`Fout bij opslaan ticker: ${error.message || 'Unknown error'}`, "error")
    }
  }

  function handleEditTicker(suggestion: TickerSuggestion) {
    setEditingTicker(suggestion)
  }

  function handleSkipTicker(suggestion: TickerSuggestion) {
    showToast(`${suggestion.product} overgeslagen`, "info")
  }

  async function handleSaveEditedTicker(yahooSymbol: string) {
    if (!editingTicker) return

    try {
      const { supabase } = await import("@/lib/supabase/client")
      const { data: { user } } = await supabase.auth.getUser()

      const { error } = await supabase
        .from("ticker_mappings")
        .upsert({
          isin: editingTicker.isin,
          product_name: editingTicker.product,
          exchange: editingTicker.exchange,
          yahoo_symbol: yahooSymbol,
          suggested_ticker: yahooSymbol.split(".")[0],
          confidence_score: 1.0,
          match_method: "manual",
          is_approved: true,
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        }, {
          onConflict: "isin,product_name"
        })

      if (error) {
        console.error("Save edited ticker error:", error)
        throw error
      }

      setTickerSuggestions(prev =>
        prev.map(s =>
          s.isin === editingTicker.isin
            ? { ...s, yahoo_symbol: yahooSymbol, suggested_ticker: yahooSymbol.split(".")[0], is_approved: true }
            : s
        )
      )

      showToast("Ticker opgeslagen!", "success")
      setEditingTicker(null)
    } catch (error: any) {
      console.error("Save edited ticker error:", error)
      showToast(`Fout bij opslaan ticker: ${error.message || 'Unknown error'}`, "error")
    }
  }

  function handleContinueAfterReview() {
    window.location.href = "/dashboard"
  }

  async function handleImport() {
    if (!selectedFile) {
      showToast("Kies eerst een bestand.", "error")
      return
    }

    setLoading(true)
    showToast("DEGIRO-bestand verwerken...", "info")
    setPreview([])

    try {
      const text = await selectedFile.text()

      const result = Papa.parse<string[]>(text, {
        delimiter: "",
        skipEmptyLines: true,
      })

      const rows = result.data

      if (!rows || rows.length < 2) {
        showToast("Bestand lijkt leeg.", "error")
        setLoading(false)
        return
      }

      const parsedRows = rows.slice(1).map((values) => {
        // DEGIRO CSV actual format based on data row:
        // 25-03-2026,20:02,MONGODB INC CLASS A,US60937P1066,NDQ,BATS,5,"245,5000",USD,"-1227,50",USD,"-1061,67","1,1562","-2,65","-2,00","-1066,33",,c5841a65-...
        // Index: 0        1     2                 3            4   5    6  7         8   9         10  11        12       13       14      15         16 17
        const row = {
          datum: values[0] || "",
          tijd: values[1] || "",
          product: values[2] || "",
          isin: values[3] || "",
          beurs: values[4] || "",
          uitvoeringsplaats: values[5] || "",
          aantal: values[6] || "",
          koers: values[7] || "",
          koersValuta: values[8] || "",
          lokaleWaarde: values[9] || "",
          lokaleWaardeValuta: values[10] || "",
          waardeEur: values[11] || "",
          wisselkoers: values[12] || "",
          autoFxKosten: values[13] || "",
          transactiekosten: values[14] || "",
          totaalEur: values[15] || "",
          orderId: values[17] || "", // Skip empty column at index 16
          kolommen: values.length,
        }

        return row
      })

      setPreview(parsedRows.slice(0, 5))

      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) {
        showToast("Niet ingelogd.", "error")
        setLoading(false)
        return
      }

      const { data: portfolio, error: portfolioError } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", userData.user.id)
        .single()

      if (portfolioError || !portfolio) {
        showToast("Geen portfolio gevonden.", "error")
        setLoading(false)
        return
      }

      // Debug: Log first parsed row to check column alignment
      if (parsedRows.length > 0) {
        // eslint-disable-next-line no-console
        console.log("First parsed row:", parsedRows[0])
        // eslint-disable-next-line no-console
        console.log("Column count:", parsedRows[0]?.kolommen)
      }

      const transactionsToInsert = parsedRows
        .map((row) => {
          const localValue = parseEuropeanNumber(row.lokaleWaarde)

          const tx = {
            portfolio_id: portfolio.id,
            trade_date: parseDegiroDate(row.datum),
            trade_time: row.tijd || null,
            product: row.product || "",
            isin: row.isin || null,
            exchange: row.beurs || null,
            venue: row.uitvoeringsplaats || null,
            quantity: parseEuropeanNumber(row.aantal),
            price: parseEuropeanNumber(row.koers),
            local_value: localValue,
            value_eur: parseEuropeanNumber(row.waardeEur),
            fx_rate: parseEuropeanNumber(row.wisselkoers),
            autofx_cost: parseEuropeanNumber(row.autoFxKosten),
            transaction_fee: parseEuropeanNumber(row.transactiekosten),
            total_eur: parseEuropeanNumber(row.totaalEur),
            order_id: row.orderId || null,
            transaction_type: detectTransactionType(localValue),
          }

          return tx
        })
        .filter((row) => row.product && row.trade_date && row.quantity !== 0)

      // Debug: Log first transaction to insert
      if (transactionsToInsert.length > 0) {
        // eslint-disable-next-line no-console
        console.log("First transaction to insert:", transactionsToInsert[0])
        // eslint-disable-next-line no-console
        console.log("Total transactions to insert:", transactionsToInsert.length)
      }

      if (transactionsToInsert.length === 0) {
        showToast("Geen bruikbare transacties gevonden.", "error")
        setLoading(false)
        return
      }

      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("portfolio_id", portfolio.id)

      if (deleteError) {
        showToast("Fout bij verwijderen oude transacties: " + deleteError.message, "error")
        setLoading(false)
        return
      }

      const { error: insertError } = await supabase
        .from("transactions")
        .insert(transactionsToInsert)

      if (insertError) {
        // eslint-disable-next-line no-console
        console.log("Insert error:", insertError)
        showToast("Fout bij opslaan: " + insertError.message, "error")
      } else {
        // Extract unique products for ticker review with aggregated data
        const uniqueProductsMap = new Map<string, {
          isin: string
          product: string
          exchange: string | null
          total_quantity: number
          total_value: number
          transaction_count: number
          currency: string
        }>()

        transactionsToInsert.forEach(t => {
          const key = `${t.isin}_${t.product}`
          const existing = uniqueProductsMap.get(key)

          if (existing) {
            // Aggregate data
            existing.total_quantity += parseFloat(t.quantity) || 0
            existing.total_value += parseFloat(t.value_eur) || 0
            existing.transaction_count += 1
          } else {
            uniqueProductsMap.set(key, {
              isin: t.isin || "",
              product: t.product,
              exchange: null, // We'll need to extract this from CSV in future
              total_quantity: parseFloat(t.quantity) || 0,
              total_value: parseFloat(t.value_eur) || 0,
              transaction_count: 1,
              currency: t.local_currency || "EUR"
            })
          }
        })

        const products = Array.from(uniqueProductsMap.values()).map(p => ({
          isin: p.isin,
          product: p.product,
          exchange: p.exchange,
          total_quantity: p.total_quantity,
          avg_purchase_price: p.total_quantity !== 0 ? p.total_value / p.total_quantity : 0,
          currency: p.currency
        }))

        setImportedCount(transactionsToInsert.length)
        setUniqueProducts(products)
        setImportComplete(true)
        showToast(`${transactionsToInsert.length} transacties succesvol geïmporteerd!`, "success")
      }
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.log("Catch error:", error)
      showToast("Er ging iets mis bij het verwerken van het bestand: " + (error?.message || "Onbekende fout"), "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-100 p-2">
            <Upload className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">DEGIRO Import</h1>
            <p className="mt-1 text-sm text-slate-500">
              Importeer je DEGIRO transactiebestand
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8">
        <div className="mx-auto max-w-5xl space-y-6">

        <Card className="mb-6">
          <CardHeader
            title="CSV Bestand Uploaden"
            subtitle="Selecteer een DEGIRO transactiebestand om te importeren"
          />

          <div className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center transition hover:border-indigo-400">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileSelect}
                className="w-full cursor-pointer text-sm text-slate-600 file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>

            <Button
              onClick={handleImport}
              disabled={!selectedFile || loading}
              variant="primary"
              className="w-full"
            >
              {loading ? "Bezig met importeren..." : "Importeren"}
            </Button>
          </div>
        </Card>

        {/* Success Screen with Ticker Review Option */}
        {importComplete && !showTickerReview && (
          <Card className="border-green-200 bg-green-50">
            <div className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mb-2 text-2xl font-bold text-green-900">Import Succesvol!</h2>
              <p className="mb-6 text-green-700">
                {importedCount} transacties geïmporteerd van {uniqueProducts.length} unieke aandelen.
              </p>

              <div className="mb-6 rounded-lg bg-white p-4">
                <p className="mb-4 text-sm text-slate-700">
                  💡 <strong>Tip:</strong> Wil je controleren of de juiste Yahoo Finance tickers zijn gekoppeld?
                  Dit helpt bij het ophalen van correcte koersen.
                </p>
                <div className="flex justify-center gap-4">
                  <Button
                    onClick={handleStartTickerReview}
                    disabled={loading}
                    variant="primary"
                  >
                    {loading ? "Laden..." : "Ja, Controleer Tickers"}
                  </Button>
                  <Button onClick={handleSkipTickerReview} variant="secondary">
                    Nee, Ga naar Dashboard
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Ticker Review Screen */}
        {showTickerReview && (
          <TickerMappingReview
            suggestions={tickerSuggestions}
            onApprove={handleApproveTicker}
            onEdit={handleEditTicker}
            onSkip={handleSkipTicker}
            onContinue={handleContinueAfterReview}
          />
        )}

        {/* Ticker Edit Modal */}
        {editingTicker && (
          <TickerEditModal
            isOpen={!!editingTicker}
            onClose={() => setEditingTicker(null)}
            isin={editingTicker.isin}
            product={editingTicker.product}
            currentTicker={editingTicker.yahoo_symbol}
            onSave={handleSaveEditedTicker}
          />
        )}

        {preview.length > 0 && !importComplete && (
          <Card>
            <CardHeader
              title="Preview Eerste Regels"
              subtitle="Controleer de geïmporteerde data voordat je deze opslaat"
            />

            <div className="space-y-3">
              {preview.map((row, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm"
                >
                  <div className="mb-2 text-xs text-slate-500">
                    Kolommen: {row.kolommen}
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                    <div>
                      <span className="font-semibold text-slate-700">Product:</span>{" "}
                      <span className="text-slate-900">{row.product}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Datum:</span>{" "}
                      <span className="text-slate-900">{row.datum}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Aantal:</span>{" "}
                      <span className="text-slate-900">{row.aantal}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Koers:</span>{" "}
                      <span className="text-slate-900">{row.koers} {row.koersValuta}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Lokale Waarde:</span>{" "}
                      <span className="text-slate-900">{row.lokaleWaarde}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Waarde EUR:</span>{" "}
                      <span className="text-slate-900">{row.waardeEur}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Transactiekosten:</span>{" "}
                      <span className="text-slate-900">{row.transactiekosten}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Totaal EUR:</span>{" "}
                      <span className="text-slate-900 font-bold">{row.totaalEur}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Kolommen:</span>{" "}
                      <span className="text-slate-900">{row.kolommen}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        </div>
      </div>
    </DashboardLayout>
  )
}