import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { createAppError, type AppError } from './app-error';
export { createAppError, type AppError } from './app-error';

function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAppError' in error &&
    (error as AppError).isAppError === true
  );
}

// Handle API errors and return formatted NextResponse
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  if (isAppError(error)) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode },
    );
  }

  const requestId = crypto.randomUUID();
  // Log only the correlation ID: exceptions may contain SQL, paths or private values.
  console.error('API request failed', { requestId });
  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', requestId },
    { status: 500, headers: { 'X-Request-ID': requestId } },
  );
}

export async function readJson(request: Pick<Request, 'json'>): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw createAppError('Invalid JSON', 400, 'INVALID_JSON');
  }
}

export const Errors = {
  Unauthorized: createAppError('Unauthorized', 401, 'UNAUTHORIZED'),
  Forbidden: createAppError('Forbidden', 403, 'FORBIDDEN'),
  NotFound: createAppError('Resource not found', 404, 'NOT_FOUND'),
  BadRequest: (message: string) => createAppError(message, 400, 'BAD_REQUEST'),
  InternalServer: createAppError('Internal server error', 500, 'INTERNAL_SERVER_ERROR'),
};
