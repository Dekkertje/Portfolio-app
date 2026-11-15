"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Camera, Check, ChevronRight, Download, Loader2, LogOut, Upload } from "lucide-react"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { useTheme } from "@/contexts/ThemeContext"
import { authFetch, supabase } from "@/lib/supabase/client"
import type { TransactionsResponse } from "@/app/api/v2/transactions/route"
import { Card, Initials, SectionTitle, Segmented } from "./ui"

type Profile = { id: string; email: string; fullName: string; avatarUrl: string | null; provider: string }

export function SettingsView() {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const user = session.user
      const { data } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle()
      setProfile({
        id: user.id,
        email: user.email ?? "",
        fullName: data?.full_name ?? user.user_metadata?.full_name ?? "",
        avatarUrl: data?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
        provider: user.app_metadata?.provider ?? "email",
      })
    })()
  }, [])

  return (
    <div className="flex flex-col gap-5 pt-6 lg:pt-10">
      <header className="px-1">
        <h1 className="text-[28px] font-semibold tracking-tight lg:text-[32px]">Instellingen</h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
        <div className="flex flex-col gap-5">
          <ProfileCard profile={profile} onChange={setProfile} />
          {profile?.provider === "email" && <PasswordCard />}
        </div>
        <div className="flex flex-col gap-5">
          <DisplayCard />
          <DataCard />
          <AccountCard />
        </div>
      </div>
    </div>
  )
}

function ProfileCard({ profile, onChange }: { profile: Profile | null; onChange: (p: Profile) => void }) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)

  // Naamveld vullen zodra het profiel binnen is
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (profile && loadedFor !== profile.id) {
    setLoadedFor(profile.id)
    setName(profile.fullName)
  }

  async function save() {
    if (!profile) return
    setSaving("saving")
    setError(null)
    const { error } = await supabase.from("profiles").upsert({ id: profile.id, full_name: name.trim() }, { onConflict: "id" })
    if (error) {
      setError(error.message)
      setSaving("idle")
      return
    }
    onChange({ ...profile, fullName: name.trim() })
    setSaving("saved")
    setTimeout(() => setSaving("idle"), 2000)
  }

  async function upload(f: File) {
    if (!profile) return
    setUploading(true)
    setError(null)
    try {
      const ext = f.name.split(".").pop() ?? "jpg"
      const path = `${profile.id}/${profile.id}.${ext}`
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, f, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from("avatars").getPublicUrl(path)
      // Cache-buster zodat de nieuwe foto direct zichtbaar is
      const url = `${data.publicUrl}?v=${Date.now()}`
      const { error: dbErr } = await supabase.from("profiles").upsert({ id: profile.id, avatar_url: url }, { onConflict: "id" })
      if (dbErr) throw dbErr
      onChange({ ...profile, avatarUrl: url })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uploaden mislukt")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle>Profiel</SectionTitle>
      <div className="flex items-center gap-4">
        <button
          onClick={() => file.current?.click()}
          className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-surface-2"
          aria-label="Profielfoto wijzigen"
          disabled={!profile || uploading}
        >
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center [&>span]:h-16 [&>span]:w-16">
              <Initials name={profile?.fullName || profile?.email || "?"} />
            </span>
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
          </span>
        </button>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-ink">{profile?.fullName || "—"}</p>
          <p className="truncate text-[13px] text-muted">{profile?.email}</p>
          <button onClick={() => file.current?.click()} className="mt-1 text-[13px] font-medium text-accent">
            Foto wijzigen
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
            e.target.value = ""
          }}
        />
      </div>

      <label className="mt-5 flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-2">Naam</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Je naam"
          className="h-12 rounded-2xl bg-surface-2 px-4 text-[15px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
        />
      </label>
      {error && <p className="mt-3 rounded-2xl bg-down-wash px-3 py-2 text-[13px] text-down">{error}</p>}
      <button
        onClick={save}
        disabled={!profile || saving === "saving" || name.trim() === profile?.fullName}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-[14px] font-medium text-surface disabled:opacity-40"
      >
        {saving === "saving" && <Loader2 size={16} className="animate-spin" />}
        {saving === "saved" && <Check size={16} />}
        {saving === "saved" ? "Opgeslagen" : "Opslaan"}
      </button>
    </Card>
  )
}

function PasswordCard() {
  const [pw, setPw] = useState("")
  const [pw2, setPw2] = useState("")
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle")
  const [error, setError] = useState<string | null>(null)
  const tooShort = pw.length > 0 && pw.length < 8
  const mismatch = pw2.length > 0 && pw !== pw2

  async function save() {
    setState("saving")
    setError(null)
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) {
      setError(error.message)
      setState("idle")
      return
    }
    setPw("")
    setPw2("")
    setState("saved")
    setTimeout(() => setState("idle"), 2500)
  }

  const input = "h-12 rounded-2xl bg-surface-2 px-4 text-[15px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle>Wachtwoord</SectionTitle>
      <div className="flex flex-col gap-3">
        <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nieuw wachtwoord (min. 8 tekens)" className={input} />
        <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Herhaal nieuw wachtwoord" className={input} />
        {(tooShort || mismatch) && <p className="px-1 text-[12px] text-down">{tooShort ? "Minimaal 8 tekens" : "Wachtwoorden zijn niet gelijk"}</p>}
        {error && <p className="rounded-2xl bg-down-wash px-3 py-2 text-[13px] text-down">{error}</p>}
        <button
          onClick={save}
          disabled={pw.length < 8 || pw !== pw2 || state === "saving"}
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-surface-2 text-[14px] font-medium text-ink disabled:opacity-40"
        >
          {state === "saving" && <Loader2 size={16} className="animate-spin" />}
          {state === "saved" ? "Wachtwoord gewijzigd" : "Wachtwoord wijzigen"}
        </button>
      </div>
    </Card>
  )
}

function DisplayCard() {
  const { theme, toggleTheme } = useTheme()
  const { privacyMode, togglePrivacyMode } = usePrivacy()
  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle>Weergave</SectionTitle>
      <div className="flex items-center justify-between gap-3 py-2">
        <span className="text-[14px] text-ink">Thema</span>
        <div className="w-48">
          <Segmented
            label="Thema"
            fill
            value={theme}
            onChange={(t) => t !== theme && toggleTheme()}
            options={[
              { value: "light", label: "Licht" },
              { value: "dark", label: "Donker" },
            ]}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line py-3">
        <span>
          <span className="block text-[14px] text-ink">Bedragen verbergen</span>
          <span className="block text-[12px] text-muted">Handig als iemand meekijkt</span>
        </span>
        <button
          role="switch"
          aria-checked={privacyMode}
          aria-label="Bedragen verbergen"
          onClick={togglePrivacyMode}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${privacyMode ? "bg-accent" : "bg-grid"}`}
        >
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${privacyMode ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
    </Card>
  )
}

function DataCard() {
  const [busy, setBusy] = useState(false)

  async function exportCsv() {
    setBusy(true)
    try {
      const res = await authFetch("/api/v2/transactions")
      const json = (await res.json()) as TransactionsResponse & { empty?: boolean }
      const rows = json.transactions ?? []
      const esc = (v: unknown) => {
        const s = v == null ? "" : String(v)
        return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }
      const header = ["datum", "type", "effect", "symbool", "aantal", "koers", "valuta", "bedrag_eur", "kosten_eur"]
      const lines = rows.map((t) =>
        [t.date, t.type, t.name, t.symbol, t.quantity || "", t.price ?? "", t.currency, t.amountEur, t.feeEur || ""].map(esc).join(";"),
      )
      // Puntkomma + BOM: opent direct goed in Nederlandse Excel
      const blob = new Blob(["﻿" + [header.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `dekkertracker-transacties-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle>Gegevens</SectionTitle>
      <Link href="/importeren" className="flex items-center gap-3 rounded-2xl py-2.5 text-[14px] text-ink hover:text-accent">
        <Upload size={18} className="text-ink-2" />
        <span className="flex-1">DEGIRO-export importeren</span>
        <ChevronRight size={16} className="text-muted" />
      </Link>
      <button onClick={exportCsv} disabled={busy} className="flex w-full items-center gap-3 border-t border-line py-3 text-left text-[14px] text-ink hover:text-accent disabled:opacity-50">
        {busy ? <Loader2 size={18} className="animate-spin text-ink-2" /> : <Download size={18} className="text-ink-2" />}
        <span className="flex-1">Transacties exporteren (CSV)</span>
      </button>
    </Card>
  )
}

function AccountCard() {
  const router = useRouter()
  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle>Account</SectionTitle>
      <button
        onClick={async () => {
          await supabase.auth.signOut()
          router.replace("/login")
        }}
        className="flex w-full items-center gap-3 py-2 text-left text-[14px] text-down"
      >
        <LogOut size={18} />
        Uitloggen
      </button>
      <p className="mt-3 text-[12px] text-muted">
        <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        <span className="mx-2">·</span>
        <Link href="/voorwaarden" className="hover:text-ink">Voorwaarden</Link>
      </p>
    </Card>
  )
}
