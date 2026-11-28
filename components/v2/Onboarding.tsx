"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowRight, BellRing, CalendarDays, Download, Layers, LineChart, Share, Upload, X, type LucideIcon } from "lucide-react"
import { promptInstall } from "@/lib/install"
import { supabase } from "@/lib/supabase/client"
import { useInstall } from "./InstallApp"

const START_EVENT = "dekkertracker:onboarding"

/** Start de rondleiding handmatig (bijv. vanuit Instellingen). */
export function startOnboarding() {
  window.dispatchEvent(new Event(START_EVENT))
}

type Step = {
  key: string
  icon?: LucideIcon
  title: string
  body: string
  points?: string[]
  art: React.ReactNode
}

const STEPS: Step[] = [
  {
    key: "welkom",
    title: "Welkom bij DekkerTracker",
    body: "Je hele portfolio op één plek: waarde, rendement, dividend en kosten, berekend uit je eigen DEGIRO-gegevens.",
    art: <WelcomeArt />,
  },
  {
    key: "import",
    icon: Upload,
    title: "Begin met je DEGIRO-export",
    body: "De app leest de exports die DEGIRO je zelf geeft. Je DEGIRO-wachtwoord hebben we nooit nodig.",
    points: [
      "Log in op DEGIRO in je browser",
      "Exporteer Transacties én Rekeningoverzicht als CSV, vanaf de opening van je rekening",
      "Sleep beide bestanden in de app. Later opnieuw importeren is veilig",
    ],
    art: <ImportArt />,
  },
  {
    key: "overzicht",
    icon: LineChart,
    title: "Zie hoe je ervoor staat",
    body: "Totale waarde, resultaat van vandaag en je echte rendement, zonder dat stortingen het vertekenen.",
    points: ["Vergelijk je rendement met MSCI World, de S&P 500 of de AEX", "Zie per sector en land waar je geld zit, en wat je mist"],
    art: <CompareArt />,
  },
  {
    key: "posities",
    icon: Layers,
    title: "Elke positie in detail",
    body: "Tik op een positie voor de koersgrafiek met al je aan- en verkopen, en wat elke trade heeft opgeleverd.",
    points: ["Kostprijs, gerealiseerd en ongerealiseerd resultaat", "Een volglijst voor aandelen die je (nog) niet hebt"],
    art: <TradesArt />,
  },
  {
    key: "dividend",
    icon: CalendarDays,
    title: "Dividend en je aangifte",
    body: "Ontvangen en verwacht dividend, en per jaar alles wat je voor je aangifte nodig hebt.",
    points: ["Waarde op 1 januari voor box 3", "Ingehouden dividendbelasting per land, en al je kosten"],
    art: <DividendArt />,
  },
  {
    key: "app",
    icon: BellRing,
    title: "Op je telefoon, met meldingen",
    body: "Zet de app op je beginscherm en krijg een seintje als een koers je drempel raakt.",
    art: <PhoneArt />,
  },
]

/** `preview`: alleen voor /dev-preview, opent direct op die stap zonder sessie. */
export function Onboarding({ preview }: { preview?: { step: number; hasData?: boolean } } = {}) {
  const router = useRouter()
  const [open, setOpen] = useState(!!preview)
  const [step, setStep] = useState(preview?.step ?? 0)
  const [hasData, setHasData] = useState(preview?.hasData ?? true)
  const touch = useRef<number | null>(null)

  // Automatisch voor accounts die de rondleiding nog niet zagen
  useEffect(() => {
    if (preview) return
    let cancelled = false
    ;(async () => {
      const { data: s } = await supabase.auth.getSession()
      const uid = s.session?.user.id
      if (!uid) return
      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from("profiles").select("onboarded_at").eq("id", uid).maybeSingle(),
        supabase.from("ledger_events").select("id", { count: "exact", head: true }),
      ])
      if (cancelled) return
      setHasData((count ?? 0) > 0)
      if (profile && !profile.onboarded_at) setOpen(true)
    })()
    const onStart = () => {
      setStep(0)
      setOpen(true)
    }
    window.addEventListener(START_EVENT, onStart)
    return () => {
      cancelled = true
      window.removeEventListener(START_EVENT, onStart)
    }
  }, [preview])

  const close = useCallback(async (goTo?: string) => {
    setOpen(false)
    if (preview) return
    const { data: s } = await supabase.auth.getSession()
    const uid = s.session?.user.id
    if (uid) await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", uid)
    if (goTo) router.push(goTo)
  }, [router, preview])

  const last = step === STEPS.length - 1
  const next = useCallback(() => (last ? close(hasData ? undefined : "/importeren") : setStep((s) => s + 1)), [last, close, hasData])
  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next()
      else if (e.key === "ArrowLeft") prev()
      else if (e.key === "Escape") close()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, next, prev, close])

  if (!open) return null
  const s = STEPS[step]
  const Icon = s.icon

  return (
    <div className="v2 fixed inset-0 z-50 sm:grid sm:place-items-center" role="dialog" aria-modal="true" aria-label="Rondleiding">
      <div className="absolute inset-0 hidden bg-black/50 animate-fade-in sm:block" aria-hidden />
      <div
        className="pt-safe pb-safe relative flex h-full flex-col bg-plane text-ink sm:h-auto sm:max-h-[92vh] sm:w-[460px] sm:overflow-y-auto sm:rounded-[32px] sm:bg-surface sm:shadow-2xl"
        onPointerDown={(e) => (touch.current = e.clientX)}
        onPointerUp={(e) => {
          if (touch.current == null) return
          const dx = e.clientX - touch.current
          touch.current = null
          if (dx < -50) next()
          else if (dx > 50) prev()
        }}
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="text-[13px] font-medium text-muted">
            {step + 1} van {STEPS.length}
          </span>
          <button onClick={() => close()} className="flex h-9 items-center gap-1 rounded-full px-3 text-[14px] font-medium text-ink-2 hover:bg-surface-2">
            Overslaan <X size={15} />
          </button>
        </div>

        <div className="flex flex-1 flex-col px-6 pb-6 pt-4 sm:flex-none">
          {/* Illustratie */}
          <div
            key={s.key + "-art"}
            className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-[28px] ring-1 max-h-[38vh] ring-line animate-fade-in sm:aspect-[16/10]"
            style={{ backgroundImage: "radial-gradient(120% 100% at 0% 0%, var(--accent-wash), transparent 70%)", backgroundColor: "var(--surface)" }}
          >
            {s.art}
          </div>

          <div key={s.key} className="mt-6 animate-fade-in" aria-live="polite">
            <h2 className="flex items-center gap-2 text-[24px] font-semibold leading-tight tracking-tight">
              {Icon && <Icon size={22} className="shrink-0 text-accent" />}
              {s.title}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
            {s.points && (
              <ul className="mt-4 flex flex-col gap-2.5">
                {s.points.map((p, i) => (
                  <li key={p} className="flex gap-3 text-[14px] text-ink-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold text-ink">{i + 1}</span>
                    <span className="pt-0.5">{p}</span>
                  </li>
                ))}
              </ul>
            )}
            {s.key === "app" && <InstallStep />}
          </div>

          <div className="mt-auto pt-6 sm:mt-8">
            <div className="mb-5 flex justify-center gap-1.5" aria-hidden>
              {STEPS.map((x, i) => (
                <span key={x.key} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-ink" : "w-1.5 bg-grid"}`} />
              ))}
            </div>
            <div className="flex gap-3">
              {step > 0 && (
                <button onClick={prev} className="h-12 rounded-full bg-surface-2 px-5 text-[15px] font-medium text-ink">
                  Terug
                </button>
              )}
              <button onClick={next} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-surface">
                {last ? (hasData ? "Klaar" : "Importeren") : "Volgende"}
                {!last && <ArrowRight size={17} />}
              </button>
            </div>
            {last && !hasData && (
              <button onClick={() => close()} className="mt-3 w-full text-center text-[14px] font-medium text-ink-2">
                Later, eerst rondkijken
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Installeren vanuit de rondleiding: echte knop op Android, uitleg op iPhone. */
function InstallStep() {
  const s = useInstall()
  if (s.standalone || s.installed) return <p className="mt-4 rounded-2xl bg-up-wash px-4 py-3 text-[14px] text-up">De app staat al op je beginscherm.</p>
  if (s.canPrompt)
    return (
      <button onClick={() => promptInstall()} className="mt-4 flex h-11 items-center gap-2 rounded-full bg-accent-wash px-4 text-[14px] font-medium text-accent">
        <Download size={16} /> Zet op beginscherm
      </button>
    )
  if (s.ios)
    return (
      <p className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-[14px] text-ink-2">
        In Safari: tik op <Share size={14} className="inline -translate-y-px" /> en kies &ldquo;Zet op beginscherm&rdquo;. Daarna kun je bij Notificaties pushmeldingen aanzetten.
      </p>
    )
  return <p className="mt-4 text-[14px] text-ink-2">Pushmeldingen en installeren vind je later bij Notificaties en Instellingen.</p>
}

/* ── Illustraties: eenvoudige SVG in de huisstijlkleuren (licht en donker) ── */

function WelcomeArt() {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-mark.png" alt="" className="h-24 w-24 drop-shadow-xl" />
      <div className="rounded-2xl bg-surface px-4 py-2 text-center shadow-sm ring-1 ring-line">
        <p className="text-[11px] text-muted">Totale waarde</p>
        <p className="text-[22px] font-semibold tracking-tight text-ink">€ 48.250</p>
        <p className="text-[12px] font-medium text-up">↗ +€ 412 vandaag</p>
      </div>
    </div>
  )
}

function ImportArt() {
  return (
    <svg viewBox="0 0 320 220" className="h-full w-full max-w-[320px]" aria-hidden>
      <rect x="40" y="40" width="96" height="120" rx="14" fill="var(--surface-2)" stroke="var(--line)" />
      <rect x="56" y="62" width="64" height="8" rx="4" fill="var(--muted)" opacity=".5" />
      {[80, 96, 112, 128].map((y) => (
        <rect key={y} x="56" y={y} width={y % 32 ? 52 : 64} height="6" rx="3" fill="var(--grid)" />
      ))}
      <text x="88" y="182" textAnchor="middle" fontSize="12" fill="var(--ink-2)">CSV</text>
      <path d="M150 100 h38" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M180 90 l12 10 -12 10" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="204" y="52" width="80" height="96" rx="18" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" strokeDasharray="6 5" />
      <circle cx="244" cy="92" r="16" fill="var(--accent-wash)" />
      <path d="M244 100 v-14 M237 92 l7 -7 7 7" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="244" y="130" textAnchor="middle" fontSize="11" fill="var(--ink-2)">sleep hier</text>
    </svg>
  )
}

function CompareArt() {
  const mine = "M20 150 C60 140 80 120 110 118 S160 90 190 80 S250 50 300 40"
  const bench = "M20 150 C60 146 90 132 120 128 S170 112 200 106 S260 92 300 86"
  return (
    <svg viewBox="0 0 320 200" className="h-full w-full max-w-[320px]" aria-hidden>
      {[60, 100, 140].map((y) => (
        <line key={y} x1="20" x2="300" y1={y} y2={y} stroke="var(--grid)" />
      ))}
      <path d={bench} fill="none" stroke="var(--series-2)" strokeWidth="3" strokeLinecap="round" />
      <path d={mine} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="300" cy="40" r="6" fill="var(--accent)" stroke="var(--surface)" strokeWidth="3" />
      <circle cx="300" cy="86" r="6" fill="var(--series-2)" stroke="var(--surface)" strokeWidth="3" />
      <rect x="28" y="20" width="118" height="26" rx="13" fill="var(--up-wash)" />
      <text x="87" y="37" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--up)">▲ beter dan index</text>
    </svg>
  )
}

function TradesArt() {
  const line = "M20 140 L60 120 L90 132 L130 96 L170 104 L210 70 L250 82 L300 50"
  return (
    <svg viewBox="0 0 320 200" className="h-full w-full max-w-[320px]" aria-hidden>
      <path d={`${line} L300 180 L20 180 Z`} fill="var(--accent-wash)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <line x1="20" x2="300" y1="118" y2="118" stroke="var(--muted)" strokeWidth="1.5" />
      <circle cx="60" cy="120" r="7" fill="var(--up)" stroke="var(--surface)" strokeWidth="3" />
      <circle cx="130" cy="96" r="7" fill="var(--up)" stroke="var(--surface)" strokeWidth="3" />
      <circle cx="210" cy="70" r="6" fill="var(--surface)" stroke="var(--up)" strokeWidth="3" />
      <rect x="168" y="20" width="96" height="34" rx="12" fill="var(--surface)" stroke="var(--line)" />
      <text x="216" y="35" textAnchor="middle" fontSize="10" fill="var(--muted)">Verkoop</text>
      <text x="216" y="48" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--up)">+€ 270 · +4,3%</text>
    </svg>
  )
}

function DividendArt() {
  const bars = [30, 52, 40, 22, 46, 70, 54, 34, 58, 26, 62, 50]
  return (
    <svg viewBox="0 0 320 200" className="h-full w-full max-w-[320px]" aria-hidden>
      <line x1="20" x2="300" y1="170" y2="170" stroke="var(--axis)" />
      {bars.map((h, i) => {
        const x = 26 + i * 23
        return <path key={i} d={`M${x},170 V${174 - h - 4} q0,-4 4,-4 h6 q4,0 4,4 V170 Z`} fill="var(--accent)" opacity={i === 5 ? 1 : 0.75} />
      })}
      <rect x="196" y="20" width="104" height="44" rx="12" fill="var(--surface)" stroke="var(--line)" />
      <text x="248" y="37" textAnchor="middle" fontSize="10" fill="var(--muted)">1 januari · box 3</text>
      <text x="248" y="54" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--ink)">€ 50.247</text>
    </svg>
  )
}

function PhoneArt() {
  return (
    <svg viewBox="0 0 320 210" className="h-full w-full max-w-[320px]" aria-hidden>
      <rect x="110" y="14" width="100" height="184" rx="22" fill="var(--ink)" />
      <rect x="116" y="20" width="88" height="172" rx="17" fill="var(--surface)" />
      <image href="/icons/icon-maskable-192x192.png" x="134" y="40" width="22" height="22" />
      <rect x="164" y="40" width="22" height="22" rx="6" fill="var(--surface-2)" />
      <rect x="134" y="70" width="22" height="22" rx="6" fill="var(--surface-2)" />
      <rect x="164" y="70" width="22" height="22" rx="6" fill="var(--surface-2)" />
      <rect x="40" y="112" width="190" height="52" rx="16" fill="var(--surface)" stroke="var(--line)" />
      <circle cx="64" cy="138" r="12" fill="var(--accent-wash)" />
      <path d="M58 142 h12 l-2 -2.5 v-3.5 a4 4 0 0 0 -8 0 v3.5 z" fill="var(--accent)" /><circle cx="64" cy="144.5" r="1.6" fill="var(--accent)" />
      <text x="84" y="134" fontSize="11" fontWeight="600" fill="var(--ink)">ASML boven € 1.400</text>
      <text x="84" y="150" fontSize="10" fill="var(--muted)">Je drempel is bereikt</text>
    </svg>
  )
}
