# Milestone 1 Investigation Report: API Robustness, Error Handling & Security

**Agent**: `explorer_m1_2`  
**Date**: 2026-11-05  
**Target Codebase**: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`  
**Backend/Admin Codebase**: `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha`  
**Related Contract**: `NIRVAHA_EVENTS_BOOKING_CONTRACT.md` (v1.0.0)

---

## 1. Observation

### 1.1 Target Mobile Environment & Dependencies
Inspected `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\package.json`:
- Expo SDK: `~54.0.36`
- React Native: `0.81.5`
- React: `19.1.0`
- Firebase JS SDK: `^12.12.1`
- Expo Router: `~6.0.24` (with `typedRoutes: true`)
- Expo Constants: `~18.0.13`

### 1.2 Existing Firebase & Auth Configuration
Inspected `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\config\firebase.ts`:
- Lines 13-15:
  ```typescript
  const expoExtra = Constants.expoConfig?.extra as
    | Record<string, string>
    | undefined;
  ```
- Lines 17-40: Configuration utilizes fallback chain:
  `expoExtra?.EXPO_PUBLIC_FIREBASE_* ?? process.env.EXPO_PUBLIC_FIREBASE_*`
- Lines 50-66: `auth` is initialized with platform persistence (`AsyncStorage` on native, standard memory/indexedDB on web) and exported alongside `db` (`getFirestore(app)`).
- `auth.currentUser` is a standard Firebase `User | null` object supporting `.getIdToken(forceRefresh?: boolean)`.

Inspected `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\contexts\AuthContext.tsx`:
- Provides `user: User | null` via React Context listening to `onAuthStateChanged(auth, ...)`.
- When user is logged in, `user.uid`, `user.email`, and `user.displayName` are available.

### 1.3 Environmental Variables & Expo Config Extra
Inspected `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\app.config.js`:
- Lines 89-102:
  ```javascript
  extra: {
    eas: {
      projectId: "fee74e4b-51d9-4c95-a160-c11d63160417"
    },
    "EXPO_PUBLIC_API_BASE_URL": process.env.EXPO_PUBLIC_API_BASE_URL || "",
    "EXPO_PUBLIC_FIREBASE_API_KEY": process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
    ...
  }
  ```
Inspected `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\.env`:
- Line 10:
  ```env
  EXPO_PUBLIC_API_BASE_URL=https://backend-six-lac-91.vercel.app
  ```

### 1.4 Team 1 Backend API & Auth Pattern
Inspected `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\app\api\auth\verify\route.ts`:
- Lines 17-25: Expects HTTP Header `Authorization: Bearer <token>`. Returns `401 Unauthorized` with `{ authorized: false, error: 'Missing or invalid Authorization header' }` if absent.
- Lines 28-37: Verifies token with `adminAuth.verifyIdToken(token)`. Returns `401` on invalid/expired token, `400` on missing email in token payload.
- Line 55-59: Returns `403 Forbidden` if unauthorized.
- Lines 9-14: Returns `500 Internal Server Error` if Firebase Admin SDK is unconfigured.

### 1.5 Canonical API Contract Specifications
From `NIRVAHA_EVENTS_BOOKING_CONTRACT.md`:
- `GET /api/events` — Query params: `category`, `search`, `featured`, `status=published`. Returns `{ success: true, events: EventDocument[], total: number }`.
- `GET /api/events/[id]` — Returns `{ success: true, event: EventDocument }`.
- `POST /api/bookings` — Auth: `Authorization: Bearer <id_token>`. Body: `{ eventId, participantCount, attendeeDetails }`. Returns `{ success: true, booking: BookingDocument }` (201 Created). Returns 409 Conflict if capacity exceeded.
- `GET /api/bookings` — Auth: `Authorization: Bearer <id_token>`. Query params: `userId`. Returns `{ success: true, bookings: BookingDocument[], total: number }`. Non-admins only access own bookings.
- `GET /api/bookings/[id]` — Auth: `Authorization: Bearer <id_token>`. Returns `{ success: true, booking: BookingDocument }`. Enforces user ownership (403 if mismatch).
- `POST /api/bookings/[id]/cancel` — Auth: `Authorization: Bearer <id_token>`. Body: `{ reason }`. Decrements attendee count atomically. Returns `{ success: true, booking: BookingDocument }`.

---

## 2. Logic Chain

1. **Environmental Resolution**:
   - In Expo SDK 54, `process.env.EXPO_PUBLIC_*` variables are statically inlined by Metro at build time.
   - However, in runtime contexts (such as Expo Go, EAS dynamic updates, or custom environments), `Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL` is the official configuration container populated by `app.config.js`.
   - Furthermore, if neither is set (e.g. running in an unexpected shell or preview build where `.env` was omitted), falling back to the canonical production URL `https://backend-six-lac-91.vercel.app` ensures the app never throws an undefined URL error or attempts network calls against `""` or `undefined/api/...`.
   - String sanitation (trimming whitespace and removing trailing slashes) is essential to avoid double slashes (`https://backend...//api/events`).

2. **Token Acquisition & Expiration Dynamics**:
   - `auth.currentUser` is synchronous in Firebase JS SDK v12 once initialized.
   - Calling `auth.currentUser.getIdToken(false)` retrieves a valid unexpired token from local cache, or automatically refreshes it from Google's token service if within ~5 minutes of expiration.
   - If `auth.currentUser` is `null` when an authenticated API call (`createBooking`, `fetchMyBookings`, `cancelBooking`) is attempted, sending the request is guaranteed to fail with 401 on the backend. Raising a specialized `UnauthenticatedError` client-side before dispatching the HTTP request avoids unnecessary latency, saves battery, and gives caller screens clear semantics to trigger a sign-in modal.
   - If a request fails with HTTP 401 (token expired mid-session or invalidated), calling `auth.currentUser.getIdToken(true)` forces a server-side token refresh. Retrying the request once handles transparent session recovery.
   - A single-retry guard (`retryCount < 1`) prevents infinite recursion if credentials are fundamentally invalid.

3. **HTTP Status Code Mapping & Domain Semantics**:
   - **400 Bad Request**: Payload or attendee field validation failure (`VALIDATION_ERROR`). Form should display field-level errors rather than a generic network crash banner.
   - **401 Unauthorized**: Authentication token missing, invalid, or expired (`UNAUTHORIZED`). Triggers token refresh and retry; if persistent, prompts user login.
   - **403 Forbidden**: Ownership or role mismatch (`FORBIDDEN`). User attempted to view or cancel someone else's booking. UI shows "You do not have permission to view or manage this booking."
   - **404 Not Found**: Resource does not exist (`NOT_FOUND`). Event or booking does not exist. UI renders dedicated empty/not-found state.
   - **409 Conflict**: Capacity exceeded or duplicate booking (`CAPACITY_EXCEEDED` or `DUPLICATE_BOOKING`). Event was filled concurrently during Firestore transaction, or user is already registered. In-flight registration must be unlocked, and UI updated to reflect sold-out or already-booked state.
   - **500 / 502 / 503 / 504**: Transient server or cloud gateway failure (`SERVER_ERROR`). UI displays retry button with user-friendly error message.

4. **Network & Timeout Robustness**:
   - React Native fetch does not timeout automatically by default, which can cause loading spinners to spin indefinitely on cellular dead zones or captive portals.
   - Wrapping fetch in an `AbortController` with a 15-second timeout converts hung requests into a typed `TimeoutError` that informs the user and allows retry.
   - Response parsing must safely inspect `Content-Type` before calling `response.json()` to avoid throwing syntax errors when HTML error pages (e.g. Vercel 504 Gateway Timeout) are returned.

---

## 3. Caveats

- **No Caveats** regarding endpoint contracts or authentication methods: specifications match `NIRVAHA_EVENTS_BOOKING_CONTRACT.md`.
- **Paid Booking Provider**: Payment config provider status is `unconfigured` currently. The client must never attempt real payment processing until Team 1 confirms credentials; `Book Now` primary action must remain disabled with informative badge per contract Section 2.
- **Physical Device Localhost**: When developing on physical Android devices, `localhost` does not resolve to the development machine. Team 1's live Vercel endpoint (`https://backend-six-lac-91.vercel.app`) should remain the default fallback.

---

## 4. Conclusion & Concrete Implementation Recommendations

To ensure maximum robustness, type safety, and clean separation of concerns, the following architectural components should be created in `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`:

1. `types/api.ts` — Comprehensive error classes and response wrappers.
2. `services/apiClient.ts` — Resilient HTTP client with URL resolution, token auto-injection, 401 retry, 15s timeout, and safe response parsing.
3. `services/eventsService.ts` — Public discovery query methods (`fetchEvents`, `fetchFeaturedEvents`, `fetchEventById`).
4. `services/bookingsService.ts` — Authenticated booking mutation and retrieval methods (`createBooking`, `fetchMyBookings`, `fetchBookingById`, `cancelBooking`).

### 4.1 Recommended Implementation: `types/api.ts`

```typescript
/**
 * Types & Error Classes for Nirvaha API Client
 */

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CAPACITY_EXCEEDED'
  | 'DUPLICATE_BOOKING'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'UNKNOWN_ERROR';

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: ApiErrorCode | string;
  details?: Record<string, any>;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data?: T;
  [key: string]: any;
}

/**
 * Custom error thrown when backend returns a non-2xx HTTP status.
 */
export class BookingApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | string;
  readonly details?: Record<string, any>;

  constructor(
    status: number,
    code: ApiErrorCode | string,
    message: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'BookingApiError';
    this.status = status;
    this.code = code;
    this.details = details;

    // Maintains proper stack trace in V8 / Hermes
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BookingApiError);
    }
  }

  get isCapacityExceeded(): boolean {
    return this.status === 409 || this.code === 'CAPACITY_EXCEEDED';
  }

  get isDuplicateBooking(): boolean {
    return this.code === 'DUPLICATE_BOOKING';
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.code === 'UNAUTHORIZED';
  }

  get isForbidden(): boolean {
    return this.status === 403 || this.code === 'FORBIDDEN';
  }

  get isNotFound(): boolean {
    return this.status === 404 || this.code === 'NOT_FOUND';
  }

  get isValidationError(): boolean {
    return this.status === 400 || this.code === 'VALIDATION_ERROR';
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

/**
 * Thrown when network connection fails (offline, DNS, socket drop).
 */
export class NetworkError extends Error {
  readonly originalError?: unknown;

  constructor(message = 'Network connection failed. Please check your internet connection.', originalError?: unknown) {
    super(message);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

/**
 * Thrown when an HTTP request exceeds the configured timeout threshold.
 */
export class TimeoutError extends NetworkError {
  constructor(message = 'Request timed out. Please try again.') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Thrown locally before calling API when an action requires authentication but currentUser is null.
 */
export class UnauthenticatedError extends Error {
  constructor(message = 'You must be signed in to perform this action.') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}
```

---

### 4.2 Recommended Implementation: `services/apiClient.ts`

```typescript
import Constants from 'expo-constants';
import { auth } from '../config/firebase';
import {
  BookingApiError,
  NetworkError,
  TimeoutError,
  UnauthenticatedError,
  ApiErrorCode,
} from '../types/api';

const DEFAULT_BACKEND_URL = 'https://backend-six-lac-91.vercel.app';
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Resolves API Base URL with prioritized fallback:
 * 1. process.env.EXPO_PUBLIC_API_BASE_URL (Metro inlined)
 * 2. Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL (Expo config)
 * 3. Default production URL (https://backend-six-lac-91.vercel.app)
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return sanitizeUrl(envUrl.trim());
  }

  const extra = Constants.expoConfig?.extra as Record<string, any> | undefined;
  const extraUrl = extra?.EXPO_PUBLIC_API_BASE_URL;
  if (typeof extraUrl === 'string' && extraUrl.trim().length > 0) {
    return sanitizeUrl(extraUrl.trim());
  }

  return sanitizeUrl(DEFAULT_BACKEND_URL);
}

function sanitizeUrl(url: string): string {
  let cleaned = url.trim();
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned.replace(/\/+$/, '');
}

/**
 * Map HTTP status code to canonical ApiErrorCode
 */
function mapStatusToCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CAPACITY_EXCEEDED';
    default:
      if (status >= 500) return 'SERVER_ERROR';
      return 'UNKNOWN_ERROR';
  }
}

/**
 * Safely parse HTTP response (JSON or plain text) and extract error or payload.
 */
async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  let body: any = null;
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

  return body as T;
}

/**
 * Fetch wrapper with timeout abort control
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new TimeoutError(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw new NetworkError(err.message || 'Network request failed', err);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executes a public HTTP request without auth headers.
 */
export async function publicRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetchWithTimeout(url, { ...options, headers }, timeoutMs);
  return parseResponse<T>(response);
}

/**
 * Executes an authenticated HTTP request with automatic Bearer token injection and 401 refresh retry.
 */
export async function authenticatedRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    throw new UnauthenticatedError('User must be signed in to perform this action.');
  }

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // 1. Acquire current valid token
  let token = await user.getIdToken(false);

  const makeHeaders = (bearer: string) => ({
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

  // 2. Token refresh & single-retry on 401 Unauthorized
  if (response.status === 401) {
    try {
      token = await user.getIdToken(true); // Force token refresh
      response = await fetchWithTimeout(
        url,
        { ...options, headers: makeHeaders(token) },
        timeoutMs
      );
    } catch (refreshErr) {
      throw new BookingApiError(401, 'UNAUTHORIZED', 'Session expired. Please sign in again.');
    }
  }

  return parseResponse<T>(response);
}
```

---

### 4.3 Recommended Implementation: `services/eventsService.ts`

```typescript
import { EventDocument, EventCategory } from '../types/events';
import { publicRequest } from './apiClient';

export interface FetchEventsFilters {
  category?: EventCategory | string;
  search?: string;
  featured?: boolean;
}

interface EventsApiResponse {
  success: boolean;
  events: EventDocument[];
  total: number;
}

interface EventApiResponse {
  success: boolean;
  event: EventDocument;
}

/**
 * Fetches published events matching optional search and category filters.
 */
export async function fetchEvents(filters?: FetchEventsFilters): Promise<EventDocument[]> {
  const queryParts: string[] = ['status=published'];

  if (filters?.category && filters.category !== 'all') {
    queryParts.push(`category=${encodeURIComponent(filters.category)}`);
  }
  if (filters?.search && filters.search.trim().length > 0) {
    queryParts.push(`search=${encodeURIComponent(filters.search.trim())}`);
  }
  if (filters?.featured !== undefined) {
    queryParts.push(`featured=${filters.featured ? 'true' : 'false'}`);
  }

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  const response = await publicRequest<EventsApiResponse>(`/api/events${queryString}`);
  return response.events || [];
}

/**
 * Fetches featured events for rails and highlights.
 */
export async function fetchFeaturedEvents(limitCount = 5): Promise<EventDocument[]> {
  const response = await publicRequest<EventsApiResponse>(
    `/api/events?status=published&featured=true&limit=${limitCount}`
  );
  return (response.events || []).slice(0, limitCount);
}

/**
 * Fetches a single event by ID. Returns null if not found (404).
 */
export async function fetchEventById(eventId: string): Promise<EventDocument | null> {
  if (!eventId) return null;
  try {
    const response = await publicRequest<EventApiResponse>(`/api/events/${encodeURIComponent(eventId)}`);
    return response.event || null;
  } catch (err: any) {
    if (err.status === 404) {
      return null;
    }
    throw err;
  }
}
```

---

### 4.4 Recommended Implementation: `services/bookingsService.ts`

```typescript
import { BookingDocument, CreateBookingPayload } from '../types/bookings';
import { authenticatedRequest } from './apiClient';
import { auth } from '../config/firebase';
import { UnauthenticatedError } from '../types/api';

interface BookingApiResponse {
  success: boolean;
  booking: BookingDocument;
}

interface BookingsApiResponse {
  success: boolean;
  bookings: BookingDocument[];
  total: number;
}

/**
 * Submits a new booking to Team 1's backend.
 * Never writes directly to Cloud Firestore.
 */
export async function createBooking(payload: CreateBookingPayload): Promise<BookingDocument> {
  if (!payload.eventId) {
    throw new Error('Event ID is required to create a booking.');
  }
  if (!payload.attendeeDetails || payload.attendeeDetails.length === 0) {
    throw new Error('At least one attendee is required.');
  }

  const response = await authenticatedRequest<BookingApiResponse>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return response.booking;
}

/**
 * Fetches the authenticated user's own bookings.
 */
export async function fetchMyBookings(): Promise<BookingDocument[]> {
  const user = auth.currentUser;
  if (!user) {
    throw new UnauthenticatedError('User must be signed in to view bookings.');
  }

  const response = await authenticatedRequest<BookingsApiResponse>(
    `/api/bookings?userId=${encodeURIComponent(user.uid)}`
  );

  return response.bookings || [];
}

/**
 * Fetches a single booking by ID, enforcing user ownership.
 */
export async function fetchBookingById(bookingId: string): Promise<BookingDocument> {
  if (!bookingId) {
    throw new Error('Booking ID is required.');
  }

  const response = await authenticatedRequest<BookingApiResponse>(
    `/api/bookings/${encodeURIComponent(bookingId)}`
  );

  return response.booking;
}

/**
 * Cancels a booking with an optional reason.
 */
export async function cancelBooking(bookingId: string, reason?: string): Promise<BookingDocument> {
  if (!bookingId) {
    throw new Error('Booking ID is required.');
  }

  const response = await authenticatedRequest<BookingApiResponse>(
    `/api/bookings/${encodeURIComponent(bookingId)}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Cancelled by user' }),
    }
  );

  return response.booking;
}
```

---

## 5. Verification Method

### 5.1 Verification Commands
Once `worker_m1` implements the files in `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`:
1. **Type Check**:
   ```powershell
   npx tsc --noEmit
   ```
   *Expected outcome*: 0 TypeScript errors on `types/api.ts`, `services/apiClient.ts`, `services/eventsService.ts`, and `services/bookingsService.ts`.
2. **Build Export Check**:
   ```powershell
   npx expo export --platform web
   ```
   *Expected outcome*: Successful static bundle export without bundler syntax or missing export errors.
3. **Linter Check**:
   ```powershell
   npm run lint
   ```
   *Expected outcome*: Clean linting with zero unresolved errors.

### 5.2 Behavioral Test Assertions
To verify the robustness in automated or manual tests:
1. **Unauthenticated Access**: Calling `fetchMyBookings()` when `auth.currentUser === null` must immediately throw `UnauthenticatedError` without performing a network fetch.
2. **401 Token Refresh**: Simulating a 401 response on `authenticatedRequest` must trigger `auth.currentUser.getIdToken(true)` and retry the request once.
3. **409 Capacity Exceeded**: Server responding with status `409` and `{ error: 'Sold out', code: 'CAPACITY_EXCEEDED' }` must throw `BookingApiError` where `err.isCapacityExceeded === true`.
4. **Network Timeout**: An unresponsive endpoint must abort after 15,000ms and throw `TimeoutError`.
5. **URL Fallback Chain**: If `process.env.EXPO_PUBLIC_API_BASE_URL` is undefined, `getApiBaseUrl()` returns `https://backend-six-lac-91.vercel.app` with trailing slashes safely stripped.
