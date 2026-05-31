"use client"

import { useEffect, useRef, useState } from "react"
import { Bell } from "lucide-react"
import { authFetch } from "@/lib/supabase/client"
import Link from "next/link"

type NotificationEvent = {
  id: string
  title: string
  body: string
  ticker: string | null
  is_read: boolean
  sent_at: string
}

export function NotificationBell() {
  const [events, setEvents] = useState<NotificationEvent[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = events.filter(e => !e.is_read).length

  async function load() {
    try {
      const res = await authFetch("/api/notifications/events")
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events ?? [])
      }
    } catch {}
  }

  async function markAllRead() {
    await authFetch("/api/notifications/events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
    setEvents(prev => prev.map(e => ({ ...e, is_read: true })))
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function timeAgo(iso: string) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 60) return "zojuist"
    if (diff < 3600) return `${Math.floor(diff / 60)} min geleden`
    if (diff < 86400) return `${Math.floor(diff / 3600)} uur geleden`
    return `${Math.floor(diff / 86400)} dagen geleden`
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open && unread > 0) markAllRead() }}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a2744] hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime-500 px-1 text-[10px] font-bold text-[#060d1a]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-slate-200 dark:border-[#1a2744] bg-white dark:bg-[#0b1120] shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1a2744] px-4 py-3">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notificaties</span>
            <Link
              href="/notificaties"
              onClick={() => setOpen(false)}
              className="text-xs text-lime-500 hover:text-lime-400"
            >
              Beheer
            </Link>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {events.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Geen notificaties</p>
            ) : (
              events.slice(0, 20).map(event => (
                <div
                  key={event.id}
                  className={`border-b border-slate-50 dark:border-[#1a2744] px-4 py-3 last:border-b-0 ${
                    !event.is_read ? "bg-lime-500/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!event.is_read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-lime-500" />
                    )}
                    <div className={!event.is_read ? "" : "pl-4"}>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{event.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{event.body}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{timeAgo(event.sent_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
