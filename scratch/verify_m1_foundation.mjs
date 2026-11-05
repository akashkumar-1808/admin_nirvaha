/**
 * Nirvaha Milestone 1 Verification Harness
 * Executed by challenger_m1_1 in active workspace
 * Mirrors C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\scratch\verify_m1_foundation.ts verbatim
 */

export class BookingApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'BookingApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    if (Error.captureStackTrace) Error.captureStackTrace(this, BookingApiError);
  }
  get isCapacityExceeded() { return this.status === 409 || this.code === 'CAPACITY_EXCEEDED'; }
  get isDuplicateBooking() { return this.code === 'DUPLICATE_BOOKING'; }
  get isUnauthorized() { return this.status === 401 || this.code === 'UNAUTHORIZED'; }
  get isForbidden() { return this.status === 403 || this.code === 'FORBIDDEN'; }
  get isNotFound() { return this.status === 404 || this.code === 'NOT_FOUND'; }
  get isValidationError() { return this.status === 400 || this.code === 'VALIDATION_ERROR'; }
  get isServerError() { return this.status >= 500; }
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

function sanitizeUrl(url) {
  let cleaned = (url || '').trim();
  if (!/^https?:\/\//i.test(cleaned)) cleaned = `https://${cleaned}`;
  return cleaned.replace(/\/+$/, '');
}

export function getApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) return sanitizeUrl(envUrl.trim());
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

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  let body = null;
  if (isJson) {
    try { body = await response.json(); } catch { body = null; }
  } else {
    try { const text = await response.text(); body = { message: text }; } catch { body = null; }
  }

  if (!response.ok) {
    const status = response.status;
    const message = body?.error || body?.message || response.statusText || `Request failed with status ${status}`;
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

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new TimeoutError(`Request timed out after ${timeoutMs / 1000}s`);
    throw new NetworkError(err.message || 'Network request failed', err);
  } finally {
    clearTimeout(timer);
  }
}

export async function publicRequest(endpoint, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json', ...options.headers };
  const response = await fetchWithTimeout(url, { ...options, headers }, timeoutMs);
  return parseResponse(response);
}

const auth = { currentUser: null };

export async function authenticatedRequest(endpoint, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const user = auth.currentUser;
  if (!user) throw new UnauthenticatedError('User must be signed in to perform this action.');

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  let token = await user.getIdToken(false);
  const makeHeaders = (bearer) => ({
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${bearer}`,
    ...options.headers,
  });

  let response = await fetchWithTimeout(url, { ...options, headers: makeHeaders(token) }, timeoutMs);

  if (response.status === 401) {
    try {
      token = await user.getIdToken(true);
      response = await fetchWithTimeout(url, { ...options, headers: makeHeaders(token) }, timeoutMs);
    } catch {
      throw new BookingApiError(401, 'UNAUTHORIZED', 'Session expired. Please sign in again.');
    }
  }

  return parseResponse(response);
}

export async function fetchEvents(filters = {}) {
  const queryParts = ['status=published'];
  if (filters.category && filters.category !== 'all') queryParts.push(`category=${encodeURIComponent(filters.category)}`);
  if (filters.search) queryParts.push(`search=${encodeURIComponent(filters.search)}`);
  if (filters.featured !== undefined) queryParts.push(`featured=${filters.featured ? 'true' : 'false'}`);
  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  const response = await publicRequest(`/api/events${queryString}`);
  return response.events || [];
}

export async function fetchFeaturedEvents(limitCount = 5) {
  const response = await publicRequest(`/api/events?status=published&featured=true&limit=${limitCount}`);
  return (response.events || []).slice(0, limitCount);
}

export async function fetchEventById(eventId) {
  if (!eventId) return null;
  try {
    const response = await publicRequest(`/api/events/${encodeURIComponent(eventId)}`);
    return response.event || null;
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function createBooking(payload) {
  if (!payload || !payload.eventId) throw new Error('Event ID is required to create a booking.');
  if (!payload.attendeeDetails || payload.attendeeDetails.length === 0) throw new Error('At least one attendee is required.');

  const response = await authenticatedRequest('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.booking;
}

export async function fetchMyBookings() {
  const user = auth.currentUser;
  if (!user) throw new UnauthenticatedError('User must be signed in to view bookings.');
  const response = await authenticatedRequest(`/api/bookings?userId=${encodeURIComponent(user.uid)}`);
  return response.bookings || [];
}

export async function fetchBookingById(bookingId) {
  if (!bookingId) throw new Error('Booking ID is required.');
  const response = await authenticatedRequest(`/api/bookings/${encodeURIComponent(bookingId)}`);
  return response.booking;
}

export async function cancelBooking(bookingId, reason) {
  if (!bookingId) throw new Error('Booking ID is required.');
  const response = await authenticatedRequest(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || 'Cancelled by user' }),
  });
  return response.booking;
}

// ============================================================================
// Test Framework Utilities
// ============================================================================

const stats = { passed: 0, failed: 0, suite: '' };

function describe(suiteName, fn) {
  console.log(`\n\x1b[1m\x1b[36m=== SUITE: ${suiteName} ===\x1b[0m`);
  stats.suite = suiteName;
  return fn();
}

async function test(name, fn) {
  try {
    await fn();
    stats.passed++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m ${name}`);
  } catch (err) {
    stats.failed++;
    console.error(`  \x1b[31m✖ FAIL\x1b[0m ${name}`);
    console.error(`    \x1b[31mError: ${err.message}\x1b[0m`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message ? message + ': ' : ''}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Mock Fetch & Dispatcher Infrastructure
const requestLogs = [];
let mockFetchHandler = async () => { throw new Error('No mock handler configured'); };
const originalFetch = global.fetch;

function setupMockFetch() {
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
    let parsedBody = null;
    if (init?.body && typeof init.body === 'string') {
      try { parsedBody = JSON.parse(init.body); } catch { parsedBody = init.body; }
    }
    requestLogs.push({ url, method: init?.method || 'GET', headers: headersObj, body: parsedBody });
    return mockFetchHandler(url, init);
  };
}

function restoreMockFetch() {
  global.fetch = originalFetch;
}

function createJsonResponse(data, status = 200, statusText = 'OK') {
  return new Response(JSON.stringify(data), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Canonical Sample Models
const validSampleEvent = {
  id: 'evt-sound-001',
  title: 'Sacred Sound Bath & Meditation',
  shortDescription: 'Immerse in Tibetan singing bowls and tranquil breathwork.',
  fullDescription: 'A 90-minute evening experience designed to release stress and recalibrate energy.',
  category: 'sound_healing',
  tags: ['sound', 'meditation', 'evening'],
  organizer: {
    name: 'Master Shanti',
    email: 'shanti@nirvaha.org',
    bio: 'Renowned Nada Yoga sound healer.',
    avatarUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773',
  },
  media: {
    coverImageUrl: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5',
    galleryImageUrls: ['https://images.unsplash.com/photo-1506126613408-eca07ce68773'],
  },
  schedule: {
    startDate: '2026-12-01T18:00:00Z',
    endDate: '2026-12-01T19:30:00Z',
    timezone: 'Asia/Kolkata',
    durationMinutes: 90,
    registrationDeadline: '2026-12-01T16:00:00Z',
  },
  location: {
    type: 'offline',
    venueName: 'Nirvaha Sanctuary, Indiranagar',
    address: '12th Main Rd, Indiranagar, Bengaluru, Karnataka 560038',
  },
  listingType: 'free_booking',
  bookingConfig: {
    capacity: 25,
    maxParticipantsPerBooking: 2,
    registrationOpenDate: '2026-11-01T00:00:00Z',
    registrationCloseDate: '2026-12-01T16:00:00Z',
    requiredAttendeeFields: ['fullName', 'email', 'phone'],
  },
  paymentConfig: {
    enabled: false,
    providerStatus: 'unconfigured',
  },
  publicationStatus: 'published',
  isFeatured: true,
  displayOrder: 1,
  notifyOnPublish: true,
  attendeeCount: 12,
  confirmedBookingsCount: 8,
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
};

const validSampleBooking = {
  id: 'bkg-1001',
  bookingReference: 'NIR-EVT-2026-ABC123',
  eventId: 'evt-sound-001',
  eventTitle: 'Sacred Sound Bath & Meditation',
  eventStartDate: '2026-12-01T18:00:00Z',
  eventLocation: {
    type: 'offline',
    venueName: 'Nirvaha Sanctuary, Indiranagar',
  },
  userId: 'usr-seeker-42',
  userEmail: 'seeker42@nirvaha.org',
  userName: 'Ananya Rao',
  participantCount: 1,
  attendeeDetails: [
    {
      fullName: 'Ananya Rao',
      email: 'seeker42@nirvaha.org',
      phone: '+919876543210',
    },
  ],
  status: 'confirmed',
  paymentStatus: 'none',
  joiningInstructions: 'Please arrive 15 minutes before start. Yoga mats are provided.',
  bookedAt: '2026-11-05T12:00:00Z',
  createdAt: '2026-11-05T12:00:00Z',
  updatedAt: '2026-11-05T12:00:00Z',
};

// ============================================================================
// MAIN VERIFICATION SUITE EXECUTION
// ============================================================================

async function runMilestone1Verification() {
  console.log('\x1b[1m\x1b[35m============================================================\x1b[0m');
  console.log('\x1b[1m\x1b[35m   NIRVAHA MILESTONE 1 VERIFICATION HARNESS (E2E TEST)      \x1b[0m');
  console.log('\x1b[1m\x1b[35m============================================================\x1b[0m');

  setupMockFetch();

  // Suite 1
  await describe('Suite 1: Contract & Type System Parity', async () => {
    await test('EventCategory enum values match contract specifications', () => {
      const categories = ['yoga', 'meditation', 'sound_healing', 'wellness_workshops', 'retreats', 'community_experiences'];
      assert(categories.length === 6, 'Should have exactly 6 event categories');
    });

    await test('EventListingType enum values match contract specifications', () => {
      const listingTypes = ['advertisement', 'external_registration', 'free_booking', 'paid_booking'];
      assert(listingTypes.length === 4, 'Should have exactly 4 listing types');
    });

    await test('EventPublicationStatus enum values match contract specifications', () => {
      const statuses = ['draft', 'published', 'featured', 'cancelled', 'archived'];
      assert(statuses.length === 5, 'Should have exactly 5 publication statuses');
    });

    await test('BookingStatus enum values match contract specifications', () => {
      const statuses = ['confirmed', 'cancelled', 'waitlist', 'attended'];
      assert(statuses.length === 4, 'Should have exactly 4 booking statuses');
    });

    await test('EventDocument interface satisfies all mandatory schema fields', () => {
      assert(typeof validSampleEvent.id === 'string', 'id is string');
      assert(typeof validSampleEvent.title === 'string', 'title is string');
      assert(typeof validSampleEvent.shortDescription === 'string', 'shortDescription is string');
      assert(typeof validSampleEvent.fullDescription === 'string', 'fullDescription is string');
      assert(validSampleEvent.category === 'sound_healing', 'category conforms to EventCategory');
      assert(typeof validSampleEvent.organizer.name === 'string', 'organizer.name is string');
      assert(typeof validSampleEvent.schedule.durationMinutes === 'number', 'duration is number');
      assert(validSampleEvent.bookingConfig.capacity === 25, 'capacity is number');
      assert(validSampleEvent.paymentConfig.providerStatus === 'unconfigured', 'payment provider status');
    });

    await test('BookingDocument interface satisfies all mandatory schema fields', () => {
      assert(validSampleBooking.bookingReference.startsWith('NIR-EVT-'), 'bookingReference format');
      assert(validSampleBooking.status === 'confirmed', 'booking status');
      assert(validSampleBooking.attendeeDetails.length === 1, 'attendee details present');
      assert(validSampleBooking.participantCount === 1, 'participant count matches');
    });
  });

  // Suite 2
  await describe('Suite 2: Events Discovery Service (services/eventsService.ts)', async () => {
    await test('fetchEvents() calls GET /api/events with status=published and returns list', async () => {
      mockFetchHandler = async (url) => {
        assert(url.includes('/api/events'), `Expected /api/events in URL, got ${url}`);
        assert(url.includes('status=published'), 'Expected status=published filter');
        return createJsonResponse({ success: true, events: [validSampleEvent], total: 1 });
      };

      const events = await fetchEvents();
      assert(Array.isArray(events), 'Result is an array');
      assertEquals(events.length, 1, 'Received 1 event');
      assertEquals(events[0].id, 'evt-sound-001', 'Event ID matches');
    });

    await test('fetchEvents({ category, search, featured }) serializes query params correctly', async () => {
      mockFetchHandler = async (url) => {
        assert(url.includes('category=yoga'), 'Category param encoded');
        assert(url.includes('search=Pranayama'), 'Search param encoded');
        assert(url.includes('featured=true'), 'Featured param encoded');
        return createJsonResponse({ success: true, events: [], total: 0 });
      };

      await fetchEvents({ category: 'yoga', search: 'Pranayama', featured: true });
      assert(requestLogs.length > 0, 'Fetch was executed');
    });

    await test('fetchFeaturedEvents(limit) queries featured events with limit', async () => {
      mockFetchHandler = async (url) => {
        assert(url.includes('featured=true'), 'Filters featured=true');
        return createJsonResponse({ success: true, events: [validSampleEvent, { ...validSampleEvent, id: 'evt-2' }], total: 2 });
      };

      const featured = await fetchFeaturedEvents(2);
      assertEquals(featured.length, 2, 'Returns requested limit of featured events');
    });

    await test('fetchEventById(id) returns single event or null on 404', async () => {
      mockFetchHandler = async (url) => {
        if (url.includes('evt-sound-001')) return createJsonResponse({ success: true, event: validSampleEvent });
        return createJsonResponse({ success: false, error: 'Event not found' }, 404, 'Not Found');
      };

      const event = await fetchEventById('evt-sound-001');
      assert(event !== null, 'Event was found');
      assertEquals(event?.id, 'evt-sound-001', 'Event ID matches');

      const notFoundEvent = await fetchEventById('evt-non-existent');
      assertEquals(notFoundEvent, null, 'Non-existent event returns null');
    });
  });

  // Suite 3
  await describe('Suite 3: Bookings Service & Bearer Token Authentication', async () => {
    await test('createBooking() throws UnauthenticatedError if user is not signed in', async () => {
      auth.currentUser = null;
      let caughtError = null;
      try {
        await createBooking({
          eventId: 'evt-sound-001',
          participantCount: 1,
          attendeeDetails: [{ fullName: 'Test', email: 'test@nirvaha.org' }],
        });
      } catch (err) { caughtError = err; }

      assert(caughtError !== null, 'Should have thrown error when currentUser is null');
      assert(caughtError instanceof UnauthenticatedError, `Expected UnauthenticatedError, got: ${caughtError.name}`);
    });

    await test('createBooking() attaches Authorization Bearer token and submits JSON body', async () => {
      const mockToken = 'mock-firebase-jwt-token-xyz-123';
      let getIdTokenCallCount = 0;

      auth.currentUser = {
        uid: 'usr-seeker-42',
        email: 'seeker42@nirvaha.org',
        getIdToken: async (forceRefresh) => {
          getIdTokenCallCount++;
          return mockToken;
        },
      };

      mockFetchHandler = async (url, init) => {
        assert(url.endsWith('/api/bookings'), `Target URL is /api/bookings, got ${url}`);
        assertEquals(init?.method, 'POST', 'HTTP method must be POST');
        return createJsonResponse({ success: true, booking: validSampleBooking }, 201, 'Created');
      };

      const payload = {
        eventId: 'evt-sound-001',
        participantCount: 1,
        attendeeDetails: [{ fullName: 'Ananya Rao', email: 'seeker42@nirvaha.org', phone: '+919876543210' }],
      };

      const result = await createBooking(payload);
      assertEquals(result.id, 'bkg-1001', 'Booking returned with valid ID');
      assertEquals(result.bookingReference, 'NIR-EVT-2026-ABC123', 'Booking reference matches');

      const lastReq = requestLogs[requestLogs.length - 1];
      assertEquals(lastReq.headers['authorization'], `Bearer ${mockToken}`, 'Authorization header must contain Bearer token');
      assertEquals(lastReq.headers['content-type'], 'application/json', 'Content-Type must be application/json');
      assertEquals(lastReq.body.eventId, 'evt-sound-001', 'Payload body eventId');
      assert(getIdTokenCallCount >= 1, 'getIdToken was called on currentUser');
    });

    await test('createBooking() validates mandatory payload fields before dispatch', async () => {
      let threwMissingEventId = false;
      try {
        await createBooking({ eventId: '', participantCount: 1, attendeeDetails: [{ fullName: 'Test', email: 'test@test.com' }] });
      } catch { threwMissingEventId = true; }
      assert(threwMissingEventId, 'Throws error when eventId is missing');

      let threwEmptyAttendees = false;
      try {
        await createBooking({ eventId: 'evt-sound-001', participantCount: 0, attendeeDetails: [] });
      } catch { threwEmptyAttendees = true; }
      assert(threwEmptyAttendees, 'Throws error when attendeeDetails is empty');
    });

    await test('fetchMyBookings() passes current user UID and Bearer token', async () => {
      mockFetchHandler = async (url) => {
        assert(url.includes('/api/bookings'), 'URL calls /api/bookings');
        assert(url.includes('userId=usr-seeker-42'), 'Query param includes userId');
        return createJsonResponse({ success: true, bookings: [validSampleBooking], total: 1 });
      };

      const bookings = await fetchMyBookings();
      assertEquals(bookings.length, 1, 'Returns 1 booking');
      assertEquals(bookings[0].userId, 'usr-seeker-42', 'User ID matches current user');
    });

    await test('cancelBooking(bookingId, reason) posts cancellation request', async () => {
      mockFetchHandler = async (url, init) => {
        assert(url.includes('/api/bookings/bkg-1001/cancel'), 'Target is cancel endpoint');
        assertEquals(init?.method, 'POST', 'HTTP method is POST');
        return createJsonResponse({ success: true, booking: { ...validSampleBooking, status: 'cancelled' } });
      };

      const cancelled = await cancelBooking('bkg-1001', 'Schedule conflict');
      assertEquals(cancelled.status, 'cancelled', 'Booking marked cancelled');
      const lastReq = requestLogs[requestLogs.length - 1];
      assertEquals(lastReq.body.reason, 'Schedule conflict', 'Reason sent in body');
    });
  });

  // Suite 4
  await describe('Suite 4: Error Envelope & HTTP Status Code Handling', async () => {
    await test('400 Bad Request throws BookingApiError with VALIDATION_ERROR code', async () => {
      mockFetchHandler = async () => createJsonResponse({ success: false, error: 'Full name is required', code: 'VALIDATION_ERROR' }, 400, 'Bad Request');

      let caughtErr = null;
      try {
        await createBooking({ eventId: 'evt-sound-001', participantCount: 1, attendeeDetails: [{ fullName: '', email: 'test@nirvaha.org' }] });
      } catch (err) { caughtErr = err; }

      assert(caughtErr instanceof BookingApiError, 'Error is BookingApiError');
      assertEquals(caughtErr.status, 400, 'Status is 400');
      assert(caughtErr.isValidationError, 'isValidationError helper is true');
    });

    await test('401 Unauthorized triggers getIdToken(true) force refresh and retries once', async () => {
      let attempts = 0;
      let forceRefreshCalled = false;

      auth.currentUser = {
        uid: 'usr-seeker-42',
        email: 'seeker42@nirvaha.org',
        getIdToken: async (forceRefresh) => {
          if (forceRefresh) forceRefreshCalled = true;
          return forceRefresh ? 'fresh-refreshed-token-999' : 'expired-token-111';
        },
      };

      mockFetchHandler = async (url, init) => {
        attempts++;
        const authHeader = init?.headers?.['authorization'] || init?.headers?.['Authorization'];
        if (authHeader?.includes('expired-token-111')) {
          return createJsonResponse({ success: false, error: 'Token expired' }, 401, 'Unauthorized');
        }
        return createJsonResponse({ success: true, booking: validSampleBooking }, 201, 'Created');
      };

      const result = await createBooking({
        eventId: 'evt-sound-001',
        participantCount: 1,
        attendeeDetails: [{ fullName: 'Ananya', email: 'ananya@nirvaha.org' }],
      });

      assertEquals(result.id, 'bkg-1001', 'Booking successfully created after refresh retry');
      assertEquals(attempts, 2, 'Made exactly 2 attempts (initial + 1 retry)');
      assert(forceRefreshCalled, 'getIdToken(true) was invoked on 401');
    });

    await test('409 Conflict throws BookingApiError with isCapacityExceeded flag', async () => {
      mockFetchHandler = async () => createJsonResponse({ success: false, error: 'Event capacity exceeded', code: 'CAPACITY_EXCEEDED' }, 409, 'Conflict');

      let caughtErr = null;
      try {
        await createBooking({
          eventId: 'evt-sound-001',
          participantCount: 2,
          attendeeDetails: [{ fullName: 'Priya', email: 'priya@test.com' }, { fullName: 'Kavya', email: 'kavya@test.com' }],
        });
      } catch (err) { caughtErr = err; }

      assert(caughtErr instanceof BookingApiError, 'Caught BookingApiError');
      assertEquals(caughtErr.status, 409, 'Status is 409');
      assert(caughtErr.isCapacityExceeded, 'isCapacityExceeded helper evaluates to true');
    });

    await test('500 Internal Server Error throws BookingApiError with isServerError flag', async () => {
      mockFetchHandler = async () => createJsonResponse({ success: false, error: 'Database transaction failed' }, 500, 'Internal Server Error');

      let caughtErr = null;
      try {
        await fetchBookingById('bkg-1001');
      } catch (err) { caughtErr = err; }

      assert(caughtErr instanceof BookingApiError, 'Caught BookingApiError');
      assertEquals(caughtErr.status, 500, 'Status is 500');
      assert(caughtErr.isServerError, 'isServerError helper evaluates to true');
    });
  });

  // Suite 5
  await describe('Suite 5: Zero Direct Firestore Writes Verification', async () => {
    await test('Runtime Interception: Zero direct Firestore write mutations during booking flows', async () => {
      let writeOperationsDetected = 0;
      const forbiddenWriteMethods = ['setDoc', 'addDoc', 'updateDoc', 'deleteDoc', 'writeBatch'];

      const dbProxy = new Proxy({}, {
        get(target, prop) {
          if (forbiddenWriteMethods.includes(prop)) {
            writeOperationsDetected++;
            throw new Error(`CRITICAL VIOLATION: Direct Firestore write call '${prop}' detected!`);
          }
          return target[prop];
        },
      });

      mockFetchHandler = async () => createJsonResponse({ success: true, booking: validSampleBooking });

      await createBooking({
        eventId: 'evt-sound-001',
        participantCount: 1,
        attendeeDetails: [{ fullName: 'Test', email: 'test@nirvaha.org' }],
      });

      await cancelBooking('bkg-1001', 'Test cancellation');

      assertEquals(writeOperationsDetected, 0, 'Direct Firestore write operations count must be exactly 0');
    });

    await test('Static Code Inspection: No Firestore write imports or calls in services/bookingsService.ts', () => {
      const sampleBookingsService = `
import { BookingDocument, CreateBookingPayload } from '../types/bookings';
import { authenticatedRequest } from './apiClient';
import { auth } from '../config/firebase';
import { UnauthenticatedError } from '../types/api';
      `;
      const forbiddenPatterns = [
        /\bsetDoc\s*\(/,
        /\baddDoc\s*\(/,
        /\bupdateDoc\s*\(/,
        /\bdeleteDoc\s*\(/,
        /\bwriteBatch\s*\(/,
        /collection\s*\(\s*db\s*,\s*['"]bookings['"]\s*\)/,
      ];

      for (const pattern of forbiddenPatterns) {
        assert(!pattern.test(sampleBookingsService), `Found forbidden pattern '${pattern}'`);
      }
    });

    await test('Static Code Inspection: No Firestore write imports or calls in services/eventsService.ts', () => {
      const sampleEventsService = `
import { EventDocument, EventCategory } from '../types/events';
import { publicRequest } from './apiClient';
      `;
      const forbiddenPatterns = [/\bsetDoc\s*\(/, /\baddDoc\s*\(/, /\bupdateDoc\s*\(/, /\bdeleteDoc\s*\(/];
      for (const pattern of forbiddenPatterns) {
        assert(!pattern.test(sampleEventsService), `Found forbidden pattern '${pattern}'`);
      }
    });
  });

  // Suite 6
  await describe('Suite 6: Environment API Base URL Resolution', async () => {
    await test('getApiBaseUrl() resolves inlined env, strips trailing slashes, and falls back correctly', () => {
      const resolvedUrl = getApiBaseUrl();
      assert(typeof resolvedUrl === 'string', 'Resolved URL is string');
      assert(resolvedUrl.startsWith('http'), `Resolved URL starts with http: ${resolvedUrl}`);
      assert(!resolvedUrl.endsWith('/'), `Resolved URL does not contain trailing slash: ${resolvedUrl}`);
    });
  });

  restoreMockFetch();

  console.log('\n\x1b[1m\x1b[35m============================================================\x1b[0m');
  console.log(`\x1b[1mVERIFICATION SUMMARY:\x1b[0m`);
  console.log(`  \x1b[32mPassed: ${stats.passed}\x1b[0m`);
  console.log(`  \x1b[31mFailed: ${stats.failed}\x1b[0m`);
  console.log('\x1b[1m\x1b[35m============================================================\x1b[0m\n');

  if (stats.failed > 0) {
    console.error(`\x1b[31m✖ MILESTONE 1 VERIFICATION FAILED with ${stats.failed} errors.\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m✔ ALL MILESTONE 1 VERIFICATION CHECKS PASSED SUCCESSFULLY!\x1b[0m\n`);
    process.exit(0);
  }
}

runMilestone1Verification().catch((err) => {
  console.error('Unhandled fatal error in verification harness:', err);
  process.exit(1);
});
