import { NextResponse } from "next/server"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { getQuote } from "@/lib/providers/yahoo"
import { isCrypto, getCryptoYahooSymbol } from "@/lib/utils"
import { getFXRate } from "@/lib/providers/fx"

// GET /api/debug-crypto
// Temporary diagnostic endpoint — shows the full crypto price pipeline
export async function GET() {
  const supabase = createServiceSupabaseClient()

  // 1. Find all transactions for crypto positions
  const { data: transactions } = await supabase
    .from("transactions")
    .select("product, isin")

  const cryptoTransactions = (transactions ?? []).filter(t =>
    isCrypto(t.product, t.isin)
  )

  // Deduplicate
  const seen = new Set<string>()
  const uniqueCrypto = cryptoTransactions.filter(t => {
    const key = `${t.product}__${t.isin}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // 2. Check what's in prices table for these products
  const { data: prices } = await supabase
    .from("prices")
    .select("product, isin, price, price_date")
    .order("price_date", { ascending: false })

  const { rate: usdToEur } = await getFXRate("USD", "EUR", supabase)

  // 3. For each crypto position, trace the full pipeline
  const results = await Promise.all(uniqueCrypto.map(async (t) => {
    // Resolve symbol
    let yahooSymbol: string | null = null
    let symbolMethod = ""

    if (t.isin && /^[A-Z0-9]+-[A-Z]{3}$/i.test(t.isin)) {
      yahooSymbol = t.isin.toUpperCase()
      symbolMethod = "isin_direct"
    } else {
      yahooSymbol = getCryptoYahooSymbol(t.product, t.isin)
      symbolMethod = "name_lookup"
    }

    // Check if price exists in DB
    const dbPriceKey = `${t.product}__${t.isin || ""}`
    const priceInDb = prices?.find(p =>
      `${p.product}__${p.isin || ""}` === dbPriceKey
    )

    // Try fetching quote
    let quoteResult: any = null
    let quoteError: string | null = null
    if (yahooSymbol) {
      const quote = await getQuote(yahooSymbol)
      if (quote) {
        const isUsd = quote.currency === "USD"
        const rate = isUsd ? usdToEur : 1
        quoteResult = {
          rawPrice: quote.price,
          currency: quote.currency,
          priceEur: quote.price * rate,
          priceDate: quote.priceDate,
        }
      } else {
        quoteError = `No quote returned for ${yahooSymbol}`
      }
    }

    return {
      product: t.product,
      isin: t.isin,
      yahooSymbol,
      symbolMethod,
      priceInDb: priceInDb ? {
        price: priceInDb.price,
        date: priceInDb.price_date,
        isin: priceInDb.isin,
      } : null,
      quote: quoteResult,
      quoteError,
    }
  }))

  return NextResponse.json({ usdToEur, results })
}
