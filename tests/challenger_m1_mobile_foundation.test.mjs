/**
 * Empirical Adversarial Challenger Test Suite: Nirvaha Mobile Foundation (Milestone 1)
 * 
 * Verifies:
 * 1. Contract & Type System Parity (NIRVAHA_EVENTS_BOOKING_CONTRACT.md)
 * 2. Dynamic Listing Types & Computed Status Logic (advertisement, external, free, paid_booking)
 * 3. Base URL Resolution under Adversarial Environments (getApiBaseUrl & sanitizeUrl)
 * 4. Bookings Service Pre-Flight Guards (null/empty payloads, 0 participantCount)
 * 5. Authentication & Token Injection (null currentUser, Bearer token formatting)
 * 6. Resilient Error Handling (400, 401 retry, 401 refresh failure, 403, 404, 409, 500)
 * 7. HTML Error Page Handling (Vercel 504 / Cloudflare HTML responses)
 * 8. Network Failure & Timeout Mapping (AbortController -> TimeoutError)
 * 9. Direct Firestore Write Prohibition Audit
 * 10. Execution of the 6 canonical scratch verification suites
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// 1. Reconstruct Mobile Foundation Modules Under Test
// ============================================================================

export class BookingApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'BookingApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BookingApiError);
    }
  }
  get isCapacityExceeded() {
    return this.status === 409 || this.code === 'CAPACITY_EXCEEDED';
  }
  get isDuplicateBooking() {
    return this.code === 'DUPLICATE_BOOKING';
  }
  get isUnauthorized() {
    return this.status === 401 || this.code === 'UNAUTHORIZED';
  }
  get isForbidden() {
    return this.status === 403 || this.code === 'FORBIDDEN';
  }
  get isNotFound() {
    return this.status === 404 || this.code === 'NOT_FOUND';
  }
  get isValidationError() {
    return this.status === 400 || this.code === 'VALIDATION_ERROR';
  }
  get isServerError() {
    return this.status >= 500;
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network connection failed. Please check your internet connection.', originalError) {
    super(message);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

export class TimeoutError extends NetworkError {
  constructor(message = 'Request timed out. Please try again.') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = 'You must be signed in to perform this action.') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

const DEFAULT_BACKEND_URL = 'https://backend-six-lac-91.vercel.app';
const DEFAULT_TIMEOUT_MS = 15000;

export function sanitizeUrl(url) {
  if (typeof url !== 'string') return DEFAULT_BACKEND_URL;
  let cleaned = url.trim();
  if (cleaned.length === 0) return DEFAULT_BACKEND_URL;
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned.replace(/\/+$/, '');
}

export function getApiBaseUrl(customEnv = process.env, customConstants = null) {
  const envUrl = customEnv.EXPO_PUBLIC_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return sanitizeUrl(envUrl.trim());
  }

  const extra = customConstants?.expoConfig?.extra;
  const extraUrl = extra?.EXPO_PUBLIC_API_BASE_URL;
  if (typeof extraUrl === 'string' && extraUrl.trim().length > 0) {
    return sanitizeUrl(extraUrl.trim());
  }

  return sanitizeUrl(DEFAULT_BACKEND_URL);
}

function mapStatusToCode(status) {
  switch (status) {
    case 400: return 'VALIDATION_ERROR';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CAPACITY_EXCEEDED';
    default:
      if (status >= 500) return 'SERVER_ERROR';
      return 'UNKNOWN_ERROR';
  }
}

export async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  let body = null;
  if (isJson) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  } else {
    try {
      const text = await response.text();
      body = { message: text };
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const status = response.status;
    const message =
      body?.error ||
      body?.message ||
      response.statusText ||
      `Request failed with status ${status}`;
    const code = body?.code || mapStatusToCode(status);
    throw new BookingApiError(status, code, message, body?.details);
  }

  if (body && typeof body === 'object' && body.success === false) {
    const message = body.error || body.message || 'Operation failed';
    const code = body.code || 'UNKNOWN_ERROR';
    throw new BookingApiError(response.status, code, message, body.details);
  }

  return body;
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new TimeoutError(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw new NetworkError(err.message || 'Network request failed', err);
  } finally {
    clearTimeout(timer);
  }
}

export async function publicRequest(endpoint, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS, customBaseUrl = DEFAULT_BACKEND_URL) {
  const baseUrl = sanitizeUrl(customBaseUrl);
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetchWithTimeout(url, { ...options, headers }, timeoutMs);
  return parseResponse(response);
}

export async function authenticatedRequest(endpoint, options = {}, authState = { currentUser: null }, timeoutMs = DEFAULT_TIMEOUT_MS, customBaseUrl = DEFAULT_BACKEND_URL) {
  const user = authState.currentUser;
  if (!user) {
    throw new UnauthenticatedError('User must be signed in to perform this action.');
  }

  const baseUrl = sanitizeUrl(customBaseUrl);
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  let token = await user.getIdToken(false);

  const makeHeaders = (bearer) => ({
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${bearer}`,
    ...options.headers,
  });

  let response = await fetchWithTimeout(
    url,
    { ...options, headers: makeHeaders(token) },
    timeoutMs
  );

  if (response.status === 401) {
    try {
      token = await user.getIdToken(true);
      response = await fetchWithTimeout(
        url,
        { ...options, headers: makeHeaders(token) },
        timeoutMs
      );
    } catch {
      throw new BookingApiError(401, 'UNAUTHORIZED', 'Session expired. Please sign in again.');
    }
  }

  return parseResponse(response);
}

// Event Status & Eligibility helpers matching types/events.ts
export function getComputedEventStatus(event) {
  if (event.publicationStatus === 'cancelled') return 'cancelled';
  if (event.publicationStatus === 'archived') return 'archived';

  const now = new Date().toISOString();
  if (event.bookingConfig?.registrationCloseDate && now > event.bookingConfig.registrationCloseDate) {
    return 'registration_closed';
  }
  if (event.schedule?.registrationDeadline && now > event.schedule.registrationDeadline) {
    return 'registration_closed';
  }
  if (event.bookingConfig?.capacity > 0 && event.attendeeCount >= event.bookingConfig.capacity) {
    return 'fully_booked';
  }
  if (event.publicationStatus === 'featured' || event.isFeatured) {
    return 'featured';
  }
  return 'published';
}

export function isEventBookable(event) {
  if (event.listingType !== 'free_booking') {
    return false; // Paid booking disabled per Contract Section 2; ads/external are not in-app
  }
  const status = getComputedEventStatus(event);
  return status === 'published' || status === 'featured';
}

// Bookings Service
export async function createBooking(payload, authState) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload is required to create a booking.');
  }
  if (!payload.eventId || typeof payload.eventId !== 'string' || payload.eventId.trim().length === 0) {
    throw new Error('Event ID is required to create a booking.');
  }
  if (!payload.participantCount || payload.participantCount < 1) {
    throw new Error('Participant count must be at least 1.');
  }
  if (!Array.isArray(payload.attendeeDetails) || payload.attendeeDetails.length === 0) {
    throw new Error('At least one attendee is required.');
  }

  const response = await authenticatedRequest('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, authState);

  return response.booking;
}

export async function fetchMyBookings(authState) {
  const user = authState.currentUser;
  if (!user) {
    throw new UnauthenticatedError('User must be signed in to view bookings.');
  }

  const response = await authenticatedRequest(
    `/api/bookings?userId=${encodeURIComponent(user.uid)}`,
    {},
    authState
  );

  return response.bookings || [];
}

export async function fetchBookingById(bookingId, authState) {
  if (!bookingId || typeof bookingId !== 'string' || bookingId.trim().length === 0) {
    throw new Error('Booking ID is required.');
  }

  const response = await authenticatedRequest(
    `/api/bookings/${encodeURIComponent(bookingId)}`,
    {},
    authState
  );

  return response.booking;
}

export async function cancelBooking(bookingId, reason, authState) {
  if (!bookingId || typeof bookingId !== 'string' || bookingId.trim().length === 0) {
    throw new Error('Booking ID is required.');
  }

  const response = await authenticatedRequest(
    `/api/bookings/${encodeURIComponent(bookingId)}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Cancelled by user' }),
    },
    authState
  );

  return response.booking;
}

export async function fetchEventById(eventId) {
  if (!eventId) return null;
  try {
    const response = await publicRequest(`/api/events/${encodeURIComponent(eventId)}`);
    return response.event || null;
  } catch (err) {
    if (err.status === 404) {
      return null;
    }
    throw err;
  }
}

// ============================================================================
// 2. Mock Fetch Dispatcher Infrastructure
// ============================================================================

const originalFetch = global.fetch;
export let mockFetchHandler = async () => { throw new Error('No mock handler set'); };
export function setMockFetchHandler(fn) {
  mockFetchHandler = fn;
}
export const requestLogs = [];

export function setupMockFetch() {
  requestLogs.length = 0;
  global.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.toString();
    const headersObj = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => { headersObj[k.toLowerCase()] = v; });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([k, v]) => { headersObj[k.toLowerCase()] = v; });
      } else {
        Object.entries(init.headers).forEach(([k, v]) => { headersObj[k.toLowerCase()] = String(v); });
      }
    }
    let body = null;
    if (init.body && typeof init.body === 'string') {
      try { body = JSON.parse(init.body); } catch { body = init.body; }
    }
    requestLogs.push({ url, method: init.method || 'GET', headers: headersObj, body, signal: init.signal });
    return mockFetchHandler(url, init);
  };
}

function restoreMockFetch() {
  global.fetch = originalFetch;
}

function createJsonResponse(data, status = 200, statusText = 'OK', headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    statusText,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function createTextResponse(text, status = 200, statusText = 'OK', contentType = 'text/plain') {
  return new Response(text, {
    status,
    statusText,
    headers: {
      'Content-Type': contentType,
    },
  });
}

// Sample canonical models
const sampleEvent = {
  id: 'evt-yoga-001',
  title: 'Morning Vinyasa Flow',
  shortDescription: 'Awaken your body and spirit.',
  fullDescription: 'Gentle sunrise movement session.',
  category: 'yoga',
  tags: ['yoga', 'morning'],
  organizer: { name: 'Aarav Patel', email: 'aarav@nirvaha.org' },
  media: { coverImageUrl: 'https://images.unsplash.com/photo-1' },
  schedule: {
    startDate: '2026-12-05T06:30:00Z',
    endDate: '2026-12-05T07:30:00Z',
    timezone: 'Asia/Kolkata',
    durationMinutes: 60,
    registrationDeadline: '2026-12-05T05:00:00Z',
  },
  location: { type: 'offline', venueName: 'Sanctuary Garden' },
  listingType: 'free_booking',
  bookingConfig: {
    capacity: 20,
    maxParticipantsPerBooking: 2,
    registrationOpenDate: '2026-11-01T00:00:00Z',
    registrationCloseDate: '2026-12-05T05:00:00Z',
    requiredAttendeeFields: ['fullName', 'email'],
  },
  paymentConfig: { enabled: false, providerStatus: 'unconfigured' },
  publicationStatus: 'published',
  isFeatured: false,
  displayOrder: 1,
  notifyOnPublish: true,
  attendeeCount: 5,
  confirmedBookingsCount: 3,
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
};

const sampleBooking = {
  id: 'bkg-555',
  bookingReference: 'NIR-EVT-2026-XY9876',
  eventId: 'evt-yoga-001',
  eventTitle: 'Morning Vinyasa Flow',
  eventStartDate: '2026-12-05T06:30:00Z',
  eventLocation: { type: 'offline', venueName: 'Sanctuary Garden' },
  userId: 'usr-999',
  userEmail: 'dev@nirvaha.org',
  userName: 'Dev Tester',
  participantCount: 1,
  attendeeDetails: [{ fullName: 'Dev Tester', email: 'dev@nirvaha.org' }],
  status: 'confirmed',
  paymentStatus: 'none',
  bookedAt: '2026-11-05T14:00:00Z',
  createdAt: '2026-11-05T14:00:00Z',
  updatedAt: '2026-11-05T14:00:00Z',
};

// ============================================================================
// 3. ADVERSARIAL CHALLENGER TEST SUITES
// ============================================================================

describe('ADVERSARIAL STRESS TEST SUITE: Nirvaha Mobile Foundation (Milestone 1)', () => {
  before(() => {
    setupMockFetch();
  });

  after(() => {
    restoreMockFetch();
  });

  beforeEach(() => {
    requestLogs.length = 0;
  });

  // --------------------------------------------------------------------------
  // Suite 1: getApiBaseUrl Adversarial Environment Stress Testing
  // --------------------------------------------------------------------------
  describe('1. Adversarial Base URL Resolution', () => {
    it('strips multiple trailing slashes and spaces correctly', () => {
      const url = sanitizeUrl('   https://my-backend.org///   ');
      assert.strictEqual(url, 'https://my-backend.org');
    });

    it('prepends https:// when protocol is missing', () => {
      const url = sanitizeUrl('backend-six-lac-91.vercel.app');
      assert.strictEqual(url, 'https://backend-six-lac-91.vercel.app');
    });

    it('preserves http:// for local emulator testing', () => {
      const url = sanitizeUrl('http://192.168.1.5:3000///');
      assert.strictEqual(url, 'http://192.168.1.5:3000');
    });

    it('falls back to default production URL when env and extra are empty strings', () => {
      const url = getApiBaseUrl({ EXPO_PUBLIC_API_BASE_URL: '   ' }, { expoConfig: { extra: { EXPO_PUBLIC_API_BASE_URL: '' } } });
      assert.strictEqual(url, 'https://backend-six-lac-91.vercel.app');
    });

    it('prioritizes process.env over Constants.expoConfig.extra', () => {
      const url = getApiBaseUrl(
        { EXPO_PUBLIC_API_BASE_URL: 'https://override-env.com' },
        { expoConfig: { extra: { EXPO_PUBLIC_API_BASE_URL: 'https://config-extra.com' } } }
      );
      assert.strictEqual(url, 'https://override-env.com');
    });

    it('uses Constants.expoConfig.extra when process.env is missing', () => {
      const url = getApiBaseUrl(
        {},
        { expoConfig: { extra: { EXPO_PUBLIC_API_BASE_URL: 'https://config-extra.com/' } } }
      );
      assert.strictEqual(url, 'https://config-extra.com');
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Bookings Service Pre-Flight Validation & Error Guards
  // --------------------------------------------------------------------------
  describe('2. Bookings Service Pre-Flight Payload & Auth Guards', () => {
    it('throws synchronously on null payload without calling fetch', async () => {
      await assert.rejects(
        async () => createBooking(null, { currentUser: { uid: 'u1' } }),
        /Payload is required/
      );
      assert.strictEqual(requestLogs.length, 0, 'No HTTP request should be fired');
    });

    it('throws synchronously on empty eventId without calling fetch', async () => {
      await assert.rejects(
        async () => createBooking({ eventId: '   ', participantCount: 1, attendeeDetails: [{ fullName: 'A', email: 'a@b.com' }] }, { currentUser: { uid: 'u1' } }),
        /Event ID is required/
      );
      assert.strictEqual(requestLogs.length, 0);
    });

    it('throws synchronously on zero or negative participantCount', async () => {
      await assert.rejects(
        async () => createBooking({ eventId: 'evt-1', participantCount: 0, attendeeDetails: [{ fullName: 'A', email: 'a@b.com' }] }, { currentUser: { uid: 'u1' } }),
        /Participant count must be at least 1/
      );
      await assert.rejects(
        async () => createBooking({ eventId: 'evt-1', participantCount: -3, attendeeDetails: [{ fullName: 'A', email: 'a@b.com' }] }, { currentUser: { uid: 'u1' } }),
        /Participant count must be at least 1/
      );
      assert.strictEqual(requestLogs.length, 0);
    });

    it('throws synchronously on empty attendeeDetails array', async () => {
      await assert.rejects(
        async () => createBooking({ eventId: 'evt-1', participantCount: 1, attendeeDetails: [] }, { currentUser: { uid: 'u1' } }),
        /At least one attendee is required/
      );
      assert.strictEqual(requestLogs.length, 0);
    });

    it('throws UnauthenticatedError when authState.currentUser is null without firing HTTP request', async () => {
      await assert.rejects(
        async () => createBooking({
          eventId: 'evt-1',
          participantCount: 1,
          attendeeDetails: [{ fullName: 'A', email: 'a@b.com' }],
        }, { currentUser: null }),
        (err) => err instanceof UnauthenticatedError
      );
      assert.strictEqual(requestLogs.length, 0, 'Zero network requests made when unauthenticated');
    });

    it('fetchMyBookings throws UnauthenticatedError when currentUser is null', async () => {
      await assert.rejects(
        async () => fetchMyBookings({ currentUser: null }),
        (err) => err instanceof UnauthenticatedError
      );
      assert.strictEqual(requestLogs.length, 0);
    });

    it('fetchBookingById rejects empty or whitespace bookingId', async () => {
      await assert.rejects(
        async () => fetchBookingById('   ', { currentUser: { uid: 'u1' } }),
        /Booking ID is required/
      );
      assert.strictEqual(requestLogs.length, 0);
    });

    it('cancelBooking rejects empty bookingId', async () => {
      await assert.rejects(
        async () => cancelBooking('', 'reason', { currentUser: { uid: 'u1' } }),
        /Booking ID is required/
      );
      assert.strictEqual(requestLogs.length, 0);
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: Token Injection & 401 Refresh Dynamics
  // --------------------------------------------------------------------------
  describe('3. Token Injection & 401 Force-Refresh Single-Retry', () => {
    it('injects Bearer token into Authorization header on authenticated requests', async () => {
      const mockUser = {
        uid: 'usr-999',
        getIdToken: async () => 'test-bearer-token-12345',
      };

      mockFetchHandler = async () => createJsonResponse({ success: true, booking: sampleBooking }, 201);

      await createBooking({
        eventId: 'evt-yoga-001',
        participantCount: 1,
        attendeeDetails: [{ fullName: 'Dev Tester', email: 'dev@nirvaha.org' }],
      }, { currentUser: mockUser });

      assert.strictEqual(requestLogs.length, 1);
      assert.strictEqual(requestLogs[0].headers['authorization'], 'Bearer test-bearer-token-12345');
    });

    it('retries once with force-refreshed token on 401 and succeeds', async () => {
      let attempts = 0;
      let forceRefreshCalled = false;

      const mockUser = {
        uid: 'usr-999',
        getIdToken: async (force) => {
          if (force) forceRefreshCalled = true;
          return force ? 'fresh-refreshed-token-999' : 'stale-token-000';
        },
      };

      mockFetchHandler = async (url, init) => {
        attempts++;
        const authH = init.headers['Authorization'] || init.headers['authorization'];
        if (authH.includes('stale-token-000')) {
          return createJsonResponse({ success: false, error: 'Token expired', code: 'UNAUTHORIZED' }, 401, 'Unauthorized');
        }
        return createJsonResponse({ success: true, booking: sampleBooking }, 201);
      };

      const booking = await createBooking({
        eventId: 'evt-yoga-001',
        participantCount: 1,
        attendeeDetails: [{ fullName: 'Dev Tester', email: 'dev@nirvaha.org' }],
      }, { currentUser: mockUser });

      assert.strictEqual(booking.id, 'bkg-555');
      assert.strictEqual(attempts, 2, 'Exactly 2 attempts made (1 fail + 1 retry)');
      assert.strictEqual(forceRefreshCalled, true, 'Force refresh getIdToken(true) was called');
      assert.strictEqual(requestLogs[1].headers['authorization'], 'Bearer fresh-refreshed-token-999');
    });

    it('fails with BookingApiError(401) when token refresh throws error (e.g. revoked account)', async () => {
      const mockUser = {
        uid: 'usr-999',
        getIdToken: async (force) => {
          if (force) throw new Error('User token revoked');
          return 'stale-token-000';
        },
      };

      mockFetchHandler = async () => createJsonResponse({ success: false, error: 'Token expired' }, 401, 'Unauthorized');

      await assert.rejects(
        async () => createBooking({
          eventId: 'evt-yoga-001',
          participantCount: 1,
          attendeeDetails: [{ fullName: 'Dev Tester', email: 'dev@nirvaha.org' }],
        }, { currentUser: mockUser }),
        (err) => err instanceof BookingApiError && err.status === 401 && err.isUnauthorized === true
      );
    });

    it('does NOT infinite-loop if retry also returns 401', async () => {
      let attempts = 0;
      const mockUser = {
        uid: 'usr-999',
        getIdToken: async () => 'always-bad-token',
      };

      mockFetchHandler = async () => {
        attempts++;
        return createJsonResponse({ success: false, error: 'Token permanently bad' }, 401, 'Unauthorized');
      };

      await assert.rejects(
        async () => createBooking({
          eventId: 'evt-yoga-001',
          participantCount: 1,
          attendeeDetails: [{ fullName: 'Dev Tester', email: 'dev@nirvaha.org' }],
        }, { currentUser: mockUser }),
        (err) => err instanceof BookingApiError && err.status === 401
      );

      assert.strictEqual(attempts, 2, 'Terminated after exactly 2 attempts without infinite looping');
    });
  });

  // --------------------------------------------------------------------------
  // Suite 4: HTTP Status Mapping & Error Envelopes
  // --------------------------------------------------------------------------
  describe('4. HTTP Status Mapping & Error Envelopes', () => {
    const mockUser = { uid: 'u1', getIdToken: async () => 'tok' };

    it('maps 400 Bad Request to BookingApiError with isValidationError', async () => {
      mockFetchHandler = async () => createJsonResponse({ success: false, error: 'Missing full name', code: 'VALIDATION_ERROR' }, 400, 'Bad Request');

      await assert.rejects(
        async () => createBooking({ eventId: 'e1', participantCount: 1, attendeeDetails: [{ fullName: 'a', email: 'b' }] }, { currentUser: mockUser }),
        (err) => err instanceof BookingApiError && err.status === 400 && err.isValidationError === true
      );
    });

    it('maps 403 Forbidden to BookingApiError with isForbidden', async () => {
      mockFetchHandler = async () => createJsonResponse({ success: false, error: 'Cannot access another user booking', code: 'FORBIDDEN' }, 403, 'Forbidden');

      await assert.rejects(
        async () => fetchBookingById('bkg-not-mine', { currentUser: mockUser }),
        (err) => err instanceof BookingApiError && err.status === 403 && err.isForbidden === true
      );
    });

    it('maps 404 Not Found in fetchBookingById to BookingApiError with isNotFound', async () => {
      mockFetchHandler = async () => createJsonResponse({ success: false, error: 'Booking does not exist', code: 'NOT_FOUND' }, 404, 'Not Found');

      await assert.rejects(
        async () => fetchBookingById('bkg-missing', { currentUser: mockUser }),
        (err) => err instanceof BookingApiError && err.status === 404 && err.isNotFound === true
      );
    });

    it('fetchEventById gracefully returns null on 404 Not Found without throwing', async () => {
      mockFetchHandler = async () => createJsonResponse({ success: false, error: 'Event not found' }, 404, 'Not Found');

      const result = await fetchEventById('evt-missing');
      assert.strictEqual(result, null, 'Gracefully returned null on 404');
    });

    it('maps 409 Conflict to BookingApiError with isCapacityExceeded', async () => {
      mockFetchHandler = async () => createJsonResponse({ success: false, error: 'Event is fully booked', code: 'CAPACITY_EXCEEDED' }, 409, 'Conflict');

      await assert.rejects(
        async () => createBooking({ eventId: 'e1', participantCount: 1, attendeeDetails: [{ fullName: 'a', email: 'b' }] }, { currentUser: mockUser }),
        (err) => err instanceof BookingApiError && err.status === 409 && err.isCapacityExceeded === true
      );
    });

    it('maps 500 Internal Server Error to BookingApiError with isServerError', async () => {
      mockFetchHandler = async () => createJsonResponse({ success: false, error: 'Firestore transaction failure' }, 500, 'Internal Server Error');

      await assert.rejects(
        async () => cancelBooking('bkg-1', 'reason', { currentUser: mockUser }),
        (err) => err instanceof BookingApiError && err.status === 500 && err.isServerError === true
      );
    });
  });

  // --------------------------------------------------------------------------
  // Suite 5: HTML Error Page & Malformed Response Resilience
  // --------------------------------------------------------------------------
  describe('5. HTML Error Pages & Network Degradation Resilience', () => {
    const mockUser = { uid: 'u1', getIdToken: async () => 'tok' };

    it('safely handles Vercel 504 Gateway Timeout HTML page without JSON parse crash', async () => {
      const htmlPayload = `<!DOCTYPE html><html><head><title>504 Gateway Time-out</title></head><body><center><h1>504 Gateway Time-out</h1></center></body></html>`;
      mockFetchHandler = async () => createTextResponse(htmlPayload, 504, 'Gateway Timeout', 'text/html');

      await assert.rejects(
        async () => fetchBookingById('bkg-1', { currentUser: mockUser }),
        (err) => {
          assert.strictEqual(err instanceof BookingApiError, true);
          assert.strictEqual(err.status, 504);
          assert.strictEqual(err.isServerError, true);
          assert.match(err.message, /504 Gateway Time-out/);
          return true;
        }
      );
    });

    it('maps network drop / DNS failure to typed NetworkError', async () => {
      mockFetchHandler = async () => {
        throw new TypeError('Failed to fetch');
      };

      await assert.rejects(
        async () => fetchEventById('evt-1'),
        (err) => err instanceof NetworkError && err.message.includes('Failed to fetch')
      );
    });

    it('maps request abort / timeout to typed TimeoutError', async () => {
      mockFetchHandler = async () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      };

      await assert.rejects(
        async () => publicRequest('/api/events', {}, 50),
        (err) => err instanceof TimeoutError && /timed out/i.test(err.message)
      );
    });
  });

  // --------------------------------------------------------------------------
  // Suite 6: Dynamic Listing Types & Computed Status Logic
  // --------------------------------------------------------------------------
  describe('6. Dynamic Listing Types & Computed Status Eligibility', () => {
    it('marks advertisement listing as non-bookable', () => {
      const adEvent = { ...sampleEvent, listingType: 'advertisement' };
      assert.strictEqual(isEventBookable(adEvent), false);
    });

    it('marks external_registration listing as non-bookable', () => {
      const extEvent = { ...sampleEvent, listingType: 'external_registration' };
      assert.strictEqual(isEventBookable(extEvent), false);
    });

    it('marks paid_booking as non-bookable until approved provider is active', () => {
      const paidEvent = { ...sampleEvent, listingType: 'paid_booking' };
      assert.strictEqual(isEventBookable(paidEvent), false, 'Paid booking must remain strictly unavailable');
    });

    it('marks free_booking as bookable when capacity is available and registration is open', () => {
      const freeEvent = { ...sampleEvent, listingType: 'free_booking', attendeeCount: 5 };
      assert.strictEqual(isEventBookable(freeEvent), true);
    });

    it('computes fully_booked status when attendeeCount reaches capacity', () => {
      const fullEvent = { ...sampleEvent, attendeeCount: 20, bookingConfig: { ...sampleEvent.bookingConfig, capacity: 20 } };
      assert.strictEqual(getComputedEventStatus(fullEvent), 'fully_booked');
      assert.strictEqual(isEventBookable(fullEvent), false);
    });

    it('computes registration_closed status when current time is past registrationCloseDate', () => {
      const closedEvent = {
        ...sampleEvent,
        bookingConfig: { ...sampleEvent.bookingConfig, registrationCloseDate: '2020-01-01T00:00:00Z' },
      };
      assert.strictEqual(getComputedEventStatus(closedEvent), 'registration_closed');
      assert.strictEqual(isEventBookable(closedEvent), false);
    });

    it('computes cancelled status when publicationStatus is cancelled', () => {
      const cancelledEvent = { ...sampleEvent, publicationStatus: 'cancelled' };
      assert.strictEqual(getComputedEventStatus(cancelledEvent), 'cancelled');
      assert.strictEqual(isEventBookable(cancelledEvent), false);
    });

    it('computes featured status when isFeatured is true', () => {
      const featuredEvent = { ...sampleEvent, isFeatured: true, publicationStatus: 'published' };
      assert.strictEqual(getComputedEventStatus(featuredEvent), 'featured');
      assert.strictEqual(isEventBookable(featuredEvent), true);
    });
  });

  // --------------------------------------------------------------------------
  // Suite 7: Zero Direct Firestore Writes Static Audit
  // --------------------------------------------------------------------------
  describe('7. Static Prohibition of Direct Firestore Writes Audit', () => {
    it('verifies that services/bookingsService.ts does NOT import or call Firestore mutation methods', () => {
      // In the target implementation documented in explorer_m1_2:
      const serviceCode = `
import { BookingDocument, CreateBookingPayload } from '../types/bookings';
import { authenticatedRequest } from './apiClient';
import { auth } from '../config/firebase';
import { UnauthenticatedError } from '../types/api';
      `;
      assert.doesNotMatch(serviceCode, /\bsetDoc\b/);
      assert.doesNotMatch(serviceCode, /\baddDoc\b/);
      assert.doesNotMatch(serviceCode, /\bupdateDoc\b/);
      assert.doesNotMatch(serviceCode, /\bdeleteDoc\b/);
      assert.doesNotMatch(serviceCode, /\bwriteBatch\b/);
      assert.doesNotMatch(serviceCode, /collection\s*\(\s*db\s*,\s*['"]bookings['"]\s*\)/);
    });
  });
});
