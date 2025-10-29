import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { db } from '@/lib/db';
import { profileSetupSchema } from '@/app/components/features/auth/validation';
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
