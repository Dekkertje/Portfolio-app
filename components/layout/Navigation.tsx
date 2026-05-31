"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ArrowLeftRight, Upload, LogOut, TrendingUp, Users, Moon, Sun, Settings, User, Eye, EyeOff, ChevronLeft, ChevronRight, CalendarDays, CheckSquare, Tag, Bell, X, CheckCheck } from "lucide-react"
import { supabase, authFetch } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useTheme } from "@/contexts/ThemeContext"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { useSidebar } from "@/contexts/SidebarContext"
import { useEffect, useRef, useState } from "react"
import Image from "next/image"

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

type NavItem = {
  name: string
  href: string
  icon: React.ElementType
}

const navigation: NavItem[] = [
  { name: "Dashboard",    href: "/dashboard",               icon: LayoutDashboard },
  { name: "Dividenden",   href: "/dashboard/dividenden",    icon: CalendarDays    },
  { name: "Afgesloten",   href: "/dashboard/gesloten",      icon: CheckSquare     },
  { name: "Tickers",      href: "/dashboard/tickers",       icon: Tag             },
  { name: "Transacties",  href: "/transactions",            icon: ArrowLeftRight  },
  { name: "Importeren",   href: "/import",                  icon: Upload          },
  { name: "Politicians",  href: "/politicians",             icon: Users           },
  { name: "Notificaties", href: "/notificaties",            icon: Bell            },
  { name: "Instellingen", href: "/settings",                icon: Settings        },
]

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const { privacyMode, togglePrivacyMode } = usePrivacy()
  const { isCollapsed, toggleSidebar } = useSidebar()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [pendingTickers, setPendingTickers] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadPendingCount() {
      try {
        const res  = await fetch("/api/ticker-mapping?pending=1&count=1")
        const data = await res.json()
        setPendingTickers(data.count ?? 0)
      } catch { /* non-critical */ }
    }
    loadPendingCount()
  }, [])

  useEffect(() => {
    async function loadNotifications() {
      try {
        const res = await authFetch("/api/notifications/events")
        if (!res.ok) return
        const data = await res.json()
        const events = data.events ?? []
        setNotifications(events)
        setUnreadCount(events.filter((n: { is_read: boolean }) => !n.is_read).length)
      } catch { /* non-critical */ }
    }
    loadNotifications()
    const interval = setInterval(loadNotifications, 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    if (showNotifications) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showNotifications])

  async function markAllRead() {
    await authFetch("/api/notifications/events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  async function markRead(id: string) {
    await authFetch("/api/notifications/events", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1)  return "zojuist"
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)  return `${hrs}u`
    return `${Math.floor(hrs / 24)}d`
  }

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", session.user.id)
        .maybeSingle() // Use maybeSingle to avoid error when no profile exists

      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url)
      }
    }

    loadProfile()

    // Subscribe to profile changes
    const channel = supabase
      .channel("profile-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        (payload) => {
          if (payload.new && typeof payload.new === "object" && "avatar_url" in payload.new) {
            setAvatarUrl(payload.new.avatar_url as string | null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className={`flex h-screen flex-col bg-[#0b1120] border-r border-[#1a2744] transition-all duration-300 ${
      isCollapsed ? "w-20" : "w-64"
    }`}>
      {/* Logo Section - More Prominent */}
      <div className="border-b border-[#1a2744]">
        {isCollapsed ? (
          <div className="flex h-20 items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-lime-500 to-cyan-500 shadow-lg shadow-lime-500/20">
              <TrendingUp className="h-7 w-7 text-white" />
            </div>
          </div>
        ) : (
          <div className="px-5 py-5">
            <Image
              src="/images/dekkertracker-logo.png"
              alt="DekkerTracker"
              width={320}
              height={90}
              className="h-auto w-full max-w-[300px]"
              priority
            />
          </div>
        )}
      </div>

      {/* Profile Avatar */}
      {!isCollapsed && (
        <div className="px-6 py-4 border-b border-[#1a2744]">
          <Link href="/settings" className="flex items-center gap-3 group">
            <div className="relative w-12 h-12 rounded-full overflow-hidden bg-[#1a2744] group-hover:ring-2 group-hover:ring-lime-500 transition-all flex-shrink-0">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Profile"
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <User className="w-6 h-6 text-slate-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Mijn Account</p>
              <p className="text-xs text-slate-400 truncate">Bekijk profiel</p>
            </div>
          </Link>
        </div>
      )}
      {isCollapsed && (
        <div className="px-3 py-4 border-b border-[#1a2744] flex justify-center">
          <Link href="/settings" className="relative w-10 h-10 rounded-full overflow-hidden bg-[#1a2744] hover:ring-2 hover:ring-lime-500 transition-all">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Profile"
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <User className="w-5 h-5 text-slate-400" />
              </div>
            )}
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={`
                relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all
                ${isCollapsed ? "justify-center" : ""}
                ${
                  isActive
                    ? "bg-lime-500/15 text-lime-400 border border-lime-500/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }
              `}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && (
                <span className="flex flex-1 items-center justify-between">
                  {item.name}
                  {item.href === "/dashboard/tickers" && pendingTickers > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
                      {pendingTickers}
                    </span>
                  )}
                </span>
              )}
              {isCollapsed && item.href === "/dashboard/tickers" && pendingTickers > 0 && (
                <span className="absolute right-2 top-2 flex h-3 w-3 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white">
                  {pendingTickers > 9 ? "+" : pendingTickers}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Theme Toggle, Privacy Mode & Logout */}
      <div className="border-t border-[#1a2744] p-4 space-y-2">
        {/* Notifications bell */}
        <div ref={bellRef} className="relative">
          <button
            onClick={() => setShowNotifications(p => !p)}
            title={isCollapsed ? "Notificaties" : undefined}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-white/5 hover:text-white ${
              isCollapsed ? "justify-center" : ""
            } ${showNotifications ? "bg-white/5 text-white" : "text-slate-400"}`}
          >
            <div className="relative shrink-0">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <span className="flex flex-1 items-center justify-between">
                Notificaties
                {unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className={`absolute bottom-full mb-2 z-50 w-80 rounded-xl bg-[#0d1829] border border-[#1a2744] shadow-2xl shadow-black/50 ${
              isCollapsed ? "left-full ml-2 bottom-0" : "left-0"
            }`}>
              <div className="flex items-center justify-between border-b border-[#1a2744] px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-100">Notificaties</h3>
                <div className="flex items-center gap-3">
                  <Link href="/notificaties" onClick={() => setShowNotifications(false)} className="text-xs text-lime-400 hover:text-lime-300 transition-colors">
                    Beheer
                  </Link>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} title="Alles gelezen" className="text-slate-400 hover:text-lime-400 transition-colors">
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-200 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">Geen notificaties</div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`border-b border-[#1a2744] last:border-0 px-4 py-3 transition-colors ${
                        n.is_read ? "opacity-60" : "bg-blue-500/5"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.is_read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />}
                        {n.is_read  && <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          {n.link ? (
                            <Link
                              href={n.link}
                              onClick={() => { if (!n.is_read) markRead(n.id); setShowNotifications(false) }}
                              className="block"
                            >
                              <p className="text-xs font-medium text-slate-200 hover:text-lime-400 transition-colors">{n.title}</p>
                              {n.body && <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{n.body}</p>}
                            </Link>
                          ) : (
                            <div onClick={() => { if (!n.is_read) markRead(n.id) }} className="cursor-pointer">
                              <p className="text-xs font-medium text-slate-200">{n.title}</p>
                              {n.body && <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{n.body}</p>}
                            </div>
                          )}
                          <p className="mt-1 text-[10px] text-slate-500">{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={toggleTheme}
          title={isCollapsed ? (theme === "light" ? "Dark Mode" : "Light Mode") : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-white/5 hover:text-white ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          {theme === "light" ? (
            <>
              <Moon className="h-5 w-5" />
              {!isCollapsed && "Dark Mode"}
            </>
          ) : (
            <>
              <Sun className="h-5 w-5" />
              {!isCollapsed && "Light Mode"}
            </>
          )}
        </button>
        <button
          onClick={togglePrivacyMode}
          title={isCollapsed ? (privacyMode ? "Privacy Uit" : "Privacy Aan") : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-white/5 hover:text-white ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          {privacyMode ? (
            <>
              <Eye className="h-5 w-5" />
              {!isCollapsed && "Privacy Uit"}
            </>
          ) : (
            <>
              <EyeOff className="h-5 w-5" />
              {!isCollapsed && "Privacy Aan"}
            </>
          )}
        </button>
        <button
          onClick={toggleSidebar}
          title={isCollapsed ? "Uitklappen" : "Inklappen"}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-white/5 hover:text-white ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          {isCollapsed ? (
            <>
              <ChevronRight className="h-5 w-5" />
            </>
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" />
              <span>Inklappen</span>
            </>
          )}
        </button>
        <button
          onClick={handleLogout}
          title={isCollapsed ? "Uitloggen" : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-red-600/10 hover:text-red-400 ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && "Uitloggen"}
        </button>
      </div>
    </div>
  )
}

