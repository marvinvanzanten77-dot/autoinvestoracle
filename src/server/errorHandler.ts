/**
 * ERROR HANDLING UTILITY
 * 
 * Consistent error response format across all API handlers.
 * Replaces ad-hoc error messages met standardized responses.
 */

export type ApiErrorCode = 
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';

export type ApiErrorResponse = {
  error: string;
  code: ApiErrorCode;
  timestamp: string;
  requestId?: string;
  details?: Record<string, unknown>;
};

/**
 * Generate consistent error response
 */
export function createErrorResponse(
  message: string,
  code: ApiErrorCode,
  details?: Record<string, unknown>,
  requestId?: string
): ApiErrorResponse {
  return {
    error: message,
    code,
    timestamp: new Date().toISOString(),
    requestId,
    details
  };
}

/**
 * Map HTTP error codes
 */
export function getHttpStatusCode(code: ApiErrorCode): number {
  const statusMap: Record<ApiErrorCode, number> = {
    INVALID_REQUEST: 400,
    NOT_FOUND: 404,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    RATE_LIMITED: 429,
    EXTERNAL_SERVICE_ERROR: 502,
    DATABASE_ERROR: 500,
    INTERNAL_ERROR: 500
  };
  return statusMap[code] || 500;
}

/**
 * Handle external API errors gracefully
 */
export function handleExternalServiceError(
  service: string,
  error: unknown,
  fallback?: unknown
): { error: ApiErrorResponse; fallback?: unknown } {
  const message = error instanceof Error ? error.message : String(error);
  
  return {
    error: createErrorResponse(
      `${service} service temporarily unavailable: ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      { service, originalError: message }
    ),
    fallback
  };
}

/**
 * Validate required fields
 */
export function validateRequired(
  obj: Record<string, unknown>,
  requiredFields: string[]
): { valid: true } | { valid: false; error: ApiErrorResponse } {
  const missing = requiredFields.filter(field => !obj[field]);
  
  if (missing.length > 0) {
    return {
      valid: false,
      error: createErrorResponse(
        `Missing required fields: ${missing.join(', ')}`,
        'INVALID_REQUEST',
        { missingFields: missing }
      )
    };
  }
  
  return { valid: true };
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(
  json: string,
  fallback: T
): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Classify error for logging
 */
export type ErrorSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export function classifyError(error: unknown): ErrorSeverity {
  if (error instanceof SyntaxError) return 'warn';
  if (error instanceof TypeError) return 'warn';
  if (error instanceof RangeError) return 'error';
  if (error instanceof Error && error.message.includes('timeout')) return 'warn';
  if (error instanceof Error && error.message.includes('ECONNREFUSED')) return 'error';
  return 'error';
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(
  error: unknown,
  context: string
): string {
  const severity = classifyError(error);
  const timestamp = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  
  return `[${severity.toUpperCase()}] ${timestamp} ${context}: ${message}${stack ? `\n${stack}` : ''}`;
}
