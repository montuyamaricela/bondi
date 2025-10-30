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

    const searchParams = request.nextUrl.searchParams
    const matchId = searchParams.get("matchId")

    if (!matchId) {
      return NextResponse.json(
        { error: "matchId is required" },
        { status: 400 }
      )
    }

    const match = await db.match.findUnique({
      where: { id: matchId },
      select: { user1Id: true, user2Id: true, status: true },
    })

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 })
    }

    if (match.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Match is not active" },
        { status: 403 }
      )
    }

    if (match.user1Id !== session.user.id && match.user2Id !== session.user.id) {
      return NextResponse.json(
        { error: "You are not part of this match" },
        { status: 403 }
      )
    }

    const messages = await db.message.findMany({
      where: { matchId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        matchId: true,
        senderId: true,
        content: true,
        createdAt: true,
        readAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json(messages)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { matchId, content } = body

    if (!matchId || !content) {
      return NextResponse.json(
        { error: "matchId and content are required" },
        { status: 400 }
      )
    }

    if (typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Message content cannot be empty" },
        { status: 400 }
      )
    }

    if (content.length > 5000) {
      return NextResponse.json(
        { error: "Message content is too long (max 5000 characters)" },
        { status: 400 }
      )
    }

    const match = await db.match.findUnique({
      where: { id: matchId },
      select: { user1Id: true, user2Id: true, status: true },
    })

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 })
    }

    if (match.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Match is not active" },
        { status: 403 }
      )
    }

    if (match.user1Id !== session.user.id && match.user2Id !== session.user.id) {
      return NextResponse.json(
        { error: "You are not part of this match" },
        { status: 403 }
      )
    }

    const message = await db.message.create({
      data: {
        matchId,
        senderId: session.user.id,
        content: content.trim(),
      },
      select: {
        id: true,
        matchId: true,
        senderId: true,
        content: true,
        createdAt: true,
        readAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
