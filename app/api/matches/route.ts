import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { handleApiError } from "@/lib/errors"

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    const matches = await db.match.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
        status: "ACTIVE",
      },
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
                bio: true,
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
                bio: true,
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
      orderBy: { matchedAt: "desc" },
    })

    const matchesData = matches.map((match) => {
      const otherUser = match.user1Id === userId ? match.user2 : match.user1
      return {
        matchId: match.id,
        matchedAt: match.matchedAt,
        user: {
          id: otherUser.id,
          name: otherUser.profile?.name || otherUser.name || "Unknown",
          age: otherUser.profile?.age,
          bio: otherUser.profile?.bio,
          image: otherUser.files[0]?.url || otherUser.image || "https://via.placeholder.com/400",
        },
      }
    })

    return NextResponse.json(matchesData)
  } catch (error) {
    return handleApiError(error)
  }
}
