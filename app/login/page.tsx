"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/Toast"
import { TrendingUp, Mail, BarChart2, ShieldCheck, Zap } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    // Show error from OAuth callback if present in URL
    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get("error") || params.get("error_description")
    if (oauthError) showToast(`Google login fout: ${oauthError}`, "error")

    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push("/dashboard")
      } else {
        setChecking(false)
      }
    }
    checkAuth()
  }, [router, showToast])

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        showToast(error.message, "error")
        setLoading(false)
        return
      }

      router.push("/dashboard")
    } catch {
      showToast("Er ging iets mis bij het inloggen.", "error")
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
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
      showToast("Er ging iets mis bij het inloggen.", "error")
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#060d1a]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-lime-500 border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <main className="flex min-h-screen bg-[#060d1a] text-white">

      {/* ── Left panel: branding ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">

        {/* Subtle grid background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(#a3e635 1px, transparent 1px), linear-gradient(90deg, #a3e635 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Glow blobs */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-lime-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

        {/* Logo */}
        <div className="relative">
          <Image
            src="/images/dekkertracker-logo.png"
            alt="DekkerTracker"
            width={340}
            height={90}
            priority
          />
        </div>

        {/* Slogan + tagline */}
        <div className="relative">
          <p className="text-4xl font-bold leading-tight tracking-tight text-white">
            Jouw vermogen.<br />
            Jouw inzicht.<br />
            <span className="text-lime-400">Altijd up-to-date.</span>
          </p>
          <p className="mt-5 text-base text-slate-400 max-w-sm leading-relaxed">
            Volg al je beleggingen op één plek. Van real-time koersen tot historische prestaties — alles wat je nodig hebt om slimmer te beleggen.
          </p>

          {/* Feature chips */}
          <div className="mt-8 flex flex-col gap-3">
            {[
              { icon: BarChart2, label: "Real-time koersen & P&L" },
              { icon: TrendingUp, label: "Benchmark vergelijking" },
              { icon: ShieldCheck, label: "Veilig via Supabase Auth" },
              { icon: Zap,        label: "Automatisch vernieuwen" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-sm text-slate-400">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-lime-500/10 ring-1 ring-lime-500/20">
                  <Icon className="h-3.5 w-3.5 text-lime-400" />
                </div>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom footnote */}
        <p className="relative text-xs text-slate-600">
          © {new Date().getFullYear()} DekkerTracker —{" "}
          <Link href="/privacy" className="hover:text-slate-400 transition-colors">
            Privacybeleid
          </Link>
        </p>
      </div>

      {/* ── Right panel: login form ──────────────────────────────────────────── */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center px-6 py-12">

        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <Image
            src="/images/dekkertracker-logo.png"
            alt="DekkerTracker"
            width={280}
            height={75}
            priority
          />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Welkom terug</h1>
            <p className="mt-1 text-sm text-slate-400">Log in om verder te gaan</p>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
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
                className="w-full rounded-xl border border-[#1a2744] bg-[#0d1829] px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500/40 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-500 px-4 py-3 text-sm font-semibold text-[#060d1a] hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Mail className="h-4 w-4" />
              {loading ? "Bezig met inloggen..." : "Inloggen"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 border-t border-[#1a2744]" />
            <span className="text-xs text-slate-600">of</span>
            <div className="flex-1 border-t border-[#1a2744]" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#1a2744] bg-[#0d1829] px-4 py-3 text-sm font-medium text-slate-300 hover:bg-[#1a2744] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Inloggen met Google
          </button>

          {/* Register */}
          <p className="mt-6 text-center text-sm text-slate-500">
            Nog geen account?{" "}
            <Link href="/register" className="font-medium text-lime-400 hover:text-lime-300 transition-colors">
              Registreer hier
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
