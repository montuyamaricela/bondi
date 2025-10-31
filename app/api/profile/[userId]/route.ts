import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { handleApiError } from "@/lib/errors"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { userId } = await params

    const profile = await db.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            files: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                url: true,
                key: true,
                name: true,
                createdAt: true,
              },
            },
          },
        },
      },
    })

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    const photos = profile.user.files.map((file) => ({
      id: file.id,
      url: file.url,
      key: file.key,
      name: file.name,
      createdAt: file.createdAt,
    }))

    return NextResponse.json({
      profile: {
        userId: profile.userId,
        name: profile.name,
        age: profile.age,
        bio: profile.bio,
        gender: profile.gender,
        lookingFor: profile.lookingFor,
        relationshipType: profile.relationshipType,
        interests: profile.interests,
        hobbies: profile.hobbies,
        photos,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
