"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ArrowLeftRight, Upload, LogOut, TrendingUp, Users, Moon, Sun, Settings, User, Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useTheme } from "@/contexts/ThemeContext"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { useSidebar } from "@/contexts/SidebarContext"
import { useEffect, useState } from "react"
import Image from "next/image"

type NavItem = {
  name: string
  href: string
  icon: React.ElementType
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Transacties", href: "/transactions", icon: ArrowLeftRight },
  { name: "Importeren", href: "/import", icon: Upload },
  { name: "Politicians", href: "/politicians", icon: Users },
  { name: "Instellingen", href: "/settings", icon: Settings },
]

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const { privacyMode, togglePrivacyMode } = usePrivacy()
  const { isCollapsed, toggleSidebar } = useSidebar()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

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
              width={280}
              height={80}
              className="h-auto w-full max-w-[260px]"
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
                flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all
                ${isCollapsed ? "justify-center" : ""}
                ${
                  isActive
                    ? "bg-lime-500/15 text-lime-400 border border-lime-500/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }
              `}
            >
              <Icon className="h-5 w-5" />
              {!isCollapsed && item.name}
            </Link>
          )
        })}
      </nav>

      {/* Theme Toggle, Privacy Mode & Logout */}
      <div className="border-t border-[#1a2744] p-4 space-y-2">
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

