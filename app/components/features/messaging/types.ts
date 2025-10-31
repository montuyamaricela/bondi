export interface Message {
  id: string
  matchId: string
  senderId: string
  content: string
  createdAt: string | Date
  readAt: string | Date | null
  sender?: {
    id: string
    name: string | null
    image: string | null
  }
}

export interface Conversation {
  matchId: string
  matchedAt: string | Date
  status: "ACTIVE" | "UNMATCHED"
  otherUser: {
    id: string
    userId: string
    name: string
    age: number | null
    image: string | null
    showOnlineStatus: boolean
  }
  lastMessage: {
    id: string
    content: string
    senderId: string
    createdAt: string | Date
    readAt: string | Date | null
  } | null
  unreadCount: number
}

export interface SendMessageData {
  matchId: string
  content: string
}

export interface TypingUser {
  userId: string
  matchId: string
}
