/** De 11 sectoren zoals Yahoo/Morningstar ze indelen, met Nederlandse namen. Gedeeld door server en browser. */

export const SECTORS = [
  { key: "technology", label: "Technologie" },
  { key: "financial_services", label: "Financiële diensten" },
  { key: "healthcare", label: "Gezondheidszorg" },
  { key: "consumer_cyclical", label: "Cyclische consumptie" },
  { key: "communication_services", label: "Communicatie" },
  { key: "industrials", label: "Industrie" },
  { key: "consumer_defensive", label: "Basisconsumptie" },
  { key: "energy", label: "Energie" },
  { key: "basic_materials", label: "Grondstoffen" },
  { key: "realestate", label: "Vastgoed" },
  { key: "utilities", label: "Nutsbedrijven" },
] as const

export type SectorKey = (typeof SECTORS)[number]["key"]
export type SectorWeights = Partial<Record<SectorKey, number>>

const BY_NAME: Record<string, SectorKey> = {
  technology: "technology",
  "financial services": "financial_services",
  financial: "financial_services",
  healthcare: "healthcare",
  "consumer cyclical": "consumer_cyclical",
  "communication services": "communication_services",
  industrials: "industrials",
  "consumer defensive": "consumer_defensive",
  energy: "energy",
  "basic materials": "basic_materials",
  "real estate": "realestate",
  realestate: "realestate",
  utilities: "utilities",
}

/** "Financial Services" (assetProfile) of "financial_services" (topHoldings) → sleutel */
export function sectorKey(name: string | null | undefined): SectorKey | null {
  if (!name) return null
  const n = name.trim().toLowerCase().replace(/_/g, " ")
  return BY_NAME[n] ?? BY_NAME[n.replace(/ /g, "")] ?? null
}

export const sectorLabel = (key: string) => SECTORS.find((s) => s.key === key)?.label ?? key
