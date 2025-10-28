import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { profileSetupSchema } from "@/app/components/features/auth/validation"
import { handleApiError } from "@/lib/errors"

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    const result = profileSetupSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      )
    }

    const {
      name,
      age,
      bio,
      gender,
      location,
      interests,
      hobbies,
      lookingFor,
      relationshipType,
      genderPreference
    } = result.data

    const existingProfile = await db.profile.findUnique({
      where: { userId: session.user.id },
    })

    if (existingProfile) {
      return NextResponse.json({ error: "Profile already exists" }, { status: 400 })
    }

    if (name !== session.user.name) {
      await db.user.update({
        where: { id: session.user.id },
        data: { name },
      })
    }

    const profile = await db.profile.create({
      data: {
        userId: session.user.id,
        name,
        age,
        bio,
        gender,
        location,
        interests,
        hobbies,
        lookingFor,
        relationshipType,
        genderPreference,
      },
    })

    return NextResponse.json(
      {
        success: true,
        profile: {
          id: profile.id,
          name: profile.name,
          age: profile.age,
          bio: profile.bio,
          gender: profile.gender,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
