/** Herkent welk DEGIRO-bestand iemand aanlevert, aan de kopregel. Werkt in browser en server. */
export type DegiroFileKind = "transactions" | "account"

export function detectDegiroFile(text: string): DegiroFileKind | null {
  const header = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? ""
  if (/^(Datum|Date),/i.test(header) && /ISIN/i.test(header)) {
    if (/(Omschrijving|Description)/i.test(header)) return "account"
    if (/(Beurs|Reference exchange|Exchange)/i.test(header)) return "transactions"
  }
  return null
}
