import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/session"
import { db } from "@/lib/db"
import { handleApiError } from "@/lib/errors"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(request.headers)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const currentUserId = session.user.id

    const matchedUserIds = await db.match.findMany({
      where: {
        OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
        status: "ACTIVE",
      },
      select: { user1Id: true, user2Id: true },
    })

    const matchedIds = matchedUserIds.flatMap((match) => [
      match.user1Id,
      match.user2Id,
    ])

    const likes = await db.like.findMany({
      where: {
        targetUserId: currentUserId,
        action: "LIKE",
        userId: {
          notIn: matchedIds,
        },
      },
      include: {
        user: {
          include: {
            profile: true,
            files: {
              orderBy: {
                order: "asc",
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const likedByUsers = likes.map((like) => ({
      id: like.user.profile?.id,
      userId: like.userId,
      name: like.user.profile?.name || "Unknown",
      age: like.user.profile?.age,
      bio: like.user.profile?.bio,
      gender: like.user.profile?.gender,
      location: like.user.profile?.location,
      interests: like.user.profile?.interests || [],
      hobbies: like.user.profile?.hobbies || [],
      lookingFor: like.user.profile?.lookingFor,
      relationshipType: like.user.profile?.relationshipType,
      photos: like.user.files.map((file) => ({
        id: file.id,
        url: file.url,
        key: file.key,
      })),
      likedAt: like.createdAt,
    }))

    return NextResponse.json(likedByUsers)
  } catch (error) {
    return handleApiError(error)
  }
}
