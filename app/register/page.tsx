"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { AuthLayout, authError, authInput, Divider, FormMessage, GoogleButton, Spinner } from "@/components/v2/AuthLayout"
import { supabase } from "@/lib/supabase/client"

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState<"email" | "google" | null>(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/overzicht")
      else setChecking(false)
    })
  }, [router])

  async function register(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError("Kies een wachtwoord van minimaal 8 tekens.")
      return
    }
    setBusy("email")
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setBusy(null)
    if (error) {
      setError(authError(error.message))
      return
    }
    // Zonder e-mailbevestiging is er meteen een sessie
    if (data.session) router.replace("/importeren")
    else setDone(true)
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

  if (checking) return <Spinner />

  if (done) {
    return (
      <AuthLayout title="Check je mail" subtitle={`We hebben een bevestigingslink gestuurd naar ${email.trim()}.`}>
        <p className="text-[14px] text-ink-2">Klik op de link in de mail om je account te activeren. Daarna kun je je DEGIRO-export importeren.</p>
        <Link href="/login" className="mt-8 flex h-12 items-center justify-center rounded-full bg-ink text-[15px] font-medium text-surface">
          Naar inloggen
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Account aanmaken" subtitle="Gratis, en je kunt meteen je DEGIRO-export inlezen.">
      <GoogleButton onClick={google} disabled={busy !== null} label={busy === "google" ? "Doorsturen naar Google…" : "Verder met Google"} />
      <Divider />
      <form onSubmit={register} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">E-mailadres</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={authInput} placeholder="jij@voorbeeld.nl" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-2">Wachtwoord</span>
          <input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={authInput} placeholder="Minimaal 8 tekens" />
        </label>
        {error && <FormMessage kind="error">{error}</FormMessage>}
        <button type="submit" disabled={busy !== null} className="mt-2 flex h-12 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-surface disabled:opacity-50">
          {busy === "email" && <Loader2 size={18} className="animate-spin" />}
          Account aanmaken
        </button>
      </form>
      <p className="mt-4 text-center text-[12px] text-muted">
        Door een account aan te maken ga je akkoord met de{" "}
        <Link href="/voorwaarden" className="underline">
          voorwaarden
        </Link>{" "}
        en het{" "}
        <Link href="/privacy" className="underline">
          privacybeleid
        </Link>
        .
      </p>
      <p className="mt-8 text-center text-[14px] text-ink-2">
        Heb je al een account?{" "}
        <Link href="/login" className="font-medium text-accent">
          Inloggen
        </Link>
      </p>
    </AuthLayout>
  )
}
