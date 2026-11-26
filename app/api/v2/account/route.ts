import { NextResponse } from "next/server"
import { createRouteHandlerClient, createServiceSupabaseClient } from "@/lib/supabase/server"

/**
 * DELETE /api/v2/account — body { confirm: "VERWIJDER" }
 * Verwijdert het account en alle persoonlijke gegevens. Gedeelde referentiedata
 * (effecten, koersen) blijft staan; daar zit niets persoonlijks in.
 */
export async function DELETE(request: Request) {
  const db = createRouteHandlerClient(request)
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { confirm?: string } | null
  if (body?.confirm !== "VERWIJDER") return NextResponse.json({ error: "Bevestiging ontbreekt" }, { status: 400 })

  const userId = auth.user.id
  const service = createServiceSupabaseClient()
  const fail = (step: string, message: string) => NextResponse.json({ error: `Verwijderen mislukt bij ${step}: ${message}` }, { status: 500 })

  const { data: portfolios } = await service.from("portfolios").select("id").eq("user_id", userId)
  const ids = (portfolios ?? []).map((p) => p.id as string)
  if (ids.length) {
    // Snapshots hebben geen foreign key naar portfolios en verdwijnen dus niet vanzelf
    await service.from("portfolio_snapshots").delete().in("portfolio_id", ids)
    // Transacties, grootboek, imports en handmatige posities gaan mee via ON DELETE CASCADE
    const { error } = await service.from("portfolios").delete().eq("user_id", userId)
    if (error) return fail("portfolio", error.message)
  }

  // Deze verwijzing heeft geen cascade en zou het verwijderen van de gebruiker blokkeren
  await service.from("ticker_mappings").update({ approved_by: null }).eq("approved_by", userId)

  const { data: files } = await service.storage.from("avatars").list(userId)
  if (files?.length) await service.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`))

  // Profiel, notificaties, push, volglijst en meldingen gaan mee via ON DELETE CASCADE op auth.users
  const { error } = await service.auth.admin.deleteUser(userId)
  if (error) return fail("account", error.message)

  return NextResponse.json({ ok: true })
}
