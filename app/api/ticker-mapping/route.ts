import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// Exchange to Yahoo suffix mapping
const EXCHANGE_SUFFIXES: Record<string, string> = {
  "AMS": ".AS",      // Euronext Amsterdam
  "XAMS": ".AS",     // Euronext Amsterdam (alternate)
  "EPA": ".PA",      // Euronext Paris
  "EBR": ".BR",      // Euronext Brussels
  "XETRA": ".DE",    // Frankfurt/Xetra
  "FRA": ".F",       // Frankfurt
  "LSE": ".L",       // London Stock Exchange
  "BIT": ".MI",      // Borsa Italiana Milan
  "BME": ".MC",      // Madrid
  "SWX": ".SW",      // Swiss Exchange
  "NASDAQ": "",      // NASDAQ (no suffix)
  "NYSE": "",        // NYSE (no suffix)
  "NAS": "",         // NASDAQ (alternate)
}

// Calculate simple string similarity (Levenshtein distance based)
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1
  
  if (longer.length === 0) return 1.0
  
  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = []
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else if (j > 0) {
        let newValue = costs[j - 1]
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
        }
        costs[j - 1] = lastValue
        lastValue = newValue
      }
    }
    if (i > 0) costs[s2.length] = lastValue
  }
  return costs[s2.length]
}

// POST /api/ticker-mapping - Generate ticker suggestions for ISINs
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()
    const { positions } = body // Array of { isin, product, exchange }

    if (!positions || !Array.isArray(positions)) {
      return NextResponse.json({ error: "Invalid positions array" }, { status: 400 })
    }

    const suggestions = []

    for (const pos of positions) {
      const { isin, product, exchange } = pos

      // 1. Check if we already have an approved mapping
      const { data: existingMapping } = await supabase
        .from("ticker_mappings")
        .select("*")
        .eq("isin", isin)
        .eq("is_approved", true)
        .maybeSingle()

      if (existingMapping) {
        suggestions.push({
          isin,
          product,
          exchange,
          suggested_ticker: existingMapping.suggested_ticker,
          yahoo_symbol: existingMapping.yahoo_symbol,
          confidence_score: 1.0,
          match_method: "approved_mapping",
          is_approved: true,
        })
        continue
      }

      // 2. Try exact ISIN match in securities database
      const { data: security } = await supabase
        .from("securities")
        .select("*")
        .eq("isin", isin)
        .maybeSingle()

      if (security) {
        const suffix = exchange ? EXCHANGE_SUFFIXES[exchange] || "" : ""
        suggestions.push({
          isin,
          product,
          exchange,
          suggested_ticker: security.ticker_symbol,
          yahoo_symbol: security.yahoo_symbol || `${security.ticker_symbol}${suffix}`,
          confidence_score: 1.0,
          match_method: "exact_isin",
          is_approved: false,
        })
        continue
      }

      // 3. Fuzzy match on product name
      const { data: securities } = await supabase
        .from("securities")
        .select("*")
        .ilike("name", `%${product.split(" ")[0]}%`) // Match first word
        .limit(5)

      if (securities && securities.length > 0) {
        // Calculate similarity scores
        const scored = securities.map((sec: any) => ({
          ...sec,
          score: similarity(product.toUpperCase(), sec.name.toUpperCase()),
        }))
        .sort((a: any, b: any) => b.score - a.score)

        const best = scored[0]
        if (best.score > 0.6) { // At least 60% match
          const suffix = exchange ? EXCHANGE_SUFFIXES[exchange] || "" : ""
          suggestions.push({
            isin,
            product,
            exchange,
            suggested_ticker: best.ticker_symbol,
            yahoo_symbol: best.yahoo_symbol || `${best.ticker_symbol}${suffix}`,
            confidence_score: best.score,
            match_method: "fuzzy_name",
            is_approved: false,
          })
          continue
        }
      }

      // 4. No match found - manual input required
      suggestions.push({
        isin,
        product,
        exchange,
        suggested_ticker: null,
        yahoo_symbol: null,
        confidence_score: 0,
        match_method: "no_match",
        is_approved: false,
      })
    }

    return NextResponse.json({ suggestions })
  } catch (error: any) {
    console.error("Ticker mapping error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
