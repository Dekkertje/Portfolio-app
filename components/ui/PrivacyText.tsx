"use client"

import { usePrivacy } from "@/contexts/PrivacyContext"
import { ReactNode } from "react"

type PrivacyTextProps = {
  children: ReactNode
  className?: string
}

export function PrivacyText({ children, className = "" }: PrivacyTextProps) {
  const { privacyMode } = usePrivacy()

  return (
    <span className={`${privacyMode ? "privacy-blur" : ""} ${className}`}>
      {children}
    </span>
  )
}
