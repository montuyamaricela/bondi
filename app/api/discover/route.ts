import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/session"
import { db } from "@/lib/db"
import { handleApiError, createAppError } from "@/lib/errors"
import { likeActionSchema } from "@/app/components/features/discover/validation"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(request.headers)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const minAge = searchParams.get("minAge")
    const maxAge = searchParams.get("maxAge")
    const distance = searchParams.get("distance")
    const genderPreference = searchParams.get("genderPreference")

    const currentUserId = session.user.id

    const currentUserProfile = await db.profile.findUnique({
      where: { userId: currentUserId },
    })

    if (!currentUserProfile) {
      return NextResponse.json(
        { error: "Profile not found. Please complete your profile first." },
        { status: 404 }
      )
    }

    const alreadyInteractedWith = await db.like.findMany({
      where: { userId: currentUserId },
      select: { targetUserId: true },
    })

    const interactedUserIds = alreadyInteractedWith.map((like) => like.targetUserId)

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

    const excludedIds = [
      ...new Set([...interactedUserIds, ...matchedIds, currentUserId]),
    ]

    const ageFilter =
      minAge && maxAge
        ? {
            age: {
              gte: parseInt(minAge),
              lte: parseInt(maxAge),
            },
          }
        : {}

    const genderFilter =
      genderPreference && genderPreference !== "EVERYONE"
        ? { gender: genderPreference as "MALE" | "FEMALE" }
        : {}

    const profiles = await db.profile.findMany({
      where: {
        userId: {
          notIn: excludedIds,
        },
        ...ageFilter,
        ...genderFilter,
      },
      include: {
        user: {
          include: {
            files: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        },
      },
      take: 10,
      orderBy: {
        createdAt: "desc",
      },
    })

    const discoverableProfiles = profiles.map((profile) => ({
      id: profile.id,
      userId: profile.userId,
      name: profile.name,
      age: profile.age,
      bio: profile.bio,
      gender: profile.gender,
      location: profile.location,
      interests: profile.interests,
      hobbies: profile.hobbies,
      lookingFor: profile.lookingFor,
      relationshipType: profile.relationshipType,
      photos: profile.user.files.map((file) => ({
        id: file.id,
        url: file.url,
        key: file.key,
      })),
    }))

    return NextResponse.json(discoverableProfiles)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(request.headers)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    const validationResult = likeActionSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.issues,
        },
        { status: 400 }
      )
    }

    const { targetUserId, action } = validationResult.data
    const currentUserId = session.user.id

    if (currentUserId === targetUserId) {
      throw createAppError("Cannot interact with your own profile", 400)
    }

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      include: { profile: true },
    })

    if (!targetUser || !targetUser.profile) {
      throw createAppError("Target user not found", 404)
    }

    const existingLike = await db.like.findUnique({
      where: {
        userId_targetUserId: {
          userId: currentUserId,
          targetUserId,
        },
      },
    })

    if (existingLike) {
      return NextResponse.json(
        { error: "You have already interacted with this profile" },
        { status: 400 }
      )
    }

    await db.like.create({
      data: {
        userId: currentUserId,
        targetUserId,
        action,
      },
    })

    if (action === "LIKE") {
      const mutualLike = await db.like.findFirst({
        where: {
          userId: targetUserId,
          targetUserId: currentUserId,
          action: "LIKE",
        },
      })

      if (mutualLike) {
        const existingMatch = await db.match.findFirst({
          where: {
            OR: [
              { user1Id: currentUserId, user2Id: targetUserId },
              { user1Id: targetUserId, user2Id: currentUserId },
            ],
          },
        })

        if (!existingMatch) {
          const match = await db.match.create({
            data: {
              user1Id: currentUserId,
              user2Id: targetUserId,
              status: "ACTIVE",
            },
          })

          const currentUserProfile = await db.profile.findUnique({
            where: { userId: currentUserId },
          })

          const currentUserPhoto = await db.file.findFirst({
            where: { userId: currentUserId },
            orderBy: { createdAt: "asc" },
          })

          const targetUserPhoto = await db.file.findFirst({
            where: { userId: targetUserId },
            orderBy: { createdAt: "asc" },
          })

          return NextResponse.json({
            matched: true,
            matchId: match.id,
            matchedUser: {
              id: targetUser.id,
              name: targetUser.profile.name,
              photo: targetUserPhoto?.url || null,
            },
            currentUser: {
              id: currentUserId,
              name: currentUserProfile?.name || "",
              photo: currentUserPhoto?.url || null,
            },
          })
        }
      }
    }

    return NextResponse.json({ matched: false })
  } catch (error) {
    return handleApiError(error)
  }
}
