import Link from "next/link"
import Image from "next/image"

export const metadata = {
  title: "Gebruiksvoorwaarden — DekkerTracker",
}

export default function VoorwaardenPage() {
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

        <h1 className="text-3xl font-bold text-white mb-2">Gebruiksvoorwaarden</h1>
        <p className="text-sm text-slate-500 mb-10">Laatst bijgewerkt: april 2026</p>

        <div className="space-y-10 text-slate-300 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptatie van de voorwaarden</h2>
            <p>
              Door gebruik te maken van DekkerTracker ga je akkoord met deze gebruiksvoorwaarden.
              Als je niet akkoord gaat, verzoeken wij je geen gebruik te maken van de applicatie.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Beschrijving van de dienst</h2>
            <p>
              DekkerTracker is een persoonlijk beleggingsdashboard voor het bijhouden van
              portefeuilles, het importeren van transacties en het volgen van beurskoersen.
              De applicatie is uitsluitend bedoeld voor informatieve en persoonlijke doeleinden.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Geen financieel advies</h2>
            <p>
              DekkerTracker biedt <span className="text-white font-medium">geen financieel advies</span>.
              Alle informatie binnen de applicatie — waaronder koersen, rendementen en dividenddata —
              is uitsluitend bedoeld als persoonlijk overzicht en mag niet worden beschouwd als
              beleggingsadvies. Neem voor financiële beslissingen altijd contact op met een
              gecertificeerde financieel adviseur.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Nauwkeurigheid van gegevens</h2>
            <p>
              Koersen en andere marktgegevens worden opgehaald via externe bronnen (waaronder
              Yahoo Finance). DekkerTracker kan de nauwkeurigheid, volledigheid of actualiteit
              van deze gegevens niet garanderen. Gebruik de informatie dan ook niet als enige
              basis voor financiële beslissingen.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Jouw account</h2>
            <p>
              Je bent verantwoordelijk voor de beveiliging van je account en wachtwoord. Deel
              je inloggegevens niet met anderen. Bij vermoeden van ongeautoriseerd gebruik van
              je account dien je dit direct te melden via het onderstaande contactadres.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Aansprakelijkheid</h2>
            <p>
              DekkerTracker is niet aansprakelijk voor enige directe of indirecte schade
              die voortvloeit uit het gebruik van de applicatie, het vertrouwen op de
              weergegeven gegevens, of de tijdelijke onbeschikbaarheid van de dienst.
              De applicatie wordt aangeboden "zoals het is" zonder enige garantie.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Beschikbaarheid</h2>
            <p>
              Wij streven naar een zo hoog mogelijke beschikbaarheid van de applicatie, maar
              kunnen dit niet garanderen. Onderhoud, updates of externe storingen kunnen leiden
              tot tijdelijke onbeschikbaarheid.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Intellectueel eigendom</h2>
            <p>
              Alle rechten op de applicatie, het ontwerp en de broncode zijn voorbehouden aan
              DekkerTracker. Het is niet toegestaan de applicatie te kopiëren, distribueren of
              te gebruiken voor commerciële doeleinden zonder uitdrukkelijke schriftelijke
              toestemming.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Wijzigingen</h2>
            <p>
              DekkerTracker behoudt het recht deze gebruiksvoorwaarden op elk moment te
              wijzigen. Bij wezenlijke wijzigingen word je via de applicatie geïnformeerd.
              Voortgezet gebruik na wijziging geldt als acceptatie van de nieuwe voorwaarden.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Toepasselijk recht</h2>
            <p>
              Op deze gebruiksvoorwaarden is Nederlands recht van toepassing. Geschillen worden
              voorgelegd aan de bevoegde rechter in Nederland.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Contact</h2>
            <p>
              Voor vragen over deze gebruiksvoorwaarden kun je contact opnemen via:{" "}
              <a
                href="mailto:careldekker9722rm@gmail.com"
                className="text-lime-400 hover:text-lime-300 transition-colors"
              >
                careldekker9722rm@gmail.com
              </a>
            </p>
          </section>

        </div>

        <div className="mt-14 pt-8 border-t border-[#1a2744] flex items-center justify-between text-xs text-slate-600">
          <span>© {new Date().getFullYear()} DekkerTracker</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-slate-400 transition-colors">
              Privacybeleid
            </Link>
            <Link href="/login" className="text-lime-500 hover:text-lime-400 transition-colors">
              Terug naar inloggen
            </Link>
          </div>
        </div>

      </div>
    </main>
  )
}
