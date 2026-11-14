import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { handleApiError } from '@/lib/errors';
import { deleteProfilePhoto } from '@/lib/server/profile-photo-delete';
import { UTApi } from 'uploadthing/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const session = await getServerSession(request.headers);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { key } = await params;

    await deleteProfilePhoto(session.user.id, key, async (ownedKey) => {
      const token = process.env.UPLOADTHING_TOKEN;
      if (!token) throw new Error('Storage deletion is not configured');
      // SDK error logs include file keys; this boundary reports sanitized retry errors.
      return new UTApi({ token, logLevel: 'None' }).deleteFiles(ownedKey);
    });

    return NextResponse.json({
      success: true,
      message: 'Photo deleted successfully',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
