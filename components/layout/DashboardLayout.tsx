"use client"

import { Navigation } from "./Navigation"
import { useSidebar } from "@/contexts/SidebarContext"

type DashboardLayoutProps = {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isCollapsed } = useSidebar()

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <aside className={`flex-shrink-0 transition-all duration-300 ${
        isCollapsed ? "w-20" : "w-64"
      }`}>
        <Navigation />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

