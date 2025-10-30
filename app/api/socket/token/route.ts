import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the session token from cookies
    const cookies = request.headers.get("cookie") || ""
    const sessionToken = cookies
      .split("; ")
      .find((c) => c.startsWith("better-auth.session_token="))
      ?.split("=")[1]

    if (!sessionToken) {
      return NextResponse.json({ error: "No session token found" }, { status: 401 })
    }

    // Return the token for Socket.IO authentication
    return NextResponse.json({ token: sessionToken })
  } catch (error) {
    console.error("Error getting socket token:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
