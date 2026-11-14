export interface AppError extends Error {
  statusCode: number;
  code?: string;
  isAppError: true;
}

export function createAppError(message: string, statusCode: number = 500, code?: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.isAppError = true;
  error.name = 'AppError';
  return error;
}
