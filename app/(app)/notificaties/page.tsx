"use client"

import { useMemo } from "react"
import type { NotificationsResponse } from "@/app/api/v2/notifications/route"
import { NotificationsView, type NotificationsApi } from "@/components/v2/NotificationsView"
import { useApi } from "@/components/v2/useApi"
import { authFetch } from "@/lib/supabase/client"

async function send(url: string, method: string, body?: unknown) {
  const res = await authFetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`)
}

export default function NotificatiesPage() {
  const state = useApi<NotificationsResponse>("/api/v2/notifications", 0)
  const api = useMemo<NotificationsApi>(
    () => ({
      create: (rule) => send("/api/notifications/rules", "POST", { ...rule, cooldown_min: 720, window_hours: 24, is_active: true }),
      toggle: (id, active) => send(`/api/notifications/rules/${id}`, "PATCH", { is_active: active }),
      remove: (id) => send(`/api/notifications/rules/${id}`, "DELETE"),
    }),
    [],
  )
  return <NotificationsView {...state} api={api} />
}
