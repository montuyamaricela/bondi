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
                showOnlineStatus: true,
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
                showOnlineStatus: true,
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
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            content: true,
            senderId: true,
            createdAt: true,
            readAt: true,
          },
        },
      },
      orderBy: { matchedAt: "desc" },
    })

    const conversations = matches.map((match) => {
      const otherUser = match.user1Id === userId ? match.user2 : match.user1
      const lastMessage = match.messages[0] || null

      const unreadCount = lastMessage && !lastMessage.readAt && lastMessage.senderId !== userId ? 1 : 0

      return {
        matchId: match.id,
        matchedAt: match.matchedAt,
        status: match.status,
        otherUser: {
          id: otherUser.id,
          userId: otherUser.id,
          name: otherUser.profile?.name || otherUser.name || "Unknown",
          age: otherUser.profile?.age || null,
          image: otherUser.files[0]?.url || otherUser.image || null,
          showOnlineStatus: otherUser.profile?.showOnlineStatus ?? true,
        },
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              createdAt: lastMessage.createdAt,
              readAt: lastMessage.readAt,
            }
          : null,
        unreadCount,
      }
    })

    conversations.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt || a.matchedAt
      const bTime = b.lastMessage?.createdAt || b.matchedAt
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })

    return NextResponse.json(conversations)
  } catch (error) {
    return handleApiError(error)
  }
}
