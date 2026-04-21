import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@/lib/supabase/server"

// Hardcoded dividend data for common stocks
// In production, this would come from an API like Alpha Vantage or Financial Modeling Prep
const DIVIDEND_DATA: Record<string, { annualDividend: number; frequency: string; nextExDate: string }> = {
  "ALPHABET INC": { annualDividend: 0, frequency: "none", nextExDate: "" }, // Google doesn't pay dividends
  "ASML HOLDING": { annualDividend: 6.25, frequency: "annual", nextExDate: "2026-04-23" },
  "SOFI TECHNOLOGIES INC": { annualDividend: 0, frequency: "none", nextExDate: "" },
  "INVESCO EQQQ NASDAQ-100 UCITS ETF DIST": { annualDividend: 1.85, frequency: "quarterly", nextExDate: "2026-04-15" },
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const product = searchParams.get("product")

    if (!product) {
      return NextResponse.json({ error: "Product name required" }, { status: 400 })
    }

    const dividendInfo = DIVIDEND_DATA[product]

    if (!dividendInfo) {
      return NextResponse.json({ 
        annualDividend: 0, 
        frequency: "none", 
        nextExDate: null 
      })
    }

    return NextResponse.json(dividendInfo)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient(request)
    const body = await request.json()
    const { product, isin, ex_date, payment_date, amount_per_share, currency, frequency } = body

    const { data, error } = await supabase.from("dividends").insert({
      product,
      isin: isin || null,
      ex_date,
      payment_date: payment_date || null,
      amount_per_share,
      currency: currency || "EUR",
      frequency: frequency || null,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

