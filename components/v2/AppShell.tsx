"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  ArrowLeftRight,
  Bell,
  CalendarDays,
  Ellipsis,
  Eye,
  EyeOff,
  Home,
  Layers,
  LogOut,
  Moon,
  Settings,
  Sun,
  Upload,
} from "lucide-react"
import { usePrivacy } from "@/contexts/PrivacyContext"
import { useTheme } from "@/contexts/ThemeContext"
import { supabase } from "@/lib/supabase/client"
import { Sheet } from "./Sheet"

type NavItem = { href: string; label: string; icon: React.ElementType }

// Tabs onderin (telefoon) — de rest zit achter "Meer"
const TABS: NavItem[] = [
  { href: "/overzicht", label: "Overzicht", icon: Home },
  { href: "/posities", label: "Posities", icon: Layers },
  { href: "/dividend", label: "Dividend", icon: CalendarDays },
]

const MORE: NavItem[] = [
  { href: "/transacties", label: "Transacties", icon: ArrowLeftRight },
  { href: "/importeren", label: "Importeren", icon: Upload },
  { href: "/notificaties", label: "Notificaties", icon: Bell },
  { href: "/instellingen", label: "Instellingen", icon: Settings },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/")
}

export function AppShell({ children, requireAuth = true }: { children: React.ReactNode; requireAuth?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    if (!requireAuth) return
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login")
    })
  }, [router, requireAuth])

  return (
    <div className="v2 min-h-dvh bg-plane text-ink">
      {/* Desktop: zijbalk */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
        <Link href="/overzicht" className="mb-8 flex items-center gap-2.5 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark.png" alt="" className="h-10 w-10" />
          <span className="text-[17px] font-semibold tracking-tight">DekkerTracker</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Hoofdmenu">
          {[...TABS, ...MORE].map((item) => (
            <SideLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
        <div className="flex flex-col gap-0.5 border-t border-line pt-4">
          <Preferences />
          <SignOut />
        </div>
      </aside>

      <div className="lg:pl-64">
        <main className="mx-auto w-full min-w-0 max-w-6xl px-4 pb-32 pt-safe sm:px-6 lg:px-10 lg:pb-16">{children}</main>
      </div>

      {/* Telefoon: tabbalk onderin */}
      <nav
        aria-label="Hoofdmenu"
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/85 backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map((item) => (
            <TabLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
              MORE.some((m) => isActive(pathname, m.href)) ? "text-ink" : "text-muted"
            }`}
            aria-haspopup="dialog"
          >
            <Ellipsis size={22} strokeWidth={2} />
            Meer
          </button>
        </div>
      </nav>

      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} pathname={pathname} />}
    </div>
  )
}

function SideLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors ${
        active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
      }`}
    >
      <Icon size={18} strokeWidth={active ? 2.3 : 1.9} />
      {item.label}
    </Link>
  )
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${active ? "text-ink" : "text-muted"}`}
    >
      <Icon size={22} strokeWidth={active ? 2.3 : 1.9} />
      {item.label}
    </Link>
  )
}

function Preferences() {
  const { theme, toggleTheme } = useTheme()
  const { privacyMode, togglePrivacyMode } = usePrivacy()
  return (
    <>
      <button onClick={toggleTheme} className="flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        {theme === "dark" ? "Licht thema" : "Donker thema"}
      </button>
      <button onClick={togglePrivacyMode} className="flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
        {privacyMode ? <Eye size={18} /> : <EyeOff size={18} />}
        {privacyMode ? "Bedragen tonen" : "Bedragen verbergen"}
      </button>
    </>
  )
}

function SignOut() {
  const router = useRouter()
  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut()
        router.replace("/login")
      }}
      className="flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
    >
      <LogOut size={18} />
      Uitloggen
    </button>
  )
}

function MoreSheet({ onClose, pathname }: { onClose: () => void; pathname: string }) {
  return (
    <Sheet title="Meer" onClose={onClose} desktop="hidden">
      <nav className="flex flex-col gap-0.5 pb-2">
        {MORE.map((item) => (
          <SideLink key={item.href} item={item} active={isActive(pathname, item.href)} onNavigate={onClose} />
        ))}
      </nav>
      <div className="flex flex-col gap-0.5 border-t border-line py-2">
        <Preferences />
        <SignOut />
      </div>
    </Sheet>
  )
}
