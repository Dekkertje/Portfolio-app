"use client"

import { useEffect } from "react"
// Importeren zodat "beforeinstallprompt" al bij het laden wordt opgevangen
import "@/lib/install"

/** Registreert de service worker (alleen in productie: in dev zit hij caching/HMR in de weg). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {})
  }, [])
  return null
}
