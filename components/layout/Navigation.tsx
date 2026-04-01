"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ArrowLeftRight, Upload, LogOut, TrendingUp, Users, Moon, Sun, Settings, User } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useTheme } from "@/contexts/ThemeContext"
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", session.user.id)
        .single()

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
    <div className="flex h-screen flex-col bg-slate-900 dark:bg-slate-950">
      {/* Logo & Profile */}
      <div className="flex h-16 items-center justify-between border-b border-slate-800 dark:border-slate-700 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Portfolio</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">Beheer je beleggingen</p>
          </div>
        </div>

        {/* Profile Avatar */}
        <Link href="/settings" className="relative w-10 h-10 rounded-full overflow-hidden bg-slate-700 hover:ring-2 hover:ring-indigo-500 transition-all">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Profile"
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <User className="w-5 h-5 text-slate-400" />
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all
                ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/50"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }
              `}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Theme Toggle & Logout */}
      <div className="border-t border-slate-800 dark:border-slate-700 p-4 space-y-2">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 dark:text-slate-400 transition-all hover:bg-slate-800 dark:hover:bg-slate-900 hover:text-white"
        >
          {theme === "light" ? (
            <>
              <Moon className="h-5 w-5" />
              Dark Mode
            </>
          ) : (
            <>
              <Sun className="h-5 w-5" />
              Light Mode
            </>
          )}
        </button>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 dark:text-slate-400 transition-all hover:bg-red-600/10 hover:text-red-400"
        >
          <LogOut className="h-5 w-5" />
          Uitloggen
        </button>
      </div>
    </div>
  )
}

