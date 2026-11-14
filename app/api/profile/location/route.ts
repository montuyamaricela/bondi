import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';
import { handleApiError, readJson } from '@/lib/errors';

const locationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await readJson(request);
    const validated = locationUpdateSchema.parse(body);

    const profile = await db.profile.update({
      where: { userId: session.user.id },
      data: {
        latitude: validated.latitude,
        longitude: validated.longitude,
        lastLocationUpdate: new Date(),
      },
      select: {
        latitude: true,
        longitude: true,
        lastLocationUpdate: true,
      },
    });

    return NextResponse.json(profile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid location data', details: error.issues },
        { status: 400 },
      );
    }

    return handleApiError(error);
  }
}
