"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/Toast"
import { UserPlus } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push("/dashboard")
      } else {
        setChecking(false)
      }
    }
    checkAuth()
  }, [router])

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signUp({ email, password })

      if (error) {
        showToast(error.message, "error")
        return
      }

      showToast("Account aangemaakt! Je kunt nu inloggen.", "success")
      router.push("/login")
    } catch {
      showToast("Er ging iets mis bij het registreren.", "error")
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleRegister() {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })

      if (error) {
        showToast(error.message, "error")
        setLoading(false)
      }
    } catch {
      showToast("Er ging iets mis.", "error")
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#060d1a]">
        <div className="h-10 w-10 rounded-full border-2 border-lime-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <main className="flex min-h-screen bg-[#060d1a] text-white items-center justify-center px-6 py-12">

      {/* Glow blobs */}
      <div className="pointer-events-none fixed -top-40 -right-40 h-96 w-96 rounded-full bg-lime-500/8 blur-3xl" />
      <div className="pointer-events-none fixed bottom-0 -left-40 h-80 w-80 rounded-full bg-cyan-500/8 blur-3xl" />

      <div className="relative w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/images/dekkertracker-logo.png"
            alt="DekkerTracker"
            width={280}
            height={75}
            priority
          />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Account aanmaken</h1>
          <p className="mt-1 text-sm text-slate-400">Begin met het bijhouden van je portfolio</p>
        </div>

        {/* Google register */}
        <button
          onClick={handleGoogleRegister}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#1a2744] bg-[#0d1829] px-4 py-3 text-sm font-medium text-slate-300 hover:bg-[#1a2744] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Registreren met Google
        </button>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 border-t border-[#1a2744]" />
          <span className="text-xs text-slate-600">of met e-mail</span>
          <div className="flex-1 border-t border-[#1a2744]" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400 uppercase tracking-wider">
              E-mailadres
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="naam@voorbeeld.nl"
              required
              autoComplete="email"
              className="w-full rounded-xl border border-[#1a2744] bg-[#0d1829] px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500/40 transition-colors"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400 uppercase tracking-wider">
              Wachtwoord
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              className="w-full rounded-xl border border-[#1a2744] bg-[#0d1829] px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500/40 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-500 px-4 py-3 text-sm font-semibold text-[#060d1a] hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            {loading ? "Bezig met registreren..." : "Account aanmaken"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Heb je al een account?{" "}
          <Link href="/login" className="font-medium text-lime-400 hover:text-lime-300 transition-colors">
            Log hier in
          </Link>
        </p>
      </div>
    </main>
  )
}
