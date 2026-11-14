import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/session';
import { handleApiError } from '@/lib/errors';
import { citySearchSchema } from '@/app/components/features/location/validation';
import { searchCities } from '@/lib/server/location-catalog';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(request.headers);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const params = request.nextUrl.searchParams;
    const validation = citySearchSchema.safeParse(Object.fromEntries(params));
    if (!validation.success || [...params.keys()].some((key) => params.getAll(key).length !== 1))
      return NextResponse.json(
        {
          error: 'Use a city query from 2–80 characters and an optional two-letter country code.',
          code: 'INVALID_CITY_SEARCH',
        },
        { status: 400 },
      );
    return NextResponse.json({
      items: await searchCities(validation.data.q, validation.data.country),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
