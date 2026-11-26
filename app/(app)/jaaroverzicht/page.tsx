"use client"

import { usePortfolio } from "@/components/v2/usePortfolio"
import { YearsView } from "@/components/v2/YearsView"

export default function JaaroverzichtPage() {
  return <YearsView {...usePortfolio()} />
}
