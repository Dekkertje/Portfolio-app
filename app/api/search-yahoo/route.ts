import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")

    if (!query) {
      return NextResponse.json({ error: "Query required" }, { status: 400 })
    }

    // Use Yahoo Finance search API
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Search failed" }, { status: 500 })
    }

    const data = await res.json()
    
    const results = data.quotes?.map((quote: any) => ({
      symbol: quote.symbol,
      name: quote.longname || quote.shortname || quote.symbol,
      exchange: quote.exchange || quote.exchDisp || "Unknown",
      type: quote.quoteType || "Unknown",
    })) || []

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error("Yahoo search error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
