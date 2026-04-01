import { NextResponse } from "next/server"
import { supabaseServer as supabase } from "@/lib/supabase/server"

type StockInfo = {
  symbol: string
  yahooSymbol: string // Yahoo Finance specific symbol
  currency: "USD" | "EUR"
}

function mapProductToSymbol(product: string): StockInfo | null {
  const upperProduct = product.toUpperCase()

  const mapping: Record<string, StockInfo> = {
    // Tech Giants - Yahoo Finance uses simple symbols
    "ALPHABET INC": { symbol: "GOOGL", yahooSymbol: "GOOGL", currency: "USD" },
    "ALPHABET INC CLASS A": { symbol: "GOOGL", yahooSymbol: "GOOGL", currency: "USD" },
    "APPLE INC": { symbol: "AAPL", yahooSymbol: "AAPL", currency: "USD" },
    "MICROSOFT CORP": { symbol: "MSFT", yahooSymbol: "MSFT", currency: "USD" },
    "META PLATFORMS INC": { symbol: "META", yahooSymbol: "META", currency: "USD" },
    "META PLATFORMS INC CLASS A": { symbol: "META", yahooSymbol: "META", currency: "USD" },
    "AMAZON.COM INC": { symbol: "AMZN", yahooSymbol: "AMZN", currency: "USD" },
    "NETFLIX INC": { symbol: "NFLX", yahooSymbol: "NFLX", currency: "USD" },

    // Semiconductors - ASML on Amsterdam exchange
    "ASML HOLDING": { symbol: "ASML.AS", yahooSymbol: "ASML.AS", currency: "EUR" },
    "ASML HOLDING NV": { symbol: "ASML.AS", yahooSymbol: "ASML.AS", currency: "EUR" },
    "NVIDIA CORP": { symbol: "NVDA", yahooSymbol: "NVDA", currency: "USD" },
    "INTEL CORP": { symbol: "INTC", yahooSymbol: "INTC", currency: "USD" },
    "AMD": { symbol: "AMD", yahooSymbol: "AMD", currency: "USD" },
    "ADVANCED MICRO DEVICES": { symbol: "AMD", yahooSymbol: "AMD", currency: "USD" },
    "MARVELL TECHNOLOGY INC": { symbol: "MRVL", yahooSymbol: "MRVL", currency: "USD" },

    // Software & Cloud
    "MONGODB INC": { symbol: "MDB", yahooSymbol: "MDB", currency: "USD" },
    "MONGODB INC CLASS A": { symbol: "MDB", yahooSymbol: "MDB", currency: "USD" },
    "SALESFORCE INC": { symbol: "CRM", yahooSymbol: "CRM", currency: "USD" },
    "ORACLE CORP": { symbol: "ORCL", yahooSymbol: "ORCL", currency: "USD" },

    // Cybersecurity
    "CROWDSTRIKE HOLDINGS INC": { symbol: "CRWD", yahooSymbol: "CRWD", currency: "USD" },
    "CROWDSTRIKE HOLDINGS INC CLASS A": { symbol: "CRWD", yahooSymbol: "CRWD", currency: "USD" },

    // Data Analytics
    "PALANTIR TECHNOLOGIES INC": { symbol: "PLTR", yahooSymbol: "PLTR", currency: "USD" },
    "PALANTIR TECHNOLOGIES INC CLASS A": { symbol: "PLTR", yahooSymbol: "PLTR", currency: "USD" },

    // FinTech
    "SOFI TECHNOLOGIES INC": { symbol: "SOFI", yahooSymbol: "SOFI", currency: "USD" },

    // European Stocks - Amsterdam Exchange
    "ABN AMRO BANK NV": { symbol: "ABN.AS", yahooSymbol: "ABN.AS", currency: "EUR" },
    "ING GROEP NV": { symbol: "INGA.AS", yahooSymbol: "INGA.AS", currency: "EUR" },
    "ASR NEDERLAND NV": { symbol: "ASRNL.AS", yahooSymbol: "ASRNL.AS", currency: "EUR" },
    "FASTNED BV": { symbol: "FAST.AS", yahooSymbol: "FAST.AS", currency: "EUR" },

    // ETFs - Mixed exchanges (will auto-convert pence to EUR if needed)
    "INVESCO EQQQ NASDAQ-100 UCITS ETF": { symbol: "EQQQ.L", yahooSymbol: "EQQQ.L", currency: "EUR" },
    "INVESCO EQQQ NASDAQ-100 UCITS ETF DIST": { symbol: "EQQQ.L", yahooSymbol: "EQQQ.L", currency: "EUR" },
    "VANGUARD S&P 500 UCITS ETF": { symbol: "VUSA.AS", yahooSymbol: "VUSA.AS", currency: "EUR" },
    "VANGUARD S&P 500 UCITS ETF USD DIS": { symbol: "VUSA.AS", yahooSymbol: "VUSA.AS", currency: "EUR" },
    "ISHARES CORE S&P 500 UCITS ETF": { symbol: "CSPX.L", yahooSymbol: "CSPX.L", currency: "EUR" },
  }

  // Try exact match first
  for (const [key, value] of Object.entries(mapping)) {
    if (upperProduct.includes(key.toUpperCase())) {
      return value
    }
  }

  return null
}

export async function POST() {
  try {
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("product, isin")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const uniqueProducts = Array.from(
      new Map(
        (transactions || []).map((t) => [`${t.product}__${t.isin || ""}`, t])
      ).values()
    )

    // Fetch USD/EUR exchange rate from Yahoo Finance
    // We need USD to EUR conversion rate
    let usdToEurRate = 0.86 // Fallback rate (1 USD = 0.86 EUR approximately)
    try {
      // EURUSD=X gives EUR/USD rate (how many USD per EUR)
      // To get USD/EUR rate, we need to take 1 / EURUSD
      const fxUrl = `https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=1d`
      const fxRes = await fetch(fxUrl)
      const fxJson = await fxRes.json()
      const eurUsdRate = fxJson?.chart?.result?.[0]?.meta?.regularMarketPrice
      if (eurUsdRate && eurUsdRate > 0) {
        // Convert EUR/USD to USD/EUR by taking the inverse
        usdToEurRate = 1 / eurUsdRate
        console.log(`💱 EUR/USD rate: ${eurUsdRate.toFixed(4)} → USD/EUR rate: ${usdToEurRate.toFixed(4)}`)
      }
    } catch (fxError) {
      console.error("Failed to fetch exchange rate, using fallback:", fxError)
    }

    let inserted = 0
    let skipped = 0
    const errors: string[] = []

    for (const item of uniqueProducts) {
      const stockInfo = mapProductToSymbol(item.product)
      if (!stockInfo) {
        const msg = `⚠️  No symbol mapping for: ${item.product}`
        console.log(msg)
        errors.push(msg)
        skipped++
        continue
      }

      console.log(`📊 Fetching price for ${item.product} (${stockInfo.yahooSymbol})...`)

      try {
        // Yahoo Finance API v8 - no API key needed!
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          stockInfo.yahooSymbol
        )}?interval=1d&range=5d`

        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        })

        if (!res.ok) {
          console.error(`❌ HTTP Error ${res.status} for ${item.product}`)
          skipped++
          continue
        }

        const json = await res.json()

        const result = json?.chart?.result?.[0]
        const meta = result?.meta
        const quote = result?.indicators?.quote?.[0]

        if (!meta || !quote) {
          console.log(`⚠️  No data returned for ${item.product}`)
          skipped++
          continue
        }

        const price = meta.regularMarketPrice
        const regularMarketChange = meta.regularMarketChange // Daily change in native currency
        const yahooPreviousClose = meta.previousClose || meta.chartPreviousClose
        const priceDate = new Date(meta.regularMarketTime * 1000).toISOString().split('T')[0]

        if (!price || price <= 0) {
          console.log(`⚠️  Invalid price for ${item.product}: ${price}`)
          skipped++
          continue
        }

        // Convert USD to EUR if needed
        // IMPORTANT: Calculate previous_close from current price and daily change
        // This matches DEGIRO's behavior: previous_close = current - change
        let finalPrice = price
        let finalPreviousClose
        let finalCurrency = stockInfo.currency

        if (stockInfo.currency === "USD") {
          // usdToEurRate is how many EUR you get for 1 USD (e.g., 0.86 means $1 = €0.86)
          // To convert USD to EUR: multiply by the rate
          finalPrice = price * usdToEurRate

          // Calculate previous close from current price and change (both in USD)
          // previous_close_usd = current_price_usd - change_usd
          const previousCloseUSD = price - (regularMarketChange || 0)

          // Convert USD previous close to EUR using TODAY's rate
          finalPreviousClose = previousCloseUSD * usdToEurRate
          finalCurrency = "EUR"

          console.log(`   💱 USD→EUR: $${price.toFixed(2)} → €${finalPrice.toFixed(2)}, prev: $${previousCloseUSD.toFixed(2)} → €${finalPreviousClose.toFixed(2)}, change: $${(regularMarketChange || 0).toFixed(2)}`)
        } else {
          // For EUR stocks, calculate previous close from change
          finalPreviousClose = price - (regularMarketChange || 0)
          console.log(`   📊 EUR: €${price.toFixed(2)}, prev: €${finalPreviousClose.toFixed(2)}, change: €${(regularMarketChange || 0).toFixed(2)}`)
        }

        // Check for unrealistic ETF prices that might be in pence (GBp) instead of pounds/euros
        // ETFs typically trade between €10-€500, if price > €1000 it's likely in pence
        const isLikelyETF = item.product.toUpperCase().includes("ETF") || item.product.toUpperCase().includes("UCITS")
        if (isLikelyETF && finalPrice > 1000) {
          console.log(`🔧 Converting ${item.product} from pence to currency: €${finalPrice.toFixed(2)} → €${(finalPrice / 100).toFixed(2)}`)
          finalPrice = finalPrice / 100
          finalPreviousClose = finalPreviousClose / 100
        }

        // Get the most recent historical price from our database to use as previous_close
        // This is more reliable than calculated previous_close for continuity
        const { data: historicalPrices } = await supabase
          .from("prices")
          .select("price, price_date")
          .eq("product", item.product)
          .lt("price_date", priceDate) // Get prices before today
          .order("price_date", { ascending: false })
          .limit(1)

        // ALWAYS prefer our own historical data over calculated previous close
        // This ensures continuity across days and avoids Yahoo's FX rate timing issues
        // Only use calculated previous_close when we have no historical data (first time fetch)
        const actualPreviousClose = historicalPrices && historicalPrices.length > 0
          ? Number(historicalPrices[0].price)
          : finalPreviousClose

        // Calculate change percent based on actual previous close
        const changePercent = actualPreviousClose > 0
          ? ((finalPrice - actualPreviousClose) / actualPreviousClose) * 100
          : 0

        // Always log the previous close source and comparison
        if (historicalPrices && historicalPrices.length > 0) {
          const diff = Math.abs(actualPreviousClose - finalPreviousClose)
          const diffPercent = actualPreviousClose > 0 ? (diff / actualPreviousClose) * 100 : 0
          console.log(`   📅 Using DB prev_close from ${historicalPrices[0].price_date}: €${actualPreviousClose.toFixed(2)} (calculated from Yahoo change: €${finalPreviousClose.toFixed(2)}, diff: €${diff.toFixed(2)} / ${diffPercent.toFixed(2)}%)`)
        } else {
          console.log(`   🆕 First time fetch - using calculated prev_close: €${finalPreviousClose.toFixed(2)}`)
        }

        console.log(`✅ ${item.product}: €${finalPrice.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`)

        // Delete existing price for today (if any) to avoid duplicates
        await supabase
          .from("prices")
          .delete()
          .eq("product", item.product)
          .eq("price_date", priceDate)

        // Insert new price with previous close for daily P&L calculation
        const { error: insertError } = await supabase.from("prices").insert({
          product: item.product,
          isin: item.isin || null,
          price: finalPrice,
          price_date: priceDate,
          previous_close: actualPreviousClose,
        })

        if (insertError) {
          console.error(`❌ Failed to insert price for ${item.product}:`, insertError.message)
          errors.push(`Failed to save ${item.product}: ${insertError.message}`)
          skipped++
        } else {
          inserted++
        }
      } catch (err) {
        console.error(`❌ Error fetching ${item.product}:`, err)
        skipped++
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      errors,
      message: `${inserted} prijzen opgehaald, ${skipped} overgeslagen`
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}