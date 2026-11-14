import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { profileSetupSchema } from '@/app/components/features/auth/validation';
import { profileEditSchema } from '@/app/components/features/profile/validation';
import { handleApiError } from '@/lib/errors';
import { getProfileByUserId, createProfile, updateProfile } from '@/lib/server/profile';

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

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

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
        { status: 400 },
      );
    }

    const profile = await createProfile(session.user.id, result.data);

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
      { status: 201 },
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

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
        { status: 400 },
      );
    }

    const profile = await updateProfile(session.user.id, result.data);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return handleApiError(error);
  }
}
