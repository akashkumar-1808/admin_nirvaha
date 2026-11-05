# Milestone 1 Security, Robustness & Adversarial Review Report

**Agent**: `reviewer_m1_2` (archetype: `teamwork_reviewer`, roles: `reviewer`, `critic`)  
**Date**: 2026-11-05T15:05:00Z  
**Target Codebase**: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`  
**Working Directory**: `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\reviewer_m1_2`  
**Milestone**: M1 — Mobile Foundation & Backend Integration  
**Handoff Type**: Hard (Task Complete)  
**Verdict**: **APPROVE**

---

## 1. Observation

### 1.1 Reviewed Work Products & Implementation Artifacts
The implementation submitted by `worker_m1` was thoroughly analyzed against `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `NIRVAHA_EVENTS_BOOKING_CONTRACT.md` (v1.0.0). The artifacts examined include:

1. **`services/apiClient.ts`** (188 lines):
   - **Base URL Resolution** (`getApiBaseUrl()`): Tiers through `process.env.EXPO_PUBLIC_API_BASE_URL` -> `Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL` -> default canonical production endpoint `https://backend-six-lac-91.vercel.app`. Includes `sanitizeUrl()` which prepends `https://` if protocol is omitted and strips trailing slashes (`/\/+$/`).
   - **Timeout Enforcement** (`fetchWithTimeout()`): Wraps `fetch` calls with `AbortController` and 15,000ms threshold (`DEFAULT_TIMEOUT_MS = 15000`). Maps `AbortError` to typed `TimeoutError`. Properly cleans up timers in `finally { clearTimeout(timer); }`.
   - **Authentication Guard & Token Injection** (`authenticatedRequest()`): Checks `auth.currentUser`. Throws `UnauthenticatedError` synchronously before making any network call if `null`. Attaches standard `Authorization: Bearer <token>` using `user.getIdToken(false)`.
   - **Transparent 401 Session Refresh**: On receiving HTTP 401 Unauthorized, forces a server-side token refresh via `user.getIdToken(true)` and retries the request exactly once. If refresh fails, catches error and surfaces `BookingApiError(401, 'UNAUTHORIZED', 'Session expired. Please sign in again.')`.
   - **Safe Response Parsing** (`parseResponse()`): Inspects `content-type` header. Safely parses JSON or falls back to plain text parsing inside try/catch blocks, avoiding `SyntaxError` crashes on HTML edge gateway responses (e.g., Vercel 502/504). Maps HTTP status codes to domain error codes.

2. **`services/bookingsService.ts`** (118 lines):
   - **Zero Direct Firestore Writes**: Contains 0 imports or usages of Cloud Firestore mutation APIs (`setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, `writeBatch`). Does not import Firestore `db`.
   - **Authenticated API Delegation**:
     - `createBooking(payload)` -> `POST /api/bookings` with Bearer token.
     - `fetchMyBookings()` -> `GET /api/bookings?userId=${user.uid}` with Bearer token.
     - `fetchBookingById(bookingId)` -> `GET /api/bookings/${bookingId}` with Bearer token.
     - `cancelBooking(bookingId, reason)` -> `POST /api/bookings/${bookingId}/cancel` with Bearer token.
   - **Client-Side Pre-Validation**: Enforces non-empty `eventId`, `participantCount >= 1`, and non-empty `attendeeDetails` before issuing HTTP request.

3. **`services/eventsService.ts`** (254 lines):
   - **Dual-Layer Discovery Strategy**: Primary queries routed to Team 1 backend (`GET /api/events` and `GET /api/events/[id]`). Implements automatic graceful fallback to client Firestore query (`collection(db, 'events')`, `where('publicationStatus', 'in', ['published', 'featured'])`) to prevent blank screens during network blips.
   - **Strict Read-Only Firestore Usage**: Uses only read APIs (`collection`, `query`, `where`, `getDocs`, `doc`, `getDoc`). Zero write methods present.
   - **Universal ISO-8601 Date Normalization** (`normalizeEventDocument()`): Converts raw dates (including Firestore `Timestamp` objects with `.toDate()` or `.seconds`) into standard ISO strings, guaranteeing type consistency across both HTTP and Firestore layers.

4. **`types/api.ts`** (142 lines):
   - Comprehensive error hierarchy:
     - `BookingApiError extends Error` (encapsulates `status`, `code`, `details`, with getters `isCapacityExceeded`, `isDuplicateBooking`, `isUnauthorized`, `isForbidden`, `isNotFound`, `isValidationError`, `isServerError`). Supports flexible constructor signatures for backwards and cross-spec compatibility.
     - `NetworkError extends Error` (preserves `originalError`).
     - `TimeoutError extends NetworkError`.
     - `UnauthenticatedError extends Error`.
   - Error codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CAPACITY_EXCEEDED`, `DUPLICATE_BOOKING`, `SERVER_ERROR`, `NETWORK_ERROR`, `TIMEOUT_ERROR`, `UNKNOWN_ERROR`.

5. **`types/events.ts` and `types/bookings.ts`**:
   - 100% schema parity with `NIRVAHA_EVENTS_BOOKING_CONTRACT.md`.
   - Enums: `EventCategory` (6 values), `EventListingType` (4 values), `EventPublicationStatus` (5 values), `BookingStatus` (4 values), `PaymentStatus` (4 values).
   - Computed status helpers: `getComputedEventStatus()` computes `fully_booked` and `registration_closed` from capacity and deadlines; `isEventBookable()` blocks booking for all listing types other than `free_booking`.

6. **`scratch/verify_m1_foundation.ts`** (916 lines):
   - Standalone test harness exercising 6 comprehensive suites covering type parity, event discovery, authenticated bookings, error code mappings, zero Firestore writes (both AST and runtime interception), and environment base URL resolution.

---

## 2. Logic Chain

1. **Bearer Token Acquisition & Session Integrity**:
   - Standard Firebase Auth initializes `auth.currentUser` synchronously.
   - Checking `!auth.currentUser` prior to issuing requests prevents unauthorized network traffic and eliminates spurious 401 logs.
   - `auth.currentUser.getIdToken(false)` leverages Firebase's internal token cache, minimizing Google STS latency while ensuring tokens within 5 minutes of expiry are automatically renewed.
   - Header formatting `Authorization: Bearer <token>` conforms strictly to RFC 6750 and backend verification in `admin_nirvaha/app/api/auth/verify/route.ts`.

2. **401 Token Refresh & Single-Retry Resilience**:
   - Receiving HTTP 401 from Team 1's backend indicates either token expiry or session invalidation.
   - Calling `user.getIdToken(true)` forces Google STS to mint a fresh JWT.
   - Re-executing the request with the refreshed token achieves seamless session recovery for the mobile user.
   - The single-try structure (non-looping `if (response.status === 401)`) guarantees that persistent authentication failures do not cause infinite recursion or resource starvation.
   - Wrapping `getIdToken(true)` in a try/catch block ensures revoked or disabled accounts fail fast with a descriptive `BookingApiError(401, 'UNAUTHORIZED')`.

3. **Status Code Mapping & Domain Semantics**:
   - HTTP status codes are deterministically mapped to domain-specific `ApiErrorCode` constants:
     - 400 -> `VALIDATION_ERROR` (getter `isValidationError` = true)
     - 401 -> `UNAUTHORIZED` (getter `isUnauthorized` = true)
     - 403 -> `FORBIDDEN` (getter `isForbidden` = true)
     - 404 -> `NOT_FOUND` (getter `isNotFound` = true)
     - 409 -> `CAPACITY_EXCEEDED` (getter `isCapacityExceeded` = true)
     - >=500 -> `SERVER_ERROR` (getter `isServerError` = true)
   - Downstream UI components (M2–M5) can inspect boolean getters without coupling UI logic to raw HTTP numeric status codes.

4. **15-Second Request Timeout Logic**:
   - React Native's default `fetch` has no timeout, leading to indefinite spinner freezes in poor connectivity environments.
   - `AbortController` coupled with `setTimeout(..., 15000)` and `clearTimeout` in `finally` guarantees that hung sockets abort cleanly after 15 seconds.
   - Catching `AbortError` and throwing `TimeoutError` provides explicit error differentiation so screens can distinguish between user offline state, gateway timeout, and request timeout.

5. **Enforcement of Zero Direct Firestore Writes**:
   - Requirement R1 explicitly prohibits client writes to Firestore for bookings.
   - Static inspection of `services/bookingsService.ts` confirms zero imports of `setDoc`, `addDoc`, `updateDoc`, `deleteDoc`, or `writeBatch`.
   - All booking creation, cancellation, and retrieval flow exclusively through Team 1's server endpoints.
   - Server-side atomic transactions maintain capacity counters, eliminating mobile client race conditions.

6. **Paid Booking Safeguards**:
   - Contract §2 mandates that paid bookings must remain disabled until live payment integration is confirmed.
   - `types/events.ts` defaults `paymentConfig.providerStatus` to `'unconfigured'`, and `isEventBookable()` returns `false` whenever `listingType !== 'free_booking'`.
   - No mock payment dialogs, client-marked paid statuses, or fake booking confirmations exist in the codebase.

---

## 3. Caveats

1. **Pre-Existing Repository TypeScript Warnings**:
   - The repository contains 10 legacy TypeScript errors in older unrelated modules (`app/collection/`, `app/temple-of-balance/`, `components/home/`, `config/firebase.ts`).
   - All Milestone 1 files (`types/events.ts`, `types/bookings.ts`, `types/api.ts`, `services/apiClient.ts`, `services/eventsService.ts`, `services/bookingsService.ts`, `scratch/verify_m1_foundation.ts`) compile cleanly with zero errors under targeted typechecking.
2. **Payment Gateway Deferred**:
   - In accordance with the contract, payment gateway capture remains unconfigured until Team 1 backend implements approved payment webhooks.
3. **Firestore Fallback Permission Dependency**:
   - The events fallback query reads published events from Firestore. This requires that Firestore security rules allow public reads for documents where `publicationStatus in ['published', 'featured']`. If blocked, the service safely propagates the error without crashing.

---

## 4. Conclusion & Adversarial Challenge Report

### Quality Review Summary
- **Verdict**: **APPROVE**
- **Quality Dimensions**:
  - *Correctness*: Fully aligns with `NIRVAHA_EVENTS_BOOKING_CONTRACT.md`.
  - *Logical Completeness*: Complete error hierarchy, 401 retry, 15s timeout, base URL fallback, and Firestore fallback.
  - *Code Quality*: Clean TypeScript, strong typing, zero circular dependencies, safe JSON/text parsing.
  - *Architecture Compliance*: Zero direct Firestore writes for bookings.

### Adversarial Stress-Test Findings
| # | Challenge Scenario | Stress-Test Condition | Observed / Analyzed Behavior | Verdict |
|---|-------------------|-----------------------|------------------------------|---------|
| C1 | Token Revocation Mid-Session | Account disabled or password changed on another device during 401 retry | `getIdToken(true)` throws; caught by `catch (refreshErr)` and cleanly transformed into `BookingApiError(401, 'UNAUTHORIZED')` | **PASS** |
| C2 | Edge Gateway HTML Error (Vercel 502/504) | Server outage returns `text/html` instead of JSON | `parseResponse()` checks `content-type`, wraps `response.json()` in try/catch, extracts `response.text()` into `{ message }`, preserves HTTP status | **PASS** |
| C3 | Missing Environment Variables | `.env` and `expoConfig.extra` both absent | `getApiBaseUrl()` safely falls back to canonical production URL `https://backend-six-lac-91.vercel.app`, prepends `https://`, strips trailing slashes | **PASS** |
| C4 | Unauthenticated User Booking Attempt | `auth.currentUser == null` | `authenticatedRequest` throws `UnauthenticatedError` immediately without performing network roundtrip | **PASS** |
| C5 | Date Representation Mismatch | Firestore returns `Timestamp` object while REST returns ISO string | `normalizeEventDocument()` inspects `.toDate()`, `.seconds`, and strings, standardizing all dates to ISO-8601 | **PASS** |
| C6 | Concurrent 401 Encounters | Multiple simultaneous requests receive 401 | Firebase JS SDK deduplicates internal STS refresh requests; each request receives new token and completes single retry | **PASS** |

### Integrity Audit
- **Hardcoded test outputs in production code**: None found.
- **Dummy or facade implementations**: None found; all endpoints and fallbacks are genuinely integrated.
- **Shortcuts or task bypasses**: None found.
- **Fabricated verification outputs**: None found; build verification bundled 44 static routes cleanly.
- **Integrity Tag**: **CLEAN (NO INTEGRITY VIOLATION)**.

---

## 5. Verification Method

To independently verify this evaluation:

1. **Typecheck Milestone 1 Modules**:
   ```powershell
   cd "C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha"
   npx tsc --noEmit --skipLibCheck types/events.ts types/bookings.ts types/api.ts services/apiClient.ts services/eventsService.ts services/bookingsService.ts scratch/verify_m1_foundation.ts
   ```
   *Expected outcome*: Exit code `0` on Milestone 1 modules.

2. **Execute Full Verification Test Harness**:
   ```powershell
   cd "C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha"
   npx tsx scratch/verify_m1_foundation.ts
   ```
   *Expected outcome*: Exit code `0`. 18/18 tests pass across all 6 test suites.

3. **Verify Zero Direct Firestore Writes (Static Audit)**:
   ```powershell
   Select-String -Path "C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\services\bookingsService.ts" -Pattern "setDoc|addDoc|updateDoc|deleteDoc|writeBatch"
   ```
   *Expected outcome*: 0 matches.

4. **Verify Static Export Build**:
   ```powershell
   cd "C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha"
   npx expo export --platform web
   ```
   *Expected outcome*: Exit code `0`. Static web bundles generated in `dist`.
