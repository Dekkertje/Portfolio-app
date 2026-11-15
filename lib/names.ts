/** Leesbare effectnamen: DEGIRO levert ze in hoofdletters met juridische toevoegingen. */

function titleCase(name: string) {
  // DEGIRO levert namen in hoofdletters; leesbaarder in gewone schrijfwijze
  if (name !== name.toUpperCase()) return name
  return name
    .toLowerCase()
    .replace(/(^|[\s.&-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase())
    .replace(/\b(Etf|Ucits|Usd|Eur|Asml|Msci|Ftse|Abn|Amro|Ing|Sofi|Amd)\b/g, (m) => m.toUpperCase())
}

export function displayName(name: string) {
  return titleCase(name).replace(/,? (INC\.?|CORPORATION|CORP\.?|N\.V\.|HOLDINGS?)( CLASS [A-C])?$/i, "").replace(/ CLASS [A-C]$/i, "")
}
