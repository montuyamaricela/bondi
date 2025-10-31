import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { handleApiError } from "@/lib/errors"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { matchId } = await params
    const userId = session.user.id

    const match = await db.match.findUnique({
      where: { id: matchId },
      select: { user1Id: true, user2Id: true, status: true },
    })

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 })
    }

    if (match.user1Id !== userId && match.user2Id !== userId) {
      return NextResponse.json(
        { error: "Not authorized to unmatch this user" },
        { status: 403 }
      )
    }

    if (match.status === "UNMATCHED") {
      return NextResponse.json(
        { error: "Match is already unmatched" },
        { status: 400 }
      )
    }

    const updatedMatch = await db.match.update({
      where: { id: matchId },
      data: { status: "UNMATCHED" },
    })

    return NextResponse.json({
      success: true,
      matchId: updatedMatch.id,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
