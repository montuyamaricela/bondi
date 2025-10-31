import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { handleApiError } from "@/lib/errors"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { matchId } = await params

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        user1: {
          select: {
            id: true,
            name: true,
            image: true,
            profile: {
              select: {
                name: true,
                age: true,
              },
            },
            files: {
              take: 1,
              orderBy: { createdAt: "asc" },
              select: {
                url: true,
              },
            },
          },
        },
        user2: {
          select: {
            id: true,
            name: true,
            image: true,
            profile: {
              select: {
                name: true,
                age: true,
              },
            },
            files: {
              take: 1,
              orderBy: { createdAt: "asc" },
              select: {
                url: true,
              },
            },
          },
        },
      },
    })

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 })
    }

    if (match.user1Id !== session.user.id && match.user2Id !== session.user.id) {
      return NextResponse.json(
        { error: "Not authorized to view this match" },
        { status: 403 }
      )
    }

    const otherUser = match.user1Id === session.user.id ? match.user2 : match.user1

    return NextResponse.json({
      matchId: match.id,
      matchedAt: match.matchedAt,
      status: match.status,
      otherUser: {
        id: otherUser.id,
        name: otherUser.profile?.name || otherUser.name || "Unknown",
        age: otherUser.profile?.age || null,
        image: otherUser.files[0]?.url || otherUser.image || null,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
