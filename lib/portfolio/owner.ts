import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Ingelogde gebruiker + diens portfolio (het oudste; zo werkt de app al sinds het begin).
 * Met `create` wordt er een aangemaakt als er nog geen is. Null = niet ingelogd.
 */
export async function ownPortfolio(db: SupabaseClient, create = false): Promise<{ userId: string; portfolioId: string | null } | null> {
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return null
  const { data: portfolio } = await db
    .from("portfolios")
    .select("id")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (portfolio || !create) return { userId: auth.user.id, portfolioId: portfolio?.id ?? null }
  const { data: created, error } = await db.from("portfolios").insert({ user_id: auth.user.id, name: "Mijn Portfolio" }).select("id").single()
  if (error) throw new Error(`Portfolio aanmaken mislukt: ${error.message}`)
  return { userId: auth.user.id, portfolioId: created.id }
}
