import type { Viewport } from "next"
import { AppShell } from "@/components/v2/AppShell"

export const viewport: Viewport = {
  // Content loopt door achter de notch/home-indicator; safe-area-padding vangt dat op
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
