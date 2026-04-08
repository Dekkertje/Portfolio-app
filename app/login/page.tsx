"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/Toast"
import { Button } from "@/components/ui/Button"
import { TrendingUp } from "lucide-react"
import Image from "next/image"

export default function LoginPage() {
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
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg">
            <TrendingUp className="h-8 w-8 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-bold text-white">Portfolio Tracker</h1>
          <p className="mt-2 text-indigo-100">Beheer je beleggingen met gemak</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-white/20 bg-white/95 backdrop-blur-sm p-8 shadow-xl">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-slate-900">Welkom terug</h2>
            <p className="mt-2 text-slate-600">Log in met je Google account</p>
          </div>

          {/* Google Sign In Button */}
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            variant="outline"
            className="w-full flex items-center justify-center gap-3 border-slate-300 bg-white hover:bg-slate-50 text-slate-700 py-3"
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
            {loading ? "Bezig met inloggen..." : "Inloggen met Google"}
          </Button>

          {/* Info Text */}
          <p className="mt-6 text-center text-xs text-slate-500">
            Door in te loggen ga je akkoord met onze voorwaarden
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