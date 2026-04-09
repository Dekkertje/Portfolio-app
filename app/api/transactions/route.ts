import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// DELETE /api/transactions?isin=XXX&portfolio_id=YYY
// Delete all transactions for a specific ISIN and portfolio
export async function DELETE(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error("Auth error in transactions DELETE:", authError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const isin = searchParams.get("isin")
    const portfolio_id = searchParams.get("portfolio_id")

    if (!isin || !portfolio_id) {
      return NextResponse.json(
        { error: "ISIN and portfolio_id required" },
        { status: 400 }
      )
    }

    // Verify user owns this portfolio
    const { data: portfolio, error: portfolioError } = await supabase
      .from("portfolios")
      .select("*")
      .eq("id", portfolio_id)
      .eq("user_id", user.id)
      .single()

    if (portfolioError || !portfolio) {
      console.error("Portfolio verification failed:", portfolioError)
      return NextResponse.json(
        { error: "Portfolio not found or unauthorized" },
        { status: 403 }
      )
    }

    // Delete all transactions with this ISIN
    const { data, error } = await supabase
      .from("transactions")
      .delete()
      .eq("portfolio_id", portfolio_id)
      .eq("isin", isin)
      .select()

    if (error) {
      console.error("Delete transactions error:", error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    console.log(`✅ Deleted ${data?.length || 0} transactions for ISIN ${isin}`)
    
    return NextResponse.json({
      success: true,
      deleted_count: data?.length || 0,
      message: `Deleted ${data?.length || 0} transactions`
    })
  } catch (error: any) {
    console.error("Transactions DELETE error:", error)
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    )
  }
}
