import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';
import { handleApiError, readJson } from '@/lib/errors';
import { updateLocation } from '@/lib/server/location';
import { notifyPresenceChange } from '@/lib/server/native-presence';
import { createAppError } from '@/lib/app-error';

const privacyUpdateSchema = z.object({
  showOnlineStatus: z.boolean().optional(),
  showDistance: z.boolean().optional(),
  showCity: z.boolean().optional(),
  expectedUserId: z.string().min(1).max(128).optional(),
  expectedSessionId: z.string().min(1).max(128).optional(),
  expectedRevision: z.number().int().min(0).max(2_147_483_647).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await readJson(request);
    const validated = privacyUpdateSchema.parse(body);
    if (
      (validated.expectedUserId !== undefined && validated.expectedUserId !== session.user.id) ||
      (validated.expectedSessionId !== undefined &&
        validated.expectedSessionId !== session.session.id)
    )
      throw createAppError('Session changed', 409, 'SESSION_CHANGED');

    const hasLocationVisibility =
      validated.showDistance !== undefined || validated.showCity !== undefined;
    if (hasLocationVisibility) {
      await updateLocation(
        session.user.id,
        {
          action: 'VISIBILITY',
          expectedUserId: validated.expectedUserId,
          expectedRevision: validated.expectedRevision,
          ...(validated.showDistance === undefined ? {} : { showDistance: validated.showDistance }),
          ...(validated.showCity === undefined ? {} : { showCity: validated.showCity }),
        },
        validated.showOnlineStatus,
      );
    } else {
      await db.profile.update({
        where: { userId: session.user.id },
        data:
          validated.showOnlineStatus === undefined
            ? {}
            : { showOnlineStatus: validated.showOnlineStatus },
      });
    }
    const profile = await db.profile.findUniqueOrThrow({
      where: { userId: session.user.id },
      select: {
        showOnlineStatus: true,
        showDistance: true,
        showCity: true,
        locationRevision: true,
      },
    });

    if (validated.showOnlineStatus !== undefined) {
      await notifyPresenceChange(session.user.id);
    }
    return NextResponse.json(profile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 },
      );
    }

    return handleApiError(error);
  }
}
