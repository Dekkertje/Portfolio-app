"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Spinner } from "@/components/v2/AuthLayout"
import { supabase } from "@/lib/supabase/client"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => router.replace(data.session ? "/overzicht" : "/login"))
  }, [router])

  return <Spinner />
}
