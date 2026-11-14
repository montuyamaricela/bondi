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
  console.error('API Error:', error);

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

  // Generic error
  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
      },
      { status: 500 },
    );
  }

  // Unknown error
  return NextResponse.json(
    {
      error: 'An unexpected error occurred',
    },
    { status: 500 },
  );
}

export const Errors = {
  Unauthorized: createAppError('Unauthorized', 401, 'UNAUTHORIZED'),
  Forbidden: createAppError('Forbidden', 403, 'FORBIDDEN'),
  NotFound: createAppError('Resource not found', 404, 'NOT_FOUND'),
  BadRequest: (message: string) => createAppError(message, 400, 'BAD_REQUEST'),
  InternalServer: createAppError('Internal server error', 500, 'INTERNAL_SERVER_ERROR'),
};
