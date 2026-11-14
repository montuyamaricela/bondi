import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';
import { handleApiError, readJson } from '@/lib/errors';
import { getSocketInstance } from '@/lib/socket-instance';
import { refreshPresence } from '@/lib/server/presence';

const privacyUpdateSchema = z.object({
  showOnlineStatus: z.boolean().optional(),
  showDistance: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await readJson(request);
    const validated = privacyUpdateSchema.parse(body);

    const profile = await db.profile.update({
      where: { userId: session.user.id },
      data: validated,
      select: {
        showOnlineStatus: true,
        showDistance: true,
      },
    });

    if (validated.showOnlineStatus !== undefined) {
      await refreshPresence(getSocketInstance(), session.user.id).catch(() => {
        console.error('Could not refresh privacy visibility');
      });
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
