import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { handleApiError, readJson } from '@/lib/errors';
import { readOwnerLocation, updateLocation } from '@/lib/server/location';

const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(request.headers);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (request.nextUrl.searchParams.size)
      return NextResponse.json(
        {
          error: 'Location settings always use your signed-in account.',
          code: 'INVALID_LOCATION_QUERY',
        },
        { status: 400 },
      );
    return NextResponse.json(await readOwnerLocation(session.user.id), { headers });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(request.headers);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await updateLocation(session.user.id, await readJson(request)), {
      headers,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
