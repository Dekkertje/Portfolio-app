import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@/lib/supabase/server"

// DELETE /api/transactions?isin=XXX&portfolio_id=YYY
// Delete all transactions for a specific ISIN and portfolio
export async function DELETE(request: Request) {
  try {
    const supabase = createRouteHandlerClient(request)
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error("Auth error in transactions DELETE:", authError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const isin = searchParams.get("isin")
    const product = searchParams.get("product")
    const portfolio_id = searchParams.get("portfolio_id")

    if (!portfolio_id || (!isin && !product)) {
      return NextResponse.json(
        { error: "portfolio_id and (isin or product) required" },
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

    // First, check how many transactions exist BEFORE delete
    // IMPORTANT: If ISIN is very short (like "H"), it's probably a ticker symbol, not an ISIN
    // Real ISINs are 12 characters (e.g., US0378331005, NL0010273215)
    const isRealISIN = isin && isin.length >= 10

    let checkQuery = supabase
      .from("transactions")
      .select("id, product, isin, transaction_type, quantity")
      .eq("portfolio_id", portfolio_id)

    // Only filter by ISIN if it's a real ISIN (not a short ticker like "H")
    if (isRealISIN) {
      checkQuery = checkQuery.eq("isin", isin)
      console.log(`   Using ISIN filter: ${isin} (length: ${isin.length})`)
    } else if (isin) {
      console.log(`   ⚠️ ISIN too short ("${isin}", length: ${isin.length}), ignoring ISIN filter`)
      console.log(`   This is likely a ticker symbol, not an ISIN. Will match by product name only.`)
    }

    // Always filter by product name for safety
    if (product && product !== 'null' && product !== 'undefined') {
      checkQuery = checkQuery.eq("product", product)
      console.log(`   Using product filter: ${product}`)
    }

    const { data: existingTransactions, error: checkError } = await checkQuery

    console.log(`📊 Found ${existingTransactions?.length || 0} transactions to delete:`)
    console.log(`   ISIN filter: ${isin}`)
    console.log(`   Product filter: ${product}`)
    console.log(`   Portfolio: ${portfolio_id}`)
    if (existingTransactions && existingTransactions.length > 0) {
      console.log(`   Transactions:`, existingTransactions.map(t => ({
        id: t.id.substring(0, 8),
        product: t.product,
        isin: t.isin,
        type: t.transaction_type,
        qty: t.quantity
      })))
    }

    if (checkError) {
      console.error("Error checking transactions:", checkError)
      return NextResponse.json(
        { error: `Check error: ${checkError.message}` },
        { status: 500 }
      )
    }

    if (!existingTransactions || existingTransactions.length === 0) {
      console.warn(`⚠️ No exact match found. Trying alternative queries...`)

      // Try fetching ALL transactions for this portfolio to help debug
      const { data: allTransactions } = await supabase
        .from("transactions")
        .select("id, product, isin, transaction_type, quantity")
        .eq("portfolio_id", portfolio_id)
        .limit(100)

      console.log(`📋 Total transactions in portfolio: ${allTransactions?.length || 0}`)

      if (allTransactions && allTransactions.length > 0) {
        // Show unique products
        const uniqueProducts = [...new Set(allTransactions.map(t => t.product))]
        const uniqueISINs = [...new Set(allTransactions.map(t => t.isin).filter(Boolean))]

        console.log(`   Unique products in DB:`, uniqueProducts.slice(0, 10))
        console.log(`   Unique ISINs in DB:`, uniqueISINs.slice(0, 10))

        // Try to find similar products
        const similarProducts = allTransactions.filter(t =>
          t.product?.toLowerCase().includes(product?.toLowerCase() || '') ||
          product?.toLowerCase().includes(t.product?.toLowerCase() || '')
        )

        if (similarProducts.length > 0) {
          console.log(`   ℹ️  Found ${similarProducts.length} transactions with similar product names:`)
          console.log(similarProducts.map(t => `      - "${t.product}" (ISIN: ${t.isin || 'NULL'})`).join('\n'))
        }
      }

      return NextResponse.json(
        {
          success: false,
          deleted_count: 0,
          error: "No transactions found matching ISIN/product exactly.",
          hint: "Check console logs for similar product names in your portfolio",
          debug: {
            searched_isin: isin,
            searched_product: product,
            portfolio_id: portfolio_id,
            total_transactions_in_portfolio: allTransactions?.length || 0,
            sample_products: allTransactions?.slice(0, 5).map(t => ({
              product: t.product,
              isin: t.isin
            }))
          }
        },
        { status: 404 }
      )
    }

    // Now delete them - use same filters as check query
    let deleteQuery = supabase
      .from("transactions")
      .delete()
      .eq("portfolio_id", portfolio_id)

    // Only filter by ISIN if it's a real ISIN
    if (isRealISIN) {
      deleteQuery = deleteQuery.eq("isin", isin)
    }

    // Always filter by product name
    if (product && product !== 'null' && product !== 'undefined') {
      deleteQuery = deleteQuery.eq("product", product)
    }

    const { data, error } = await deleteQuery.select()

    if (error) {
      console.error("Delete transactions error:", error)
      return NextResponse.json(
        {
          error: error.message,
          hint: error.hint,
          details: error.details,
          code: error.code
        },
        { status: 500 }
      )
    }

    console.log(`✅ Deleted ${data?.length || 0} transactions for ISIN ${isin}, product ${product}`)
    console.log(`   Expected: ${existingTransactions.length}, Actually deleted: ${data?.length || 0}`)
    if (data && data.length > 0) {
      console.log(`   Deleted transaction IDs:`, data.map(t => t.id.substring(0, 8)))
    }

    // Check if delete was successful
    const actuallyDeleted = data?.length || 0
    const expectedToDelete = existingTransactions.length

    if (actuallyDeleted === 0 && expectedToDelete > 0) {
      console.error(`❌ RLS POLICY BLOCKED DELETE!`)
      console.error(`   Found ${expectedToDelete} transactions but deleted ${actuallyDeleted}`)
      console.error(`   This is likely a Row Level Security policy issue!`)
      return NextResponse.json({
        success: false,
        deleted_count: 0,
        error: "Delete was blocked by database policy. Run COMPLETE_FIX_ALL_ISSUES.sql in Supabase!",
        debug: {
          found: expectedToDelete,
          deleted: actuallyDeleted,
          likely_cause: "Missing DELETE policy for transactions table"
        }
      }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      deleted_count: actuallyDeleted,
      deleted_transactions: data?.map(t => ({
        id: t.id,
        product: t.product,
        isin: t.isin,
        transaction_type: t.transaction_type,
        quantity: t.quantity
      })),
      message: `Deleted ${actuallyDeleted} transactions`,
      debug: {
        expected: expectedToDelete,
        actual: actuallyDeleted,
        status: actuallyDeleted === expectedToDelete ? "✅ All deleted" : "⚠️ Partial delete"
      }
    })
  } catch (error: any) {
    console.error("Transactions DELETE error:", error)
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    )
  }
}
