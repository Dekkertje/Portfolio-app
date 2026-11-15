"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"
import { authFetch } from "@/lib/supabase/client"
import type { PortfolioOverview } from "@/lib/portfolio/overview"

/**
 * Gedeelde cache voor het overzicht: Overzicht en Posities gebruiken dezelfde data,
 * dus wisselen tussen tabs haalt niets opnieuw op. Bij verversen blijft de vorige
 * data staan (geen flits), en zolang het tabblad zichtbaar is wordt elke minuut ververst.
 */

type State = {
  data: PortfolioOverview | null
  empty: boolean
  error: string | null
  loading: boolean
  refreshing: boolean
  fetchedAt: number
}

let state: State = { data: null, empty: false, error: null, loading: true, refreshing: false, fetchedAt: 0 }
const listeners = new Set<() => void>()
let inFlight: Promise<void> | null = null

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

async function load(): Promise<void> {
  if (inFlight) return inFlight
  set(state.data ? { refreshing: true } : { loading: true })
  inFlight = (async () => {
    try {
      const res = await authFetch("/api/v2/overview")
      if (res.status === 401) {
        window.location.href = "/login"
        return
      }
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      if (json.empty) set({ empty: true, data: null, error: null })
      else set({ data: json as PortfolioOverview, empty: false, error: null })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    } finally {
      set({ loading: false, refreshing: false, fetchedAt: Date.now() })
      inFlight = null
    }
  })()
  return inFlight
}

const REFRESH_MS = 60_000

export function usePortfolio() {
  const snapshot = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
    () => state,
  )

  useEffect(() => {
    if (Date.now() - state.fetchedAt > REFRESH_MS) load()
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load()
    }, REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - state.fetchedAt > REFRESH_MS) load()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  const refresh = useCallback(() => load(), [])
  return { ...snapshot, refresh }
}
