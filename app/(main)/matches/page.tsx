import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getServerSession } from "@/lib/session"
import { MatchesList } from "@/app/components/features/matching/components/MatchesList"

export default async function MatchesPage() {
  const headersList = await headers()
  const session = await getServerSession(headersList)

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-heading">Your Matches</h1>
      </div>

      <MatchesList />
    </div>
  )
}
