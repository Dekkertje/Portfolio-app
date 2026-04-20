"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    async function handleCallback() {
      // Hash fragment flow (implicit): #access_token=...&refresh_token=...
      const hash = window.location.hash
      if (hash.includes("access_token")) {
        const params = new URLSearchParams(hash.substring(1))
        const accessToken  = params.get("access_token")
        const refreshToken = params.get("refresh_token") ?? ""
        if (accessToken) {
          const { error } = await supabase.auth.setSession({
            access_token:  accessToken,
            refresh_token: refreshToken,
          })
          if (error) {
            router.replace(`/login?error=${encodeURIComponent(error.message)}`)
          } else {
            router.replace("/dashboard")
          }
          return
        }
      }

      // PKCE flow: ?code=...
      const code = new URLSearchParams(window.location.search).get("code")
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          router.replace(`/login?error=${encodeURIComponent(error.message)}`)
        } else {
          router.replace("/dashboard")
        }
        return
      }

      // No token or code — check if a session already exists (e.g. page refresh)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace("/dashboard")
      } else {
        router.replace("/login?error=no_token")
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#060d1a]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full border-2 border-lime-500 border-t-transparent animate-spin" />
        <p className="text-sm text-slate-400">Inloggen…</p>
      </div>
    </div>
  )
}
