"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"
import { authFetch } from "@/lib/supabase/client"

type Entry<T> = { data: T | null; empty: boolean; error: string | null; loading: boolean; fetchedAt: number }

const stores = new Map<string, { state: Entry<unknown>; listeners: Set<() => void>; inFlight: Promise<void> | null }>()

function store(url: string) {
  let s = stores.get(url)
  if (!s) {
    s = { state: { data: null, empty: false, error: null, loading: true, fetchedAt: 0 }, listeners: new Set(), inFlight: null }
    stores.set(url, s)
  }
  return s
}

function load(url: string): Promise<void> {
  const s = store(url)
  if (s.inFlight) return s.inFlight
  const set = (patch: Partial<Entry<unknown>>) => {
    s.state = { ...s.state, ...patch }
    s.listeners.forEach((l) => l())
  }
  s.inFlight = (async () => {
    try {
      const res = await authFetch(url)
      if (res.status === 401) {
        window.location.href = "/login"
        return
      }
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      set(json.empty ? { empty: true, data: null, error: null } : { data: json, empty: false, error: null })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    } finally {
      set({ loading: false, fetchedAt: Date.now() })
      s.inFlight = null
    }
  })()
  return s.inFlight
}

/** Eenvoudige gedeelde cache per API-url; tussen tabs wisselen haalt niets opnieuw op binnen `maxAgeMs`. */
export function useApi<T>(url: string, maxAgeMs = 5 * 60_000) {
  const s = store(url)
  const state = useSyncExternalStore(
    (l) => {
      s.listeners.add(l)
      return () => s.listeners.delete(l)
    },
    () => s.state,
    () => s.state,
  ) as Entry<T>

  useEffect(() => {
    if (Date.now() - store(url).state.fetchedAt > maxAgeMs) load(url)
  }, [url, maxAgeMs])

  const refresh = useCallback(() => load(url), [url])
  return { ...state, refresh }
}

/** Cache van een url leegmaken, bijv. na een import of wijziging. */
export function invalidateApi(url: string) {
  const s = stores.get(url)
  if (s) s.state = { ...s.state, fetchedAt: 0 }
}
