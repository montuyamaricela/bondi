import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { UTApi } from 'uploadthing/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await getServerSession(request.headers);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { key } = await params;

    const file = await db.file.findFirst({
      where: {
        key,
        userId: session.user.id,
      },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (process.env.UPLOADTHING_TOKEN) {
      try {
        const utapi = new UTApi();
        await utapi.deleteFiles(key);
      } catch (uploadThingError) {
        console.error('Failed to delete from UploadThing:', uploadThingError);
      }
    }

    await db.file.delete({
      where: { id: file.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Photo deleted successfully',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
