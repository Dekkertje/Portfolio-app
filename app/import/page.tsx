import { redirect } from "next/navigation"

// De oude import schreef naar de legacy transactions-tabel; alles loopt nu via het grootboek
export default function OldImportPage() {
  redirect("/importeren")
}
