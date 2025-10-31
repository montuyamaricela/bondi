import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { db } from '@/lib/db';
import { profileSetupSchema } from '@/app/components/features/auth/validation';
import { profileEditSchema } from '@/app/components/features/profile/validation';
import { handleApiError } from '@/lib/errors';
import { getProfileByUserId } from '@/lib/server/profile';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(request.headers);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfileByUserId(session.user.id);

    return NextResponse.json({ profile: profile || null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(request.headers);

    console.log('session', session);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const result = profileSetupSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
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
      genderPreference,
    } = result.data;

    const existingProfile = await db.profile.findUnique({
      where: { userId: session.user.id },
    });

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Profile already exists' },
        { status: 400 }
      );
    }

    if (name !== session.user.name) {
      await db.user.update({
        where: { id: session.user.id },
        data: { name },
      });
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
    });

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
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(request.headers);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const result = profileEditSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const existingProfile = await db.profile.findUnique({
      where: { userId: session.user.id },
    });

    if (!existingProfile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
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
      genderPreference,
      photoKeys,
    } = result.data;

    if (name !== session.user.name) {
      await db.user.update({
        where: { id: session.user.id },
        data: { name },
      });
    }

    const updatedProfile = await db.profile.update({
      where: { userId: session.user.id },
      data: {
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
    });

    if (photoKeys && photoKeys.length > 0) {
      await Promise.all(
        photoKeys.map((key, index) =>
          db.file.updateMany({
            where: {
              userId: session.user.id,
              key,
            },
            data: {
              order: index,
            },
          })
        )
      );
    }

    const photos = await db.file.findMany({
      where: { userId: session.user.id },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({
      success: true,
      profile: {
        ...updatedProfile,
        photos,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
