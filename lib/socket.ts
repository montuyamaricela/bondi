import { Server as NetServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export type ServerToClientEvents = {
  "message:new": (message: {
    id: string
    matchId: string
    senderId: string
    content: string
    createdAt: string
  }) => void
  "message:read": (data: { messageId: string; readAt: string }) => void
  "typing:start": (data: { userId: string; matchId: string }) => void
  "typing:stop": (data: { userId: string; matchId: string }) => void
  "user:online": (data: { userId: string }) => void
  "user:offline": (data: { userId: string }) => void
}

export type ClientToServerEvents = {
  "message:send": (data: { matchId: string; content: string }) => void
  "message:read": (data: { messageId: string }) => void
  "typing:start": (data: { matchId: string }) => void
  "typing:stop": (data: { matchId: string }) => void
  "match:join": (data: { matchId: string }) => void
  "match:leave": (data: { matchId: string }) => void
}

export type InterServerEvents = Record<string, never>

export type SocketData = {
  userId: string
  sessionId: string
}

export type SocketServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

export function initializeSocket(httpServer: NetServer): SocketServer {
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  })

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token

      if (!token) {
        return next(new Error("Authentication required"))
      }

      const session = await auth.api.getSession({
        headers: {
          authorization: `Bearer ${token}`,
          cookie: `better-auth.session_token=${token}`,
        },
      })

      if (!session?.user) {
        return next(new Error("Invalid session"))
      }

      socket.data.userId = session.user.id
      socket.data.sessionId = token

      next()
    } catch (error) {
      console.error("Socket authentication error:", error)
      next(new Error("Authentication failed"))
    }
  })

  io.on("connection", (socket) => {
    const userId = socket.data.userId

    console.log(`User connected: ${userId}`)

    socket.broadcast.emit("user:online", { userId })

    socket.on("match:join", async ({ matchId }) => {
      try {
        const match = await db.match.findUnique({
          where: { id: matchId },
          select: { user1Id: true, user2Id: true, status: true },
        })

        if (!match) {
          return
        }

        if (match.status !== "ACTIVE") {
          return
        }

        if (match.user1Id !== userId && match.user2Id !== userId) {
          return
        }

        socket.join(`match:${matchId}`)
        console.log(`User ${userId} joined match room: ${matchId}`)
      } catch (error) {
        console.error("Error joining match room:", error)
      }
    })

    socket.on("match:leave", ({ matchId }) => {
      socket.leave(`match:${matchId}`)
      console.log(`User ${userId} left match room: ${matchId}`)
    })

    socket.on("message:send", async ({ matchId, content }) => {
      try {
        const match = await db.match.findUnique({
          where: { id: matchId },
          select: { user1Id: true, user2Id: true, status: true },
        })

        if (!match || match.status !== "ACTIVE") {
          return
        }

        if (match.user1Id !== userId && match.user2Id !== userId) {
          return
        }

        const message = await db.message.create({
          data: {
            matchId,
            senderId: userId,
            content,
          },
          select: {
            id: true,
            matchId: true,
            senderId: true,
            content: true,
            createdAt: true,
          },
        })

        io.to(`match:${matchId}`).emit("message:new", {
          id: message.id,
          matchId: message.matchId,
          senderId: message.senderId,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
        })

        console.log(`Message sent in match ${matchId} by user ${userId}`)
      } catch (error) {
        console.error("Error sending message:", error)
      }
    })

    socket.on("message:read", async ({ messageId }) => {
      try {
        const message = await db.message.findUnique({
          where: { id: messageId },
          select: {
            id: true,
            matchId: true,
            senderId: true,
            readAt: true,
            match: {
              select: { user1Id: true, user2Id: true },
            },
          },
        })

        if (!message) {
          return
        }

        if (message.match.user1Id !== userId && message.match.user2Id !== userId) {
          return
        }

        if (message.senderId === userId) {
          return
        }

        if (message.readAt) {
          return
        }

        const updatedMessage = await db.message.update({
          where: { id: messageId },
          data: { readAt: new Date() },
          select: { id: true, readAt: true },
        })

        io.to(`match:${message.matchId}`).emit("message:read", {
          messageId: updatedMessage.id,
          readAt: updatedMessage.readAt!.toISOString(),
        })

        console.log(`Message ${messageId} marked as read by user ${userId}`)
      } catch (error) {
        console.error("Error marking message as read:", error)
      }
    })

    socket.on("typing:start", ({ matchId }) => {
      socket.to(`match:${matchId}`).emit("typing:start", { userId, matchId })
    })

    socket.on("typing:stop", ({ matchId }) => {
      socket.to(`match:${matchId}`).emit("typing:stop", { userId, matchId })
    })

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${userId}`)
      socket.broadcast.emit("user:offline", { userId })
    })
  })

  return io
}
