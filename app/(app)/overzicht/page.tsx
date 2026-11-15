"use client"

import { OverviewView } from "@/components/v2/OverviewView"
import { usePortfolio } from "@/components/v2/usePortfolio"

export default function OverzichtPage() {
  return <OverviewView {...usePortfolio()} />
}
