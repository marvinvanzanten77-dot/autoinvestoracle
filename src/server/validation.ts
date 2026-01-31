/**
 * INPUT VALIDATION HELPERS
 * 
 * Consistent validation across API handlers.
 * Replaces ad-hoc validation met reusable utilities.
 */

import { createErrorResponse, type ApiErrorResponse } from './errorHandler';

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID v4 format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate number is in range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validate string length
 */
export function isValidLength(
  str: string,
  min: number,
  max: number
): boolean {
  return str.length >= min && str.length <= max;
}

/**
 * Validate array not empty
 */
export function isNonEmptyArray(arr: unknown): arr is unknown[] {
  return Array.isArray(arr) && arr.length > 0;
}

/**
 * Safe string trim & normalize
 */
export function normalizeString(str: unknown, maxLength = 255): string {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, maxLength);
}

/**
 * Safe number parse
 */
export function parseNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

/**
 * Validate market range parameter
 */
export function isValidMarketRange(value: unknown): value is '1h' | '24h' | '7d' {
  return value === '1h' || value === '24h' || value === '7d';
}

/**
 * Validate asset category
 */
export function isValidAssetCategory(value: unknown): value is 'BTC' | 'ETH' | 'STABLE' | 'ALT' {
  return value === 'BTC' || value === 'ETH' || value === 'STABLE' || value === 'ALT';
}

/**
 * Validate percentage (0-100)
 */
export function isValidPercentage(value: unknown): value is number {
  const num = parseNumber(value);
  return num >= 0 && num <= 100;
}

/**
 * Request body validation schema
 */
export type ValidationSchema = {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
    validator?: (value: unknown) => boolean;
  };
};

/**
 * Validate request body against schema
 */
export function validateSchema(
  body: unknown,
  schema: ValidationSchema
): { valid: true; data: Record<string, unknown> } | { valid: false; error: ApiErrorResponse } {
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: createErrorResponse('Request body must be an object', 'INVALID_REQUEST')
    };
  }

  const data: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const [key, rules] of Object.entries(schema)) {
    const value = (body as Record<string, unknown>)[key];

    // Check required
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`${key} is required`);
      continue;
    }

    // Skip if not required and missing
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }

    // Type check
    if (typeof value !== rules.type) {
      errors.push(`${key} must be a ${rules.type}, got ${typeof value}`);
      continue;
    }

    // String validation
    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.min && value.length < rules.min) {
        errors.push(`${key} must be at least ${rules.min} characters`);
        continue;
      }
      if (rules.max && value.length > rules.max) {
        errors.push(`${key} must be at most ${rules.max} characters`);
        continue;
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${key} has invalid format`);
        continue;
      }
    }

    // Number validation
    if (rules.type === 'number' && typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${key} must be at least ${rules.min}`);
        continue;
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${key} must be at most ${rules.max}`);
        continue;
      }
    }

    // Custom validator
    if (rules.validator && !rules.validator(value)) {
      errors.push(`${key} failed custom validation`);
      continue;
    }

    data[key] = value;
  }

  if (errors.length > 0) {
    return {
      valid: false,
      error: createErrorResponse('Validation failed', 'INVALID_REQUEST', { errors })
    };
  }

  return { valid: true, data };
}
