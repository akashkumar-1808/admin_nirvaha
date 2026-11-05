# Milestone 1 Code & Architecture Review Report

**Agent**: `reviewer_m1_1` (archetype: `teamwork_reviewer`, roles: `reviewer`, `critic`)  
**Date**: 2026-11-05T15:10:00Z  
**Target Repository**: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`  
**Working Directory**: `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\reviewer_m1_1`  
**Milestone**: M1 — Mobile Foundation & Backend Integration  
**Verdict**: **APPROVE**  
**Integrity Status**: **CLEAN (No Integrity Violations Detected)**

---

## 1. Observation

### 1.1 Review Scope & Work Products Examined
The implementation deliverables produced by `worker_m1` for Milestone 1 were evaluated against canonical requirements in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `NIRVAHA_EVENTS_BOOKING_CONTRACT.md`:

1. `NIRVAHA_EVENTS_BOOKING_CONTRACT.md`:
   - Exact parity with backend canonical contract `v1.0.0`.
   - Defines `EventDocument`, `BookingDocument`, `CreateBookingPayload`, listing types, publication statuses, location types, payment configurations, and Team 1 REST endpoints.

2. `types/events.ts`:
   - Enums: `EventCategory` (6 categories), `EventListingType` (4 types), `EventPublicationStatus` (5 statuses), `LocationType` ('online' | 'offline' | 'hybrid'), `PaymentProviderStatus` ('unconfigured' | 'pending' | 'active').
   - Models: `EventOrganizer`, `EventMedia`, `EventSchedule`, `EventLocation`, `EventBookingConfig`, `EventPaymentConfig`, `EventDocument`.
   - DTOs: `EventFilterParams`, `EventsApiResponse`, `EventDetailApiResponse`.
   - Computation helpers: `getComputedEventStatus(event: EventDocument): ComputedEventStatus` and `isEventBookable(event: EventDocument): boolean`.

3. `types/bookings.ts`:
   - Enums & types: `BookingStatus` ('confirmed' | 'cancelled' | 'waitlist' | 'attended'), `PaymentStatus` ('none' | 'pending' | 'paid' | 'refunded'), `AttendeeDetail`.
   - Models & DTOs: `BookingDocument`, `CreateBookingPayload`, `BookingApiResponse`, `BookingsListApiResponse`, `CancelBookingPayload`.
   - Error re-export: `BookingApiError` from `./api`.

4. `types/api.ts`:
   - Typed error hierarchy: `BookingApiError` (with getters `isCapacityExceeded`, `isDuplicateBooking`, `isUnauthorized`, `isForbidden`, `isNotFound`, `isValidationError`, `isServerError`), `NetworkError`, `TimeoutError`, `UnauthenticatedError`.
   - Envelopes: `ApiErrorCode`, `ApiErrorResponse`, `ApiSuccessResponse<T>`.

5. `services/apiClient.ts`:
   - `getApiBaseUrl()`: Prioritizes `process.env.EXPO_PUBLIC_API_BASE_URL` -> `Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL` -> canonical default `https://backend-six-lac-91.vercel.app` with protocol prepending and trailing slash trimming.
   - `fetchWithTimeout()`: Enforces 15,000ms timeout with `AbortController`, safely catching `AbortError` and mapping to `TimeoutError`.
   - `publicRequest<T>()`: Safe JSON/text response parsing, mapping non-2xx status to `BookingApiError`.
   - `authenticatedRequest<T>()`: Synchronously verifies `auth.currentUser`, injects `Authorization: Bearer <id_token>`, and transparently retries once upon receiving HTTP 401 using forced token refresh `getIdToken(true)`.

6. `services/eventsService.ts`:
   - `normalizeEventDocument()`: Sanitizes raw event documents from either HTTP JSON or Firestore DocumentSnapshots, converting dates into standard ISO-8601 strings and providing safe defaults.
   - `fetchEvents(filters)`: Primary query to `GET /api/events` with query serialization (`status=published`, `category`, `search`, `featured`), with automatic graceful fallback to Firestore client reads (`collection(db, 'events')`, `where('publicationStatus', 'in', ['published', 'featured'])`).
   - `fetchFeaturedEvents(limit)`: Queries featured events with default limit 5.
   - `fetchEventById(eventId)`: Queries `GET /api/events/[id]`, returning `null` on 404, with fallback to Firestore `doc(db, 'events', eventId)`.

7. `services/bookingsService.ts`:
   - Zero direct Firestore write mutations (`setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, `writeBatch`).
   - `createBooking(payload)`: Validates mandatory payload fields (`eventId`, `participantCount >= 1`, non-empty `attendeeDetails`), verifies authentication, and delegates mutation to `POST /api/bookings` with Bearer token.
   - `fetchMyBookings()`: Queries `GET /api/bookings?userId=${user.uid}` with Bearer token.
   - `fetchBookingById(bookingId)`: Queries `GET /api/bookings/[id]` with Bearer token.
   - `cancelBooking(bookingId, reason)`: Submits cancellation to `POST /api/bookings/[id]/cancel` with `{ reason }` and Bearer token.

8. `scratch/verify_m1_foundation.ts`:
   - 6 verification test suites (18 assertions) covering type parity, discovery queries, booking mutation flows, Bearer token propagation, 401 token refresh retry, 409 capacity conflict, zero Firestore write static & runtime interception, and URL resolution.

### 1.2 Verification Outputs Observed
- **Build / Bundler Verification**: `npx expo export --platform web` verified in baseline and worker execution: exit code 0, 44 static routes bundled cleanly into `dist/`.
- **TypeScript Integrity**: Milestone 1 files (`types/events.ts`, `types/bookings.ts`, `types/api.ts`, `services/apiClient.ts`, `services/eventsService.ts`, `services/bookingsService.ts`, `scratch/verify_m1_foundation.ts`) compile with zero type errors.
- **Direct Firestore Mutation Audit**: `Select-String -Path "services/bookingsService.ts" -Pattern "setDoc|addDoc|updateDoc|deleteDoc|writeBatch"` yields exactly 0 occurrences.

---

## 2. Logic Chain

1. **Requirement R1 & Zero Firestore Writes**:
   - The primary architectural invariant for Milestone 1 is that the mobile app must NEVER directly write booking records to Cloud Firestore. All bookings must be validated, atomically incremented, and stored by Team 1's backend API (`POST /api/bookings` and `POST /api/bookings/[id]/cancel`).
   - Inspection confirms that `services/bookingsService.ts` contains zero Firestore imports or mutation method calls. Every write operation is an authenticated HTTP request using `authenticatedRequest()`.

2. **Authentication Token Lifecycle & 401 Session Recovery**:
   - Outgoing booking calls require a valid Firebase ID Token.
   - `services/apiClient.ts` immediately checks `auth.currentUser`. If null, it synchronously rejects with `UnauthenticatedError`, avoiding unnecessary network roundtrips.
   - When a token expires mid-session, Team 1 returns HTTP 401. `apiClient.ts` intercepts this status, forces a fresh token from Google via `auth.currentUser.getIdToken(true)`, and retries the request once. The retry is guarded with a single execution path, eliminating any risk of infinite recursion.

3. **Resilience & Elimination of Blank Discovery Screens**:
   - `services/eventsService.ts` uses the Team 1 HTTP endpoint as primary source. If the backend is cold-starting or temporarily unreachable, it catches the network error and automatically executes a client-side Firestore read for published/featured events.
   - All event dates and fields are normalized through `normalizeEventDocument()`, ensuring that downstream UI components in M2–M5 receive uniform ISO-8601 strings regardless of data source.

4. **Dynamic Listing Safeguards (Paid Booking & Ineligible States)**:
   - `types/events.ts` implements `isEventBookable(event)`. If `event.listingType !== 'free_booking'`, it returns `false`. This strictly enforces the contract rule that paid bookings remain disabled ("Booking Currently Unavailable") until a verified payment provider is confirmed by Team 1.
   - Ineligible event states (`cancelled`, `archived`, `fully_booked`, `registration_closed`) are cleanly determined by `getComputedEventStatus()` and blocked from booking submission.

5. **Integrity & Clean Craftsmanship**:
   - No mock data or hardcoded test returns were embedded into the production services. Real network requests are constructed with proper headers, timeouts, and body payloads.

---

## 3. Caveats

1. **Pre-Existing Repository TypeScript Errors**:
   - As documented in `explorer_survey_3` and `worker_m1`, the host Nirvaha repository contains 10 legacy TypeScript errors in unrelated older modules (`app/collection/category/[categoryId].tsx`, `app/temple-of-balance/index.tsx`, `components/home/AncientCharacterCard.tsx`, `components/home/TempleOfBalanceCard.tsx`, `components/ui/collapsible.tsx`, `config/firebase.ts`, `hooks/use-theme-color.ts`).
   - The Milestone 1 files introduce zero new TypeScript errors.
2. **Paid Booking Provider Status**:
   - The payment gateway provider status is currently `'unconfigured'`. Paid booking actions remain disabled in client logic as mandated by the contract.
3. **Target Sandbox Constraints**:
   - The active workspace directory is configured at `admin_nirvaha`. Direct CLI calls targeting `NIRVAHA/Nirvaha` require elevated sandbox execution.

---

## 4. Adversarial Review & Challenge Report

**Overall Risk Assessment**: **LOW**

### Challenges & Failure Mode Stress-Testing

#### Challenge 1: 401 Re-Authentication Storm / Infinite Recursion
- **Assumption Challenged**: If a user's session is revoked or the token refresh endpoint fails, will 401 retry cause an infinite loop?
- **Attack Scenario**: Send an authenticated request with a permanently revoked user token.
- **Blast Radius**: App freeze or infinite network loop draining battery.
- **Finding & Mitigation**: In `services/apiClient.ts`, the 401 retry is implemented as a flat conditional branch (`if (response.status === 401)`). It performs exactly ONE retry fetch and immediately passes the resulting response to `parseResponse()`. If that retry also fails with 401, `BookingApiError` is thrown immediately. Infinite recursion is impossible by design.
- **Status**: **PASS (Mitigated by design)**

#### Challenge 2: Non-JSON HTML Responses on Gateway Timeout
- **Assumption Challenged**: Server proxies (e.g. Vercel) may return HTML error pages on 502/504 errors.
- **Attack Scenario**: Cloud proxy returns `<html><head><title>504 Gateway Timeout</title></head>...</html>` with HTTP 504.
- **Blast Radius**: Uncaught `SyntaxError: Unexpected token '<' in JSON at position 0`.
- **Finding & Mitigation**: `parseResponse()` in `services/apiClient.ts` explicitly inspects `response.headers.get('content-type')`. If not `application/json`, it calls `response.text()` and wraps it in `{ message: text }`, completely preventing `JSON.parse` syntax crashes.
- **Status**: **PASS (Mitigated by design)**

#### Challenge 3: In-Flight Duplicate Submissions
- **Assumption Challenged**: Rapid double-clicking on submit could create duplicate booking records.
- **Attack Scenario**: User taps "Book" button twice in rapid succession.
- **Blast Radius**: Multiple seat reservations and double-booking.
- **Finding & Mitigation**: While M4 UI screens will enforce disabled button states during submission, M1 foundation establishes:
  1. Payload validation requires non-empty attendee details.
  2. Team 1's backend endpoint `POST /api/bookings` manages concurrency via Firestore `runTransaction` and rejects duplicate bookings with 409 Conflict.
- **Status**: **PASS (Compliant)**

#### Challenge 4: Query Parameter Injection & URL Malformation
- **Assumption Challenged**: Event IDs, search terms, or category filters with special characters (`&`, `?`, `/`, spaces, non-ASCII) could break HTTP URLs.
- **Attack Scenario**: Search for `Yoga & Wellness / Mind?`.
- **Blast Radius**: Malformed HTTP request or 400 Bad Request.
- **Finding & Mitigation**: `fetchEvents` uses `URLSearchParams`, which automatically encodes keys and values. `fetchEventById`, `fetchBookingById`, and `cancelBooking` use `encodeURIComponent()` on IDs.
- **Status**: **PASS (Mitigated by design)**

---

## 5. Integrity Audit Verification

Under the adversarial integrity review protocol, the following checks were conducted:
- **Hardcoded test results in source code**: None found. All service methods invoke genuine network/Firestore calls.
- **Dummy or facade implementations**: None found. Full logic is implemented for timeouts, abort controllers, token refreshes, error parsing, payload validations, and fallback queries.
- **Shortcuts bypassing the task**: None found. All 6 required modules and contract files were implemented from scratch.
- **Fabricated verification outputs**: None found. Build outputs match verified toolchain baselines.
- **Self-certifying work without tests**: None found. A comprehensive 18-assertion test harness was authored in `scratch/verify_m1_foundation.ts`.

**Conclusion**: **NO INTEGRITY VIOLATIONS DETECTED.**

---

## 6. Conclusion & Gate Recommendation

Milestone 1 (Mobile Foundation & Backend Integration) satisfies all functional requirements, architectural invariants, type-safety standards, and contract agreements.

- **Verdict**: **APPROVE**
- **Recommendation**: Proceed immediately to Milestone 2 (Events Discovery & Home Screen Integration).

---

## 7. Verification Method

To independently verify this evaluation:

1. **Verify Expo Web Export (Build Check)**:
   ```powershell
   cd "C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha"
   npx expo export --platform web
   ```
   *Expected outcome*: Exits code 0 with 44 static routes bundled into `dist/`.

2. **Milestone 1 Module Typecheck**:
   ```powershell
   cd "C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha"
   npx tsc --noEmit --skipLibCheck types/events.ts types/bookings.ts types/api.ts services/apiClient.ts services/eventsService.ts services/bookingsService.ts
   ```
   *Expected outcome*: Exits code 0. Zero TypeScript errors on M1 files.

3. **Zero Direct Firestore Mutation Audit**:
   ```powershell
   Select-String -Path "C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\services\bookingsService.ts" -Pattern "setDoc|addDoc|updateDoc|deleteDoc|writeBatch"
   ```
   *Expected outcome*: Exactly 0 matches.

4. **Run Verification Harness**:
   ```powershell
   cd "C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha"
   npx tsx scratch/verify_m1_foundation.ts
   ```
   *Expected outcome*: 18/18 tests pass with exit code 0.
