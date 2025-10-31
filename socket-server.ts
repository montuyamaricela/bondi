import { createServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { setSocketInstance } from "@/lib/socket-instance"
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@/lib/socket"

const port = parseInt(process.env.SOCKET_PORT || "3001", 10)
const clientUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

const httpServer = createServer()

const io = new SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: clientUrl,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

setSocketInstance(io)

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

io.on("connection", async (socket) => {
  const userId = socket.data.userId

  console.log(`User connected: ${userId}`)

  const profile = await db.profile.findUnique({
    where: { userId },
    select: { showOnlineStatus: true },
  })

  if (profile?.showOnlineStatus) {
    socket.broadcast.emit("user:online", { userId })
  }

  socket.join(`user:${userId}`)

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

      const receiverId = match.user1Id === userId ? match.user2Id : match.user1Id

      const senderProfile = await db.profile.findUnique({
        where: { userId },
        select: { name: true },
      })

      await db.notification.create({
        data: {
          userId: receiverId,
          title: "New Message",
          content: `${senderProfile?.name || "Someone"} sent you a message: ${content.substring(0, 50)}${content.length > 50 ? "..." : ""}`,
          type: "MESSAGE",
          entityId: matchId,
          actionUrl: `/messages/${matchId}`,
          isRead: false,
        },
      })

      io.to(`user:${receiverId}`).emit("notification:new", {
        type: "MESSAGE",
        matchId,
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

  socket.on("disconnect", async () => {
    console.log(`User disconnected: ${userId}`)

    const profile = await db.profile.findUnique({
      where: { userId },
      select: { showOnlineStatus: true },
    })

    if (profile?.showOnlineStatus) {
      socket.broadcast.emit("user:offline", { userId })
    }
  })
})

httpServer
  .once("error", (err) => {
    console.error(err)
    process.exit(1)
  })
  .listen(port, () => {
    console.log(`> Socket.IO server listening on port ${port}`)
  })
