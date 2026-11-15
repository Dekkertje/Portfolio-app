"use client"

import { useEffect } from "react"
import { X } from "lucide-react"

/** Paneel dat van onderen inschuift (telefoon) of als dialoog verschijnt (desktop). */
export function Sheet({
  title,
  onClose,
  children,
  desktop = "dialog",
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  /** "dialog": op desktop gecentreerd; "hidden": alleen op mobiel bestaan (zoals het Meer-menu) */
  desktop?: "dialog" | "hidden"
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  return (
    <div className={`fixed inset-0 z-40 ${desktop === "hidden" ? "lg:hidden" : "lg:grid lg:place-items-center"}`} role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Sluiten" onClick={onClose} className="absolute inset-0 bg-black/40 animate-fade-in" />
      <div className="pb-safe absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-[28px] bg-surface px-3 pt-2 shadow-2xl animate-sheet-up lg:relative lg:inset-auto lg:w-[440px] lg:rounded-[28px] lg:pb-3">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-grid lg:hidden" aria-hidden />
        <div className="flex items-center justify-between px-3 pb-2 lg:pt-3">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Sluiten" className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-ink-2">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
