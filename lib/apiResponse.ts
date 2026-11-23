/**
 * Standardized API Response and Error Helpers
 * File: lib/apiResponse.ts
 */

import { NextResponse } from 'next/server';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ApiResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  pagination?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
}

/**
 * Canonical Error Code Catalog matching NIRVAHA_EVENTS_BOOKING_CONTRACT.md
 */
export const ApiErrorCode = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  EVENT_NOT_OPEN_FOR_BOOKING: 'EVENT_NOT_OPEN_FOR_BOOKING',
  BOOKING_NOT_SUPPORTED: 'BOOKING_NOT_SUPPORTED',
  REGISTRATION_NOT_OPEN_YET: 'REGISTRATION_NOT_OPEN_YET',
  REGISTRATION_CLOSED: 'REGISTRATION_CLOSED',
  DEADLINE_EXCEEDED: 'DEADLINE_EXCEEDED',
  INVALID_PARTICIPANT_COUNT: 'INVALID_PARTICIPANT_COUNT',
  MAX_PARTICIPANTS_EXCEEDED: 'MAX_PARTICIPANTS_EXCEEDED',
  CAPACITY_EXCEEDED: 'CAPACITY_EXCEEDED',
  PAYMENT_PROVIDER_UNCONFIGURED: 'PAYMENT_PROVIDER_UNCONFIGURED',
  BOOKING_ALREADY_CANCELLED: 'BOOKING_ALREADY_CANCELLED',
  DUPLICATE_BOOKING: 'DUPLICATE_BOOKING',
  ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
  EVENT_HAS_ACTIVE_BOOKINGS: 'EVENT_HAS_ACTIVE_BOOKINGS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCodeType = typeof ApiErrorCode[keyof typeof ApiErrorCode] | string;

/**
 * Custom Error class with HTTP status code and optional error code/details
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: any;

  constructor(statusCode: number, message: string, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Standard API Success Response Helper
 */
export function apiSuccess<T>(
  data: T,
  status: number = 200,
  message?: string,
  meta?: { pagination?: PaginationMeta; [key: string]: any }
): NextResponse<ApiResponse<T>> {
  const payload: ApiResponse<T> = {
    success: true,
    data,
  };

  if (message) {
    payload.message = message;
  }

  if (meta?.pagination) {
    payload.pagination = meta.pagination;
  }

  return NextResponse.json(payload, { status });
}

/**
 * Convenience helper for paginated lists
 */
export function apiPaginatedSuccess<T>(
  data: T[],
  pagination: PaginationMeta,
  status: number = 200,
  message?: string
): NextResponse<ApiResponse<T[]>> {
  return apiSuccess(data, status, message, { pagination });
}

/**
 * Standard API Error Response Helper
 */
export function apiError(
  message: string,
  status: number = 400,
  code?: string,
  details?: any
): NextResponse<ApiErrorResponse> {
  const payload: ApiErrorResponse = {
    success: false,
    error: message,
  };

  if (code) {
    payload.code = code;
  }

  if (details !== undefined) {
    payload.details = details;
  }

  return NextResponse.json(payload, { status });
}

/**
 * Universal error handler for Next.js route handlers
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  if (error instanceof ApiError) {
    return apiError(error.message, error.statusCode, error.code, error.details);
  }

  if (error && typeof error === 'object') {
    const err = error as Record<string, any>;
    const status = typeof err.statusCode === 'number'
      ? err.statusCode
      : (typeof err.status === 'number' ? err.status : 500);

    const message = typeof err.message === 'string' && err.message
      ? err.message
      : 'An unexpected server error occurred';

    const code = typeof err.code === 'string'
      ? err.code
      : (status >= 500 ? ApiErrorCode.INTERNAL_ERROR : ApiErrorCode.BAD_REQUEST);

    const details = err.details !== undefined
      ? err.details
      : (err.availableCapacity !== undefined ? { availableCapacity: err.availableCapacity } : undefined);

    return apiError(message, status, code, details);
  }

  return apiError('An unexpected internal server error occurred', 500, ApiErrorCode.INTERNAL_ERROR);
}
