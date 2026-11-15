"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { AuthLayout, authError, authInput, Divider, FormMessage, GoogleButton, Spinner } from "@/components/v2/AuthLayout"
import { supabase } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState<"email" | "google" | "reset" | null>(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    // Fout uit de OAuth-callback tonen
    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get("error_description") || params.get("error")

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) return router.replace("/overzicht")
      if (oauthError) setError(oauthError === "no_token" ? "Inloggen met Google is niet gelukt. Probeer het opnieuw." : authError(oauthError))
      setChecking(false)
    })
  }, [router])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setBusy("email")
    setError(null)
    setNotice(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      setError(authError(error.message))
      setBusy(null)
      return
    }
    router.replace("/overzicht")
  }

  async function google() {
    setBusy("google")
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } })
    if (error) {
      setError(authError(error.message))
      setBusy(null)
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError("Vul eerst je e-mailadres in, dan sturen we je een herstellink.")
      return
    }
    setBusy("reset")
    setError(null)
    // Na de link ben je ingelogd; een nieuw wachtwoord kies je in Instellingen
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback` })
    setBusy(null)
    if (error) setError(authError(error.message))
    else setNotice("Als dit adres bij ons bekend is, staat er een herstellink in je mail. Kies daarna in Instellingen een nieuw wachtwoord.")
  }

  if (checking) return <Spinner />

  return (
    <AuthLayout title="Welkom terug" subtitle="Log in om je portfolio te bekijken.">
      <GoogleButton onClick={google} disabled={busy !== null} label={busy === "google" ? "Doorsturen naar Google…" : "Inloggen met Google"} />
      <Divider />
      <form onSubmit={login} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">E-mailadres</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={authInput} placeholder="jij@voorbeeld.nl" />
        </label>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="text-[13px] font-medium text-ink-2">
              Wachtwoord
            </label>
            <button type="button" onClick={resetPassword} disabled={busy !== null} className="text-[12px] font-medium text-accent">
              {busy === "reset" ? "Versturen…" : "Wachtwoord vergeten?"}
            </button>
          </div>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={authInput} />
        </div>
        {error && <FormMessage kind="error">{error}</FormMessage>}
        {notice && <FormMessage kind="success">{notice}</FormMessage>}
        <button type="submit" disabled={busy !== null} className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-surface disabled:opacity-50">
          {busy === "email" && <Loader2 size={18} className="animate-spin" />}
          Inloggen
        </button>
      </form>
      <p className="mt-8 text-center text-[14px] text-ink-2">
        Nog geen account?{" "}
        <Link href="/register" className="font-medium text-accent">
          Account aanmaken
        </Link>
      </p>
    </AuthLayout>
  )
}
