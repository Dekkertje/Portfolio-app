import Link from "next/link"
import Image from "next/image"

export const metadata = {
  title: "Privacybeleid — DekkerTracker",
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#060d1a] text-white">
      <div className="mx-auto max-w-3xl px-6 py-16">

        {/* Logo */}
        <div className="mb-12">
          <Link href="/login">
            <Image
              src="/images/dekkertracker-logo.png"
              alt="DekkerTracker"
              width={240}
              height={64}
              priority
            />
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Privacybeleid</h1>
        <p className="text-sm text-slate-500 mb-10">Laatst bijgewerkt: april 2026</p>

        <div className="space-y-10 text-slate-300 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Over DekkerTracker</h2>
            <p>
              DekkerTracker is een persoonlijk beleggingsdashboard waarmee je je portefeuille kunt
              bijhouden, transacties kunt importeren en koersen kunt volgen. De applicatie is
              uitsluitend bedoeld voor persoonlijk gebruik.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Welke gegevens worden verwerkt?</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><span className="text-white font-medium">Accountgegevens:</span> e-mailadres en naam (via e-mail/wachtwoord of Google-login).</li>
              <li><span className="text-white font-medium">Portefeuillegegevens:</span> transacties, posities en dividendinformatie die je zelf invoert of importeert.</li>
              <li><span className="text-white font-medium">Technische gegevens:</span> de applicatie slaat sessie-informatie op in je browser (localStorage) om je ingelogd te houden.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Hoe worden je gegevens opgeslagen?</h2>
            <p>
              Alle gegevens worden opgeslagen via <span className="text-white">Supabase</span>, een
              beveiligde cloudplatform met end-to-end encryptie en Row Level Security (RLS). Dit
              betekent dat jij als enige toegang hebt tot jouw eigen gegevens — andere gebruikers
              kunnen deze niet inzien.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Worden gegevens gedeeld met derden?</h2>
            <p>
              Nee. Je gegevens worden niet verkocht, verhuurd of gedeeld met derden voor
              commerciële doeleinden. De applicatie maakt gebruik van de volgende externe diensten
              uitsluitend voor haar technische werking:
            </p>
            <ul className="mt-3 list-disc list-inside space-y-2">
              <li><span className="text-white font-medium">Supabase</span> — authenticatie en database.</li>
              <li><span className="text-white font-medium">Yahoo Finance</span> — ophalen van beurskoersen (er worden geen persoonsgegevens doorgestuurd).</li>
              <li><span className="text-white font-medium">Google OAuth</span> — optionele inlogmethode via je Google-account.</li>
              <li><span className="text-white font-medium">Vercel</span> — hosting van de applicatie.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Hoe lang worden gegevens bewaard?</h2>
            <p>
              Je gegevens worden bewaard zolang je account actief is. Je kunt op elk moment je
              account en alle bijbehorende gegevens laten verwijderen door contact op te nemen via
              het onderstaande e-mailadres.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Jouw rechten</h2>
            <p>Op basis van de AVG (GDPR) heb je het recht om:</p>
            <ul className="mt-3 list-disc list-inside space-y-2">
              <li>inzage te vragen in de gegevens die over jou zijn opgeslagen,</li>
              <li>onjuiste gegevens te laten corrigeren,</li>
              <li>je gegevens te laten verwijderen ("recht op vergetelheid"),</li>
              <li>bezwaar te maken tegen de verwerking van je gegevens.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Contact</h2>
            <p>
              Voor vragen over dit privacybeleid of verzoeken met betrekking tot je gegevens kun
              je contact opnemen via:{" "}
              <a
                href="mailto:careldekker9722rm@gmail.com"
                className="text-lime-400 hover:text-lime-300 transition-colors"
              >
                careldekker9722rm@gmail.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Wijzigingen</h2>
            <p>
              Dit privacybeleid kan worden bijgewerkt. Bij wezenlijke wijzigingen wordt je via de
              applicatie geïnformeerd. De meest actuele versie is altijd beschikbaar op deze pagina.
            </p>
          </section>

        </div>

        <div className="mt-14 pt-8 border-t border-[#1a2744] flex items-center justify-between text-xs text-slate-600">
          <span>© {new Date().getFullYear()} DekkerTracker</span>
          <Link href="/login" className="text-lime-500 hover:text-lime-400 transition-colors">
            Terug naar inloggen
          </Link>
        </div>

      </div>
    </main>
  )
}
