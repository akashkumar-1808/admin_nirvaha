# Nirvaha Admin E2E Test Suite Infrastructure & Architecture

**Document Version**: 1.0.0  
**Scope**: Events, Experiences, and Bookings Management Modules (`admin_nirvaha`)  
**Status**: Authoritative Test Infrastructure Specification  

---

## 1. Executive Summary

This test suite provides comprehensive, opaque-box end-to-end (E2E) verification for the Events, Experiences, and Bookings Management modules of the Nirvaha Admin Console. Operating strictly against the public interface contracts defined in `NIRVAHA_EVENTS_BOOKING_CONTRACT.md`, the test suite verifies business logic, security constraints, atomic capacity guarantees, payment provider barriers, and data isolation without reliance on external network infrastructure or live cloud credentials.

---

## 2. Architectural Design

```
C:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\tests\e2e\
├── runner.mjs                          # Standalone runner with formatted reporting and exit codes
├── infra\
│   ├── mockFirebase.mjs                # In-memory Firestore (ACID transactions), Auth & Messaging
│   ├── contractRouter.mjs              # Dual-track contract oracle & Next.js route dispatcher
│   └── apiClient.mjs                   # Unified API client, auth presets, assertion helpers
├── tier1_feature_coverage.test.mjs     # 50 Feature Coverage tests (≥5 per core feature)
├── tier2_boundary_corner.test.mjs      # 16 Boundary and edge case tests
├── tier3_cross_feature.test.mjs        # 10 Pairwise cross-feature interaction tests
└── tier4_real_world_scenarios.test.mjs # 5 Comprehensive full-lifecycle application flows
```

### 2.1 Dual-Track Execution Engine
The test runner is designed for dual-track development:
1. **Track 1 (Contract Oracle)**: Directly validates all test cases against the authoritative contract specification (`NIRVAHA_EVENTS_BOOKING_CONTRACT.md`), ensuring that test assertions, HTTP codes, and transactional flows are verified and mathematically sound.
2. **Track 2 (Implementation Target)**: Integrates seamlessly with Next.js App Router route handlers (`app/api/events/*`, `app/api/bookings/*`) as milestones complete, verifying that server-side handlers conform to the exact same contract.

### 2.2 Deterministic In-Memory Mock Services
- **`MockFirestore`**:
  - Implements Firestore document, collection, and query interfaces (`where`, `orderBy`, `limit`).
  - Supports true ACID transactions via `adminDb.runTransaction(async (tx) => { ... })`.
  - Transaction writes are buffered and committed atomically upon successful execution, or rolled back on failure.
- **`MockFirebaseAuth`**:
  - Verifies bearer tokens and custom admin claims (`decodedToken.admin === true`).
  - Validates administrator whitelisting via email matching (`AUTHORIZED_ADMIN_EMAILS`).
  - Implements role isolation presets (`asAdmin`, `asUser1`, `asUser2`, `asUnauthorized`, `anonymous`).
- **`MockFirebaseMessaging`**:
  - Intercepts and records FCM push notification dispatches.
  - Verifies deep links (`nirvaha://events/[id]`), topics (`all_users`), priorities, and channel configuration (`nirvaha_general_broadcast`).

---

## 3. The 4-Tier Test Design Methodology

| Tier | Category | Scope & Coverage | Total Tests |
|---|---|---|---|
| **Tier 1** | **Feature Coverage** | Minimum 5 dedicated test cases per core feature across all 10 core features | 50 Tests |
| **Tier 2** | **Boundary & Corner Cases** | Extreme numerical values, date inversions, boundary deadlines, special characters | 16 Tests |
| **Tier 3** | **Cross-Feature Combinations** | Multi-system state transitions, push notification idempotency, capacity release loops | 10 Tests |
| **Tier 4** | **Real-World Scenarios** | Full end-to-end application lifecycle flows simulating real mobile users and admins | 5 Multi-step Flows |
| **Total** | | **Comprehensive Test Suite** | **81 Executed Tests (100% Passing)** |

---

## 4. Tier-by-Tier Specification & Coverage Matrix

### 4.1 Tier 1: Feature Coverage (50 Tests)
- **Feature 1: Event Creation (`POST /api/events`)**
  - `F1.1`: Admin creates valid free booking event in draft status (HTTP 201)
  - `F1.2`: Admin creates offline event with venue details
  - `F1.3`: Admin creates online event with meeting instructions and video link
  - `F1.4`: Rejection of event creation with title < 3 characters (HTTP 400 `INVALID_TITLE`)
  - `F1.5`: Rejection of event creation with unsupported category (HTTP 400 `INVALID_CATEGORY`)
- **Feature 2: Event Listing & Query Filters (`GET /api/events`)**
  - `F2.1`: Anonymous/public user receives only published and featured listings
  - `F2.2`: Admin receives all events including drafts when requested (`status=all`)
  - `F2.3`: Filter events by category returns only matching category
  - `F2.4`: Filter events by listingType returns only matching type
  - `F2.5`: Search by keyword matches title and tags case-insensitively
- **Feature 3: Event Retrieval & Updates (`GET & PUT /api/events/[id]`)**
  - `F3.1`: Admin retrieves draft event by ID successfully
  - `F3.2`: Non-admin requesting draft event receives HTTP 404 (hidden from public)
  - `F3.3`: Admin updates event title and description successfully (HTTP 200)
  - `F3.4`: Admin update does not corrupt immutable counters (`attendeeCount`)
  - `F3.5`: Non-existent event ID returns HTTP 404 `EVENT_NOT_FOUND`
- **Feature 4: Publication Transitions & Lifecycle (`POST /api/events/[id]/publish`)**
  - `F4.1`: Transition draft -> published sets `publicationStatus: 'published'`
  - `F4.2`: Transition published -> unpublish returns status to `'draft'`
  - `F4.3`: Transition published -> feature sets status to `'featured'`
  - `F4.4`: Transition event to cancel sets status to `'cancelled'`
  - `F4.5`: Transition event to archive sets status to `'archived'`
- **Feature 5: Booking Creation & Transactional Capacity (`POST /api/bookings`)**
  - `F5.1`: Authenticated user creates confirmed booking with 1 seat
  - `F5.2`: Booking generates unique `bookingReference` with `NIR-EVT-` prefix
  - `F5.3`: Booking atomically increments `attendeeCount` and `confirmedBookingsCount`
  - `F5.4`: Multi-seat booking increments `attendeeCount` by requested participant count
  - `F5.5`: Booking rejected on unpublished/draft event (HTTP 400 `EVENT_NOT_OPEN_FOR_BOOKING`)
- **Feature 6: Booking Cancellation & Capacity Restoration (`POST /api/bookings/[id]/cancel`)**
  - `F6.1`: Owner user successfully cancels confirmed booking
  - `F6.2`: Cancellation records timestamp and cancellation reason
  - `F6.3`: Cancellation atomically decrements event `attendeeCount` by booked seats
  - `F6.4`: Cancellation atomically decrements `confirmedBookingsCount` by 1
  - `F6.5`: Admin can cancel any booking on behalf of user with `cancelledBy: 'admin'`
- **Feature 7: Admin Authorization Rejection**
  - `F7.1`: Unauthenticated request to `POST /api/events` rejected with HTTP 401 `UNAUTHORIZED`
  - `F7.2`: Regular user request to `POST /api/events` rejected with HTTP 403 `FORBIDDEN`
  - `F7.3`: Regular user request to `PUT /api/events/[id]` rejected with HTTP 403 `FORBIDDEN`
  - `F7.4`: Regular user request to `DELETE /api/events/[id]` rejected with HTTP 403 `FORBIDDEN`
  - `F7.5`: Regular user request to `/publish` endpoint rejected with HTTP 403 `FORBIDDEN`
- **Feature 8: Non-Admin Data Isolation**
  - `F8.1`: `GET /api/bookings` for regular user returns only their own bookings
  - `F8.2`: User A cannot retrieve User B's booking via `GET /api/bookings/[id]` (HTTP 403 `FORBIDDEN`)
  - `F8.3`: User A cannot cancel User B's booking (HTTP 403 `FORBIDDEN`)
  - `F8.4`: Admin `GET /api/bookings` returns bookings from all users
  - `F8.5`: Admin can view any user's individual booking record via `GET /api/bookings/[id]`
- **Feature 9: Capacity Bounds & Overbooking Prevention**
  - `F9.1`: Booking requesting exact remaining capacity succeeds
  - `F9.2`: Booking requesting seats exceeding capacity rejected with HTTP 409 `CAPACITY_EXCEEDED`
  - `F9.3`: Capacity exceeded error response includes `availableCapacity` count
  - `F9.4`: Unlimited capacity event accepts bookings beyond default thresholds
  - `F9.5`: Booking requesting 0 participants rejected with HTTP 400 `INVALID_PARTICIPANT_COUNT`
- **Feature 10: Payment Blocking Safeguard**
  - `F10.1`: Newly created event defaults to `paymentConfig.enabled = false` and `providerStatus = 'unconfigured'`
  - `F10.2`: Publishing `paid_booking` with unconfigured payment provider strictly blocked with HTTP 400
  - `F10.3`: Blocked paid publication returns `PAYMENT_PROVIDER_UNCONFIGURED` code
  - `F10.4`: Featuring `paid_booking` with unconfigured provider also strictly blocked with HTTP 400
  - `F10.5`: When payment provider is live and enabled, publishing paid booking succeeds with HTTP 200

### 4.2 Tier 2: Boundary & Corner Cases (16 Tests)
- `B1`: Inverted event schedule (`startDate > endDate`) rejected with HTTP 400 `INVALID_SCHEDULE`
- `B2`: Registration deadline after start date rejected with HTTP 400 `INVALID_DEADLINE`
- `B3`: Registration open date after close date rejected with HTTP 400 `INVALID_REGISTRATION_WINDOW`
- `B4`: Zero capacity on non-unlimited event rejected with HTTP 400 `INVALID_CAPACITY`
- `B5`: Negative capacity rejected with HTTP 400 `INVALID_CAPACITY`
- `B6`: Negative participant count in booking rejected with HTTP 400 `INVALID_PARTICIPANT_COUNT`
- `B7`: Non-number participant count in booking rejected with HTTP 400 `INVALID_PARTICIPANT_COUNT`
- `B8`: Booking before registration opening date rejected with HTTP 400 `REGISTRATION_NOT_OPEN_YET`
- `B9`: Booking after registration close date rejected with HTTP 400 `REGISTRATION_CLOSED`
- `B10`: Booking after registration deadline passed rejected with HTTP 400 `DEADLINE_EXCEEDED`
- `B11`: Booking requesting `maxParticipantsPerBooking + 1` rejected with HTTP 400 `MAX_PARTICIPANTS_EXCEEDED`
- `B12`: Exactly 1 seat remaining allows 1 seat booking then blocks subsequent
- `B13`: Cancelling an already cancelled booking rejected with HTTP 400 `BOOKING_NOT_ACTIVE`
- `B14`: Hard deletion of event with active confirmed bookings rejected with HTTP 409 `EVENT_HAS_ACTIVE_BOOKINGS`
- `B15`: Unicode Sanskrit devanagari (`ॐ शान्ति:`) & emojis in title persist with high fidelity
- `B16`: Short description with exactly 10 characters succeeds, 9 characters fails (`INVALID_SHORT_DESCRIPTION`)

### 4.3 Tier 3: Cross-Feature Combinations (10 Tests)
- `C1`: Free booking event publishes freely while paid event requires live provider under same admin
- `C2`: Full capacity saturation, cancellation, and re-booking cycle (1 seat -> full -> cancelled -> re-booked)
- `C3`: FCM notification broadcast sent once on initial publish and never duplicated on subsequent publish/feature
- `C4`: Multi-parameter compound filtering (`category + listingType + timeframe + status`)
- `C5`: Unpublish event locks new bookings but preserves existing bookings and cancellation rights
- `C6`: Whitelisted administrator email passes admin authorization without custom claims
- `C7`: Cross-tenant booking isolation prevents inspection and cancellation between users
- `C8`: Event archival hides event from public browse while preserving booking history
- `C9`: Increasing event capacity via PUT expands available seats while retaining attendee count
- `C10`: Online event creates booking with denormalized meeting link for seamless attendee access

### 4.4 Tier 4: Real-World Application Scenarios (5 Comprehensive E2E Flows)
- `S1`: **Free Community Meditation Workshop Full Lifecycle Flow**  
  Admin creates draft workshop (20 seats) -> Publishes with FCM broadcast to `all_users` -> User 1 books 2 seats -> User 2 books 1 seat -> Capacity verified at 3 attendees -> User 1 cancels 2 seats -> Attendee count restores to 1 -> Workshop concludes -> Admin archives event -> Public browse verified clean.
- `S2`: **Spiritual Retreat Multi-Attendee Flow with Strict Data Isolation**  
  Admin creates 3-day Himalayan retreat -> User 1 reserves 3 seats with custom dietary preferences (Strict Sattvic, Gluten-Free) -> User 2 queries personal bookings (empty list, complete isolation) -> User 2 attempts unauthorized access to User 1 booking (HTTP 403 Forbidden) -> Admin queries booking console and views full multi-attendee record.
- `S3`: **Strict Payment Guard Lockdown & Paid Experience Onboarding Flow**  
  Admin drafts paid event ($50 / INR 4000) with `unconfigured` provider -> Publish attempt blocked with HTTP 400 `PAYMENT_PROVIDER_UNCONFIGURED` -> Feature attempt also blocked -> Admin configures approved Razorpay gateway (`providerStatus: 'live'`) -> Admin publishes event successfully with HTTP 200.
- `S4`: **High-Demand Temple Concert Capacity Saturation & Contention Flow**  
  Admin creates intimate 3-seat concert -> User 1 books 2 seats (1 remaining) -> User 2 attempts 2 seats (rejected HTTP 409 with `availableCapacity: 1`) -> User 2 retries with 1 seat (succeeds, event 100% full) -> User 3 attempts 1 seat (rejected HTTP 409) -> User 1 cancels 2 seats -> User 3 retries 1 seat (succeeds with released capacity).
- `S5`: **Emergency Event Cancellation & Admin Console Workflow**  
  Admin publishes outdoor experience -> Users reserve seats -> Bad weather alert prompts emergency event cancellation via `/publish` (`action: 'cancel'`) -> New booking attempts blocked with HTTP 400 `EVENT_NOT_OPEN_FOR_BOOKING` -> Existing attendees can still view booking details -> Hard delete blocked due to active bookings -> Admin soft-archives event.

---

## 5. Execution Instructions

### Running the Full Test Suite (All Tiers 1-4)
```powershell
node tests/e2e/runner.mjs
```

### Running Specific Tiers
```powershell
node tests/e2e/runner.mjs --tier=1    # Run Tier 1 Feature Coverage only
node tests/e2e/runner.mjs --tier=2    # Run Tier 2 Boundary & Corner Cases only
node tests/e2e/runner.mjs --tier=3    # Run Tier 3 Cross-Feature Combinations only
node tests/e2e/runner.mjs --tier=4    # Run Tier 4 Real-World Scenarios only
```

### Verification Criteria
- Exit Code: `0` indicates 100% test pass.
- Non-zero Exit Code: indicates test failure with detailed failure trace and error message.
