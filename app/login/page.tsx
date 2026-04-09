"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/Toast"
import { Button } from "@/components/ui/Button"
import { TrendingUp, Mail } from "lucide-react"
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

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        showToast(error.message, "error")
        setLoading(false)
        return
      }

      router.push("/dashboard")
    } catch (error) {
      showToast("Er ging iets mis bij het inloggen.", "error")
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        showToast(error.message, "error")
        setLoading(false)
      }
    } catch (error) {
      showToast("Er ging iets mis bij het inloggen.", "error")
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 px-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6">
            <Image
              src="/images/dekkertracker-logo.png"
              alt="DekkerTracker"
              width={400}
              height={100}
              className="mx-auto"
              priority
            />
          </div>
          <p className="mt-4 text-xl text-white/90">Beheer je beleggingen met gemak</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-white/20 bg-white/95 backdrop-blur-sm p-8 shadow-xl">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-slate-900">Welkom terug</h2>
            <p className="mt-2 text-slate-600">Log in op je account</p>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                E-mailadres
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="naam@voorbeeld.nl"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Wachtwoord
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              variant="primary"
              className="w-full py-2.5"
            >
              <Mail className="mr-2 h-4 w-4" />
              {loading ? "Bezig met inloggen..." : "Inloggen"}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-slate-300"></div>
            <span className="px-4 text-sm text-slate-500">of</span>
            <div className="flex-1 border-t border-slate-300"></div>
          </div>

          {/* Google Sign In Button */}
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            variant="secondary"
            className="w-full flex items-center justify-center gap-3 py-2.5"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Inloggen met Google
          </Button>

          {/* Register Link */}
          <p className="mt-6 text-center text-sm text-slate-600">
            Nog geen account?{" "}
            <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
              Registreer hier
            </Link>
          </p>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="rounded-lg bg-white/10 backdrop-blur-sm p-4">
            <div className="text-2xl font-bold text-white">📊</div>
            <p className="mt-1 text-xs text-indigo-100">Real-time prijzen</p>
          </div>
          <div className="rounded-lg bg-white/10 backdrop-blur-sm p-4">
            <div className="text-2xl font-bold text-white">📈</div>
            <p className="mt-1 text-xs text-indigo-100">Performance tracking</p>
          </div>
          <div className="rounded-lg bg-white/10 backdrop-blur-sm p-4">
            <div className="text-2xl font-bold text-white">💰</div>
            <p className="mt-1 text-xs text-indigo-100">Dividend overzicht</p>
          </div>
        </div>
      </div>
    </main>
  )
}