"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { useToast } from "@/components/ui/Toast"
import { Upload, User } from "lucide-react"
import Image from "next/image"

interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState("")
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const { showToast } = useToast()

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push("/login")
        return
      }

      try {
        // First try to get existing profile
        let { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle() // Use maybeSingle instead of single to avoid error on no rows

        // If no profile exists, create one
        if (!data) {
          console.log("No profile found, creating one...")

          const { data: newProfile, error: insertError } = await supabase
            .from("profiles")
            .upsert({
              id: session.user.id,
              full_name: session.user.user_metadata?.full_name || session.user.email,
              avatar_url: session.user.user_metadata?.avatar_url || null
            }, {
              onConflict: 'id'
            })
            .select()
            .single()

          if (insertError) {
            console.error("Error creating profile:", insertError)
            throw insertError
          }

          data = newProfile
          console.log("Profile created:", data)
        }

        if (data) {
          setProfile({
            id: data.id,
            email: session.user.email || "",
            full_name: data.full_name,
            avatar_url: data.avatar_url
          })
          setFullName(data.full_name || "")
        }
      } catch (error) {
        console.error("Error loading profile:", error)
        showToast("Error loading profile", "error")
      }

      setLoading(false)
    }

    loadProfile()
  }, [router])

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true)

      if (!event.target.files || event.target.files.length === 0) {
        return
      }

      const file = event.target.files[0]
      const fileExt = file.name.split(".").pop()
      const fileName = `${profile?.id}.${fileExt}`
      const filePath = `${profile?.id}/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath)

      // Update or insert profile
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error("No session")

      const { error: updateError } = await supabase
        .from("profiles")
        .upsert({
          id: session.user.id,
          avatar_url: publicUrl
        }, {
          onConflict: 'id'
        })

      if (updateError) {
        throw updateError
      }

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null)
      showToast("Profielfoto bijgewerkt!", "success")
    } catch (error) {
      showToast("Error uploading avatar", "error")
    } finally {
      setUploading(false)
    }
  }

  async function handleSaveProfile() {
    try {
      setSaving(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error("No session")

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: session.user.id,
          full_name: fullName
        }, {
          onConflict: 'id'
        })

      if (error) throw error

      showToast("Profiel opgeslagen!", "success")
      setProfile(prev => prev ? { ...prev, full_name: fullName } : null)
    } catch (error) {
      showToast("Error saving profile", "error")
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <p className="text-center text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-8 py-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Instellingen</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Beheer je profiel en voorkeuren
        </p>
      </div>

      <div className="p-8">
        <div className="max-w-2xl bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-8">
          {/* Avatar Section */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 dark:text-slate-100">Profielfoto</h2>
            <div className="flex items-center gap-6">
              <div className="relative w-24 h-24 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                {profile?.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt="Profile"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <User className="w-12 h-12 text-slate-400 dark:text-slate-500" />
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="avatar-upload">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={uploading}
                    onClick={() => document.getElementById("avatar-upload")?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? "Uploading..." : "Upload foto"}
                  </Button>
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  JPG, PNG of GIF. Max 5MB.
                </p>
              </div>
            </div>
          </div>

          {/* Profile Info */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                E-mailadres
              </label>
              <Input
                type="email"
                value={profile?.email || ""}
                disabled
                className="bg-slate-50 dark:bg-slate-900"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Je e-mailadres kan niet worden gewijzigd
              </p>
            </div>

            <div>
              <Input
                label="Volledige naam"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Je naam"
              />
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={saving}
              variant="primary"
            >
              {saving ? "Opslaan..." : "Opslaan"}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

