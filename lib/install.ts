"use client"

/**
 * Installeren als app. Chrome/Android sturen één keer "beforeinstallprompt"
 * kort na het laden; die bewaren we zodat een knop later de echte
 * installatiedialoog kan openen. iOS heeft geen dialoog: daar kan het
 * alleen via Safari → Deel → "Zet op beginscherm".
 */

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

let deferred: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault() // eigen knop i.p.v. de standaard mini-balk
    deferred = e as InstallPromptEvent
    notify()
  })
  window.addEventListener("appinstalled", () => {
    installed = true
    deferred = null
    notify()
  })
}

export type InstallState = {
  /** Draait al als geïnstalleerde app */
  standalone: boolean
  /** Er is een echte installatiedialoog beschikbaar (Android/Chrome/Edge) */
  canPrompt: boolean
  ios: boolean
  /** iOS maar niet in Safari: installeren kan dan niet */
  iosNotSafari: boolean
  installed: boolean
}

export function installState(): InstallState {
  if (typeof window === "undefined") return { standalone: false, canPrompt: false, ios: false, iosNotSafari: false, installed: false }
  const ua = navigator.userAgent
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  return {
    standalone,
    canPrompt: deferred !== null,
    ios,
    iosNotSafari: ios && /crios|fxios|edgios|gsa\//i.test(ua),
    installed,
  }
}

export function subscribeInstall(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  notify()
  return outcome === "accepted"
}
