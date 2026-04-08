"use client"

import { createContext, useContext, useState, useEffect } from "react"

type PrivacyContextType = {
  privacyMode: boolean
  togglePrivacyMode: () => void
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined)

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [privacyMode, setPrivacyMode] = useState(false)

  useEffect(() => {
    // Check localStorage for saved privacy preference
    const savedPrivacy = localStorage.getItem("privacyMode")
    if (savedPrivacy === "true") {
      setPrivacyMode(true)
    }
  }, [])

  const togglePrivacyMode = () => {
    const newMode = !privacyMode
    setPrivacyMode(newMode)
    localStorage.setItem("privacyMode", newMode.toString())
  }

  return (
    <PrivacyContext.Provider value={{ privacyMode, togglePrivacyMode }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  const context = useContext(PrivacyContext)
  if (context === undefined) {
    throw new Error("usePrivacy must be used within a PrivacyProvider")
  }
  return context
}
