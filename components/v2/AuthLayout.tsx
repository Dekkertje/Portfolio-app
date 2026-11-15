"use client"

import { BarChart3, Coins, ShieldCheck } from "lucide-react"

/** Gedeelde opmaak voor inloggen/registreren: merkpaneel (desktop) + formulier. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="v2 flex min-h-dvh bg-plane text-ink">
      <aside
        className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-surface p-12 ring-1 ring-line lg:flex"
        style={{ backgroundImage: "radial-gradient(120% 80% at 0% 100%, var(--accent-wash), transparent 60%)" }}
      >
        <Brand />
        <div>
          <h2 className="max-w-md text-[40px] font-semibold leading-[1.1] tracking-tight">Je hele portfolio, helder in beeld.</h2>
          <ul className="mt-8 flex flex-col gap-4 text-[15px] text-ink-2">
            <Feature icon={BarChart3} text="Echt rendement: tijd- en geldgewogen, uit je eigen DEGIRO-export" />
            <Feature icon={Coins} text="Dividend, kosten en cash tot op de cent, plus wat er nog komt" />
            <Feature icon={ShieldCheck} text="Je gegevens blijven van jou; bedragen verbergen met één tik" />
          </ul>
        </div>
        <p className="text-[13px] text-muted">DekkerTracker · persoonlijk beleggingsdashboard</p>
      </aside>

      <main className="pt-safe pb-safe flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-10 lg:hidden">
            <Brand />
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-[15px] text-ink-2">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-96x96.png" alt="" className="h-9 w-9 rounded-xl" />
      <span className="text-[18px] font-semibold tracking-tight">DekkerTracker</span>
    </div>
  )
}

function Feature({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent-wash text-accent">
        <Icon size={17} />
      </span>
      <span className="pt-1">{text}</span>
    </li>
  )
}

export const authInput =
  "h-12 w-full rounded-2xl bg-surface px-4 text-[15px] text-ink ring-1 ring-line outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"

export function GoogleButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-full bg-surface text-[15px] font-medium text-ink ring-1 ring-line transition hover:bg-surface-2 disabled:opacity-50"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {label}
    </button>
  )
}

export function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-[12px] text-muted">
      <span className="h-px flex-1 bg-line" />
      of
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

export function FormMessage({ kind, children }: { kind: "error" | "success"; children: React.ReactNode }) {
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-2xl px-4 py-3 text-[13px] ${kind === "error" ? "bg-down-wash text-down" : "bg-up-wash text-up"}`}>
      {children}
    </p>
  )
}

/** Veelvoorkomende Supabase-fouten in begrijpelijk Nederlands. */
export function authError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes("invalid login credentials")) return "Onjuist e-mailadres of wachtwoord."
  if (m.includes("email not confirmed")) return "Bevestig eerst je e-mailadres via de link in je mail."
  if (m.includes("already registered") || m.includes("already been registered")) return "Er bestaat al een account met dit e-mailadres."
  if (m.includes("password should be at least")) return "Kies een wachtwoord van minimaal 8 tekens."
  if (m.includes("rate limit") || m.includes("too many")) return "Te veel pogingen. Probeer het over een paar minuten opnieuw."
  if (m.includes("unable to validate email") || m.includes("invalid email")) return "Dat lijkt geen geldig e-mailadres."
  return message
}

export function Spinner() {
  return (
    <div className="v2 flex min-h-dvh items-center justify-center bg-plane">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-grid border-t-accent" aria-label="Laden" />
    </div>
  )
}
