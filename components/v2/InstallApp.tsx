"use client"

import { useState, useSyncExternalStore } from "react"
import { Download, Share, SquarePlus, X } from "lucide-react"
import { installState, promptInstall, subscribeInstall, type InstallState } from "@/lib/install"
import { Card, SectionTitle } from "./ui"

const SERVER_STATE: InstallState = { standalone: false, canPrompt: false, ios: false, iosNotSafari: false, installed: false }
let cached: InstallState = SERVER_STATE
let cachedKey = ""

function snapshot(): InstallState {
  const s = installState()
  const key = JSON.stringify(s)
  if (key !== cachedKey) {
    cachedKey = key
    cached = s
  }
  return cached
}

export function useInstall() {
  return useSyncExternalStore(subscribeInstall, snapshot, () => SERVER_STATE)
}

/** Uitleg/knop om DekkerTracker als app te installeren, passend bij het apparaat. */
function InstallBody({ s }: { s: InstallState }) {
  if (s.standalone || s.installed) return <p className="text-[14px] text-ink-2">DekkerTracker is geïnstalleerd als app op dit apparaat.</p>

  if (s.canPrompt) {
    return (
      <button onClick={() => promptInstall()} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-[14px] font-medium text-surface">
        <Download size={17} /> App installeren
      </button>
    )
  }

  if (s.ios) {
    if (s.iosNotSafari) return <p className="text-[14px] text-ink-2">Open deze pagina in <b>Safari</b> om DekkerTracker op je beginscherm te zetten; andere browsers op de iPhone kunnen dat niet.</p>
    return (
      <ol className="flex flex-col gap-3 text-[14px] text-ink-2">
        <li className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink"><Share size={16} /></span>
          Tik in Safari op de deelknop onderin
        </li>
        <li className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink"><SquarePlus size={16} /></span>
          Kies &ldquo;Zet op beginscherm&rdquo; en tik op Voeg toe
        </li>
      </ol>
    )
  }

  return (
    <p className="text-[14px] text-ink-2">
      Open het browsermenu (⋮) en kies <b>App installeren</b> of <b>Toevoegen aan startscherm</b>. Zie je die optie niet, herlaad de pagina dan één keer.
    </p>
  )
}

export function InstallCard() {
  const s = useInstall()
  return (
    <Card className="p-4 sm:p-6">
      <SectionTitle>App op je telefoon</SectionTitle>
      <InstallBody s={s} />
    </Card>
  )
}

const DISMISS_KEY = "install-banner-dismissed"

/** Kleine banner op het overzicht (alleen mobiel, niet als al geïnstalleerd, wegklikbaar). */
export function InstallBanner() {
  const s = useInstall()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1"
    } catch {
      return false
    }
  })
  if (dismissed || s.standalone || s.installed || (!s.ios && !s.canPrompt)) return null

  return (
    <div className="flex items-start gap-3 rounded-3xl bg-accent-wash p-4 lg:hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-mark.png" alt="" className="h-10 w-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">Zet DekkerTracker op je beginscherm</p>
        {s.canPrompt ? (
          <button onClick={() => promptInstall()} className="mt-2 rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-surface">
            Installeren
          </button>
        ) : (
          <p className="mt-0.5 text-[13px] text-ink-2">
            {s.iosNotSafari ? "Open deze pagina in Safari, dan " : ""}Tik op <Share size={13} className="inline -translate-y-px" /> en kies &ldquo;Zet op beginscherm&rdquo;.
          </p>
        )}
      </div>
      <button
        aria-label="Sluiten"
        onClick={() => {
          setDismissed(true)
          try {
            localStorage.setItem(DISMISS_KEY, "1")
          } catch {}
        }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface/60"
      >
        <X size={16} />
      </button>
    </div>
  )
}
