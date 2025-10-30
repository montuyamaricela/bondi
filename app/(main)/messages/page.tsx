import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { MessageCircle } from "lucide-react"
import { getServerSession } from "@/lib/session"
import { ConversationList } from "./ConversationList"

export default async function MessagesPage() {
  const headersList = await headers()
  const session = await getServerSession(headersList)

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Left Sidebar - Conversation List */}
      <div className="w-96 border-r border-border-main bg-bg-card flex flex-col">
        <div className="p-4 border-b border-border-main">
          <h1 className="text-2xl font-bold text-text-heading">Messages</h1>
          <p className="text-text-muted text-sm mt-1">
            Chat with your matches
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ConversationList currentUserId={session.user.id} />
        </div>
      </div>

      {/* Right Side - Empty State (Select a conversation) */}
      <div className="flex-1 flex items-center justify-center bg-bg-main">
        <div className="text-center px-4">
          <MessageCircle className="w-24 h-24 text-text-muted mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-text-heading mb-2">
            Select a conversation
          </h2>
          <p className="text-text-muted max-w-sm mx-auto">
            Choose a conversation from the list to start chatting
          </p>
        </div>
      </div>
    </div>
  )
}
