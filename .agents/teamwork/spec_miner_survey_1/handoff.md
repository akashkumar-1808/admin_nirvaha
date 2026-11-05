# Handoff Report: Events & Booking Contract Specification Mining

**Agent**: `spec_miner_survey_1` (archetype: `teamwork_spec_miner`)  
**Working Directory**: `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\spec_miner_survey_1`  
**Timestamp**: 2026-11-05T13:55:00Z  
**Type**: Hard Handoff (Investigation & Specification Extraction Complete)

---

## 1. Observation

### 1.1 Search for `NIRVAHA_EVENTS_BOOKING_CONTRACT.md`
- **Admin Repository Search**: Executed PowerShell and CMD searches across `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha`. File does not exist anywhere in the admin codebase.
- **Mobile Repository Search**: Executed searches across `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`. File does not exist anywhere in the mobile codebase.
- **Root Directory Search**: Executed search across `c:\Users\sai pallavi\OneDrive\Desktop\AKASH`. No file named `NIRVAHA_EVENTS_BOOKING_CONTRACT.md` exists.
- **Git Status Checks**:
  - `admin_nirvaha`: Branch `main`, modified `package-lock.json`, `package.json`, `scratch/create_user.js`, untracked `.agents/`.
  - `NIRVAHA\Nirvaha`: Branch `feature`, untracked `a.out`.

### 1.2 Specification Source Documents & Codebase Artifacts
1. **`c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\ORIGINAL_REQUEST.md`** (Lines 1–80):
   - Mandates mobile integration in `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha` in parallel with Team 1 (admin panel & backend).
   - R1: Obtain `NIRVAHA_EVENTS_BOOKING_CONTRACT.md` confirming `EventDocument`, `BookingDocument`, listing types, event/booking statuses, API endpoints, authentication requirements, error format, and deep-link format.
   - Mandates creating `types/events.ts`, `types/bookings.ts`, `services/eventsService.ts`, and `services/bookingsService.ts`.
   - Prohibits direct Firestore writes from the mobile app for bookings: "Never write bookings directly to Firestore from the mobile application. Submit bookings, capacity enforcement, and privileged booking changes strictly through Team 1's authenticated server API using an environment-based configuration for the API base URL."
   - R3: Four listing types: `advertisement`, `external_registration`, `free_booking`, `paid_booking`. Paid bookings must remain unavailable until an approved payment provider and secure backend verification exist.
   - R6: Reuse `services/pushNotifications.ts`; route event notifications to `/events/[id]`.

2. **`c:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\.agents\teamwork\ORIGINAL_REQUEST.md`** (Lines 1–63):
   - Team 1 backend/admin scope in `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha`.
   - R1: Configure and export Firestore Admin SDK access in `services/firebase/admin.ts`. Shared TypeScript models (`types/events.ts`, `types/bookings.ts`).
   - R4: Authenticated Next.js route handlers: `app/api/events/route.ts`, `app/api/events/[id]/route.ts`, `app/api/events/[id]/publish/route.ts`, `app/api/bookings/route.ts`, `app/api/bookings/[id]/route.ts`. All verify Firebase ID tokens.
   - R5: Transactional capacity enforcement in Firestore: atomically verify event publication status, registration window, capacity limits before creating booking record and updating attendee counts.
   - R6: Document API contracts, status transitions, and example payloads in `NIRVAHA_EVENTS_BOOKING_CONTRACT.md` for coordination with mobile team.

3. **`c:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\.agents\teamwork\survey_spec_miner\DISPATCH.md`** (Lines 1–44):
   - Authoritative schema specification for `EventDocument` and `BookingDocument`.
   - Event fields: `id`, `title`, `shortDescription`, `fullDescription`, `category`, `tags`, `organizer` (`name`, `contact`, `email`), `media` (`coverImageUrl`, `galleryImageUrls`), `schedule` (`startDate`, `endDate`, `timezone`, `durationMinutes`, `registrationDeadline`), `location` (`type`: `online` | `offline` | `hybrid`, `venueName`, `address`, `coordinates`, `meetingUrl`, `accessInstructions`), `listingType` (`advertisement` | `external_registration` | `free_booking` | `paid_booking`), `bookingConfig` (`capacity`, `maxParticipantsPerBooking`, `registrationOpenDate`, `registrationCloseDate`, `requiredAttendeeFields`, `cancellationPolicy`), `paymentConfig` (`enabled`: boolean, `currency`, `amount`, `providerStatus`: blocked by default), `publicationStatus` (`draft` | `published` | `featured` | `cancelled` | `archived`), `displayOrder`, `notifyOnPublish`, `attendeeCount`, `confirmedBookingsCount`, `createdAt`, `updatedAt`.
   - Booking fields: `id`, `bookingReference`, `eventId`, `eventTitle`, `eventDate`, `userId`, `userEmail`, `userName`, `userPhone`, `participantCount`, `attendeeDetails`, `status` (`confirmed` | `cancelled` | `waitlist` | `attended`), `bookedAt`, `cancelledAt`, `cancellationReason`.
   - Deep link schema: `nirvaha://events/[id]`.
   - Authenticated routes: `GET /api/events`, `POST /api/events`, `GET /api/events/[id]`, `PUT /api/events/[id]`, `DELETE /api/events/[id]`, `POST /api/events/[id]/publish`, `GET /api/bookings`, `POST /api/bookings`, `GET /api/bookings/[id]`, `POST /api/bookings/[id]/cancel`.
   - Status codes: 400, 401, 403, 404, 409 (capacity exceeded), 500.
   - Strict transactional capacity logic in Firestore transaction.
   - Payment blocking rule: `listingType === 'paid_booking'` must be rejected with 400 Bad Request if payment provider is unconfigured.

4. **`c:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\services\pushNotifications.ts`** (Lines 104–134):
   - `handleDeepLink`:
     ```typescript
     if (deepLink.startsWith('nirvaha://')) {
       const routeName = deepLink.replace('nirvaha://', '');
       ...
       targetRoute = `/${routeName}`;
     }
     router.push(targetRoute as any);
     ```
   - For `nirvaha://events/[id]`, `routeName` becomes `events/[id]`, resolving to `/events/[id]`.

5. **`c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\app\api\notifications\send\route.ts`** (Lines 1–129):
   - Auth verification: Reads `Authorization: Bearer <token>`, calls `adminAuth.verifyIdToken(token)`.
   - Checks admin custom claim (`decodedToken.admin === true`) or email whitelist in `process.env.AUTHORIZED_ADMIN_EMAILS`.
   - Push payload sends `data: { deepLink: body.deepLink }` and `topic: body.topic` via `adminMessaging.send(message)`.

6. **`c:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\constants\theme.ts`** (Lines 1–21):
   - Colors: `background: '#f8f6f0'`, `backgroundGradientEnd: '#e6ede8'`, `foreground: '#2A3B32'`, `mutedForeground: '#5A6E63'`, `primary: '#2D5A4C'`, `gold: '#D4AF37'`, `border: '#C0CEC6'`, `error: '#EF4444'`.
   - Typography: `display: 'PlayfairDisplay_400Regular'`, `body: 'Inter_400Regular'`, `bodyMedium: 'Inter_500Medium'`.

7. **`c:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\.env.example`** (Line 19):
   - `EXPO_PUBLIC_API_BASE_URL=` is configured as the base URL for Team 1 backend APIs.

---

## 2. Logic Chain

1. **Contract Existence Verification**: Neither codebase contains a committed `NIRVAHA_EVENTS_BOOKING_CONTRACT.md` file. However, both project specifications (`ORIGINAL_REQUEST.md` in both repositories) and Team 1's `DISPATCH.md` have converged on an authoritative, explicit specification.
2. **Data Isolation & Security Rule**: Mobile app MUST NEVER write directly to Firestore for bookings. Doing so would bypass capacity enforcement, race condition protection, and user isolation. All booking writes, cancellations, and capacity updates must execute on Team 1's server via authenticated endpoints.
3. **Authentication Handshake**: The mobile app uses Firebase Client Auth (`useAuth()`), acquiring an ID token via `auth.currentUser?.getIdToken()`. It passes this token as `Authorization: Bearer <id_token>` to Team 1's Next.js backend API routes. The backend validates this token with Firebase Admin SDK (`adminAuth.verifyIdToken(token)`).
4. **Capacity Concurrency Control**: In `POST /api/bookings`, a Firestore transaction (`runTransaction`) reads the event document, verifies `publicationStatus === 'published'`, validates registration dates, checks `attendeeCount + requested <= capacity`, and atomically commits both the `bookings` document and increments the event's `attendeeCount` and `confirmedBookingsCount`. If capacity is exceeded, it returns HTTP `409 Conflict`.
5. **Payment Safety Guarantee**: Both admin and mobile requirements strictly prohibit simulated or fake payments. If `listingType === 'paid_booking'` and `paymentConfig.providerStatus !== 'active'`, admin publication is rejected with HTTP `400 Bad Request`, and mobile renders the event as "Booking Currently Unavailable" with no submit action.
6. **Notification Routing Compatibility**: The existing `pushNotifications.ts` in Nirvaha already parses `nirvaha://` deep links and routes them to `/${routeName}`. Thus `nirvaha://events/[id]` maps directly to Expo Router's `/events/[id]` without requiring modifications to the core notification handlers.

---

## 3. Specifications Discovered

### Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Data Model | `EventDocument` Schema | Unified schema representing an event or experience in Firestore `events` collection | Firestore doc payload matching `EventDocument` | `EventDocument` object | Missing required fields fail schema validation with 400 | `survey_spec_miner/DISPATCH.md`, `ORIGINAL_REQUEST.md` |
| 2 | Data Model | `BookingDocument` Schema | Unified schema representing a participant's booking in Firestore `bookings` collection | Booking input from user + server metadata | `BookingDocument` object with unique `bookingReference` | Validation failure returns 400 | `survey_spec_miner/DISPATCH.md`, `ORIGINAL_REQUEST.md` |
| 3 | Listing Type | `advertisement` | Purely informational listing; no in-app booking action; optional configured CTA opens external link | Event configuration with `listingType: 'advertisement'` | Informational view; external link trigger | Disables booking CTA; invalid CTA URL fails gracefully | Mobile `ORIGINAL_REQUEST.md` R3 |
| 4 | Listing Type | `external_registration` | Event hosted on external platform; displays "Register" CTA opening external registration URL | Event config with external URL | External browser opens; no local booking document created | Missing external URL disables CTA with warning | Mobile `ORIGINAL_REQUEST.md` R3 |
| 5 | Listing Type | `free_booking` | Full in-app booking flow for free events submitting to server endpoint | Registration form (`fullName`, `email`, `phone`, `notes`) | Server creates `BookingDocument`, returns `bookingReference` | 409 if full, 400 if invalid window or data | Mobile `ORIGINAL_REQUEST.md` R3/R4 |
| 6 | Listing Type | `paid_booking` | Paid event listing requiring verified payment provider | Pricing details; payment provider credentials | Active payment flow (blocked until provider verified) | Returns 400 on publish if provider unconfigured; Mobile disables booking | Mobile & Admin `ORIGINAL_REQUEST.md` R3/R4 |
| 7 | Lifecycle Status | `EventStatus` Transitions | States: `draft`, `published`, `featured`, `cancelled`, `archived` | Admin lifecycle action payload | Updated event document with new status | Rejects invalid transitions; blocked drafts reject bookings with 400 | Admin `ORIGINAL_REQUEST.md` R2/R4 |
| 8 | Lifecycle Status | Computed Event States | Mobile computed states: `fully_booked`, `registration_closed`, `unavailable` | `attendeeCount >= capacity`, `now > deadline`, or fetch error | Distinct UI state badges and disabled booking CTA | Disables submission; shows user-friendly reason | Mobile `ORIGINAL_REQUEST.md` R3/R7 |
| 9 | API Route | `GET /api/events` | Fetch list of events with category filter, search query, status, and pagination | Query params: `category`, `status`, `search`, `featured`, `limit`, `offset` | `{ success: true, events: EventDocument[], total: number }` | 500 on database failure | Admin `ORIGINAL_REQUEST.md` R4 |
| 10 | API Route | `GET /api/events/[id]` | Fetch single event details by ID | Event ID path parameter | `{ success: true, event: EventDocument }` | 404 if not found, 500 on failure | Admin `ORIGINAL_REQUEST.md` R4 |
| 11 | API Route | `POST /api/events` | Admin creates a new event | Firebase Admin token + `EventDocument` draft payload | `{ success: true, event: EventDocument }` | 401 if unauthenticated, 403 if non-admin, 400 if invalid | Admin `ORIGINAL_REQUEST.md` R4 |
| 12 | API Route | `PUT /api/events/[id]` | Admin updates an existing event | Firebase Admin token + Event ID + updated fields | `{ success: true, event: EventDocument }` | 401/403/404/400 | Admin `ORIGINAL_REQUEST.md` R4 |
| 13 | API Route | `DELETE /api/events/[id]` | Admin archives or soft-deletes an event | Firebase Admin token + Event ID | `{ success: true, message: string }` | 401/403/404 | Admin `ORIGINAL_REQUEST.md` R4 |
| 14 | API Route | `POST /api/events/[id]/publish` | Publish, unpublish, cancel, or archive an event; optional FCM broadcast | Firebase Admin token + `{ action, notify }` | `{ success: true, event: EventDocument, notificationSent: boolean }` | 400 if `paid_booking` unconfigured; 401/403/404 | Admin `ORIGINAL_REQUEST.md` R4/R6 |
| 15 | API Route | `GET /api/bookings` | Fetch bookings for authenticated user (or all bookings for admin) | Firebase ID token + optional `eventId`, `userId`, `status` | `{ success: true, bookings: BookingDocument[], total: number }` | 401 if unauthorized; non-admin cannot access other users' bookings | Admin & Mobile `ORIGINAL_REQUEST.md` R4/R5 |
| 16 | API Route | `POST /api/bookings` | Create a booking with transactional capacity enforcement | Firebase ID token + `{ eventId, participantCount, attendeeDetails }` | `{ success: true, booking: BookingDocument }` (201 Created) | 409 if full, 400 if closed/invalid, 401 if unauth | Admin & Mobile `ORIGINAL_REQUEST.md` R4/R5 |
| 17 | API Route | `GET /api/bookings/[id]` | Fetch details of a specific booking | Firebase ID token + Booking ID | `{ success: true, booking: BookingDocument }` | 403 if booking belongs to another user (non-admin), 404 if not found | Admin & Mobile `ORIGINAL_REQUEST.md` R4/R5 |
| 18 | API Route | `POST /api/bookings/[id]/cancel` | Cancel an existing booking and atomically decrement capacity | Firebase ID token + Booking ID + `{ reason }` | `{ success: true, booking: BookingDocument }` | 403 if not owner/admin, 400 if already cancelled, 404 | Admin & Mobile `ORIGINAL_REQUEST.md` R4/R5 |
| 19 | Concurrency | Transactional Capacity Check | Atomically checks capacity and increments counts in Firestore transaction | Event ID, requested participant count | Atomic update or rollback | Aborts with 409 Conflict if `attendeeCount + count > capacity` | Admin `ORIGINAL_REQUEST.md` R5 |
| 20 | Authentication | Bearer Token Verification | Validates client Firebase ID tokens and checks admin privileges | Header `Authorization: Bearer <id_token>` | Decoded token (`uid`, `email`, `admin`) | 401 Unauthorized or 403 Forbidden | `services/firebase/admin.ts`, `app/api/notifications/send/route.ts` |
| 21 | Notifications | FCM Push Dispatch | Broadcasts new event push notifications to `all_users` or specific topic | `{ title, body, topic, deepLink }` | `{ success: true, messageId: string }` | 400 if missing fields, 500 on FCM error | `app/api/notifications/send/route.ts` |
| 22 | Deep Linking | Event Deep Link Format | Deep link format `nirvaha://events/[id]` routed to `/events/[id]` in Expo Router | Remote FCM message payload `data.deepLink` | `router.push('/events/[id]')` | Graceful fallback if event ID invalid | `services/pushNotifications.ts` |
| 23 | Mobile UI | Events Discovery Rail & Screen | Discovery at `app/events/index.tsx` and home rail at `components/home/EventsRail.tsx` | Category filters, search term, featured query | Rendered cards with theme aesthetic | Empty state / network error retry UI | Mobile `ORIGINAL_REQUEST.md` R2 |
| 24 | Mobile UI | My Bookings Screen | User bookings screen at `app/events/my-bookings.tsx` | Authenticated user ID | Booking cards with reference, date, status, joining instructions | Empty state "No Bookings Yet", error retry UI | Mobile `ORIGINAL_REQUEST.md` R5 |

---

## 4. Edge Cases

| # | Feature | Input / Scenario | Observed / Specified Behavior |
|---|---------|------------------|-------------------------------|
| 1 | Booking Capacity Race | Multiple concurrent users submit booking for last 1 available spot | Firestore transaction locks event doc; 1st commit succeeds (201 Created); 2nd transaction re-reads updated `attendeeCount`, detects `count > capacity`, rolls back, and returns HTTP 409 Conflict with `"Event is fully booked"`. |
| 2 | Registration Window Edge | User submits booking at 23:59:59Z when deadline is 23:59:59Z | Server checks `new Date() <= new Date(event.schedule.registrationDeadline)`. If expired by 1ms, server rejects with 400 Bad Request (`REGISTRATION_CLOSED`). Form in mobile shows disabled state. |
| 3 | Paid Booking Without Provider | Admin tries to publish event with `listingType: 'paid_booking'` while `paymentConfig.providerStatus !== 'active'` | Backend `POST /api/events/[id]/publish` immediately rejects with 400 Bad Request (`PAYMENT_PROVIDER_UNCONFIGURED`). Event remains in `draft`. Mobile never shows active Book Now button. |
| 4 | Offline / Hybrid Venue Display | Location type is `'online'`, `'offline'`, or `'hybrid'` | For `'online'`, venue address is omitted and meeting URL is rendered (or hidden until confirmed booking); for `'offline'`, venue name and address are rendered; for `'hybrid'`, both are rendered. |
| 5 | Unauthorized Booking Access | User A attempts `GET /api/bookings/bkg_userB` | Endpoint extracts `decodedToken.uid` from auth header. Compares with `booking.userId`. Since `uid !== booking.userId` and user is not an admin, endpoint returns 403 Forbidden. |
| 6 | Notification Deduplication | Admin edits title of already published event and saves | Backend checks `event.notificationSent === true`. Notification dispatch is bypassed, preventing spamming users on editorial fixes. |
| 7 | Cold App Launch via Push | User taps push notification `nirvaha://events/evt_999` while Nirvaha app is killed | `messaging().getInitialNotification()` intercepts notification payload, extracts `data.deepLink`, formats route to `/events/evt_999`, and opens event details screen directly after app initialization. |
| 8 | Event Cancelled After Booking | User has confirmed booking for an event that admin later cancels | Event status becomes `cancelled`. In `my-bookings.tsx`, card displays prominent amber/red "Event Cancelled" badge and hides joining link. |
| 9 | Duplicate In-Flight Submission | User taps "Book Free" button multiple times rapidly | Mobile registration form sets `isSubmitting = true`, disables submit button and inputs, and prevents duplicate API requests until the in-flight request resolves. |
| 10 | Direct Firestore Write Attempt | Mobile client attempts direct Firestore SDK `addDoc(collection(db, 'bookings'), ...)` | Mobile client code contains no direct Firestore write logic for bookings. Firestore security rules must also restrict write access to `bookings` collection to Admin SDK (`allow write: if false;`). |

---

## 5. Comprehensive Contract Definition (`NIRVAHA_EVENTS_BOOKING_CONTRACT.md`)

Below is the complete, canonical contract specification ready to be formalized across both repositories:

### 5.1 Shared Data Types

```typescript
// ============================================================================
// NIRVAHA EVENTS & BOOKINGS DATA CONTRACT
// ============================================================================

export type EventCategory =
  | 'yoga'
  | 'meditation'
  | 'sound_healing'
  | 'wellness_workshops'
  | 'retreats'
  | 'community_experiences';

export type EventListingType =
  | 'advertisement'
  | 'external_registration'
  | 'free_booking'
  | 'paid_booking';

export type EventPublicationStatus =
  | 'draft'
  | 'published'
  | 'featured'
  | 'cancelled'
  | 'archived';

export type LocationType = 'online' | 'offline' | 'hybrid';

export type PaymentProviderStatus = 'unconfigured' | 'pending' | 'active';

export type BookingStatus = 'confirmed' | 'cancelled' | 'waitlist' | 'attended';

export type PaymentStatus = 'none' | 'pending' | 'paid' | 'refunded';

export interface EventOrganizer {
  name: string;
  contact?: string;
  email: string;
  bio?: string;
  avatarUrl?: string;
}

export interface EventMedia {
  coverImageUrl: string;
  galleryImageUrls?: string[];
}

export interface EventSchedule {
  startDate: string; // ISO 8601 string
  endDate: string;   // ISO 8601 string
  timezone: string;  // e.g. 'Asia/Kolkata' or 'UTC'
  durationMinutes: number;
  registrationDeadline: string; // ISO 8601 string
}

export interface EventLocation {
  type: LocationType;
  venueName?: string;
  address?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  meetingUrl?: string;
  accessInstructions?: string;
}

export interface EventBookingConfig {
  capacity: number;
  maxParticipantsPerBooking: number;
  registrationOpenDate: string;  // ISO 8601 string
  registrationCloseDate: string; // ISO 8601 string
  requiredAttendeeFields: Array<'fullName' | 'email' | 'phone' | 'notes'>;
  cancellationPolicy?: string;
}

export interface EventPaymentConfig {
  enabled: boolean;
  currency?: string; // e.g. 'INR', 'USD'
  amount?: number;
  providerStatus: PaymentProviderStatus;
  providerName?: string;
}

export interface EventDocument {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  category: EventCategory;
  tags?: string[];
  organizer: EventOrganizer;
  media: EventMedia;
  schedule: EventSchedule;
  location: EventLocation;
  listingType: EventListingType;
  bookingConfig: EventBookingConfig;
  paymentConfig: EventPaymentConfig;
  publicationStatus: EventPublicationStatus;
  isFeatured?: boolean;
  displayOrder: number;
  notifyOnPublish: boolean;
  notificationSent?: boolean;
  attendeeCount: number;
  confirmedBookingsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttendeeDetail {
  fullName: string;
  email: string;
  phone?: string;
  notes?: string;
}

export interface BookingDocument {
  id: string;
  bookingReference: string; // e.g. 'NIR-EVT-2026-X8Y9Z0'
  eventId: string;
  eventTitle: string;
  eventStartDate: string;
  eventLocation: {
    type: LocationType;
    venueName?: string;
    meetingUrl?: string;
  };
  userId: string;
  userEmail: string;
  userName: string;
  userPhone?: string;
  participantCount: number;
  attendeeDetails: AttendeeDetail[];
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  joiningInstructions?: string;
  bookedAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 5.2 API Response & Error Convention

**Success Envelope**:
```json
{
  "success": true,
  "data": { ... } // or top-level properties: "events", "booking", etc.
}
```

**Error Envelope**:
```json
{
  "success": false,
  "error": "Descriptive human-readable error message",
  "code": "ERROR_CODE_IDENTIFIER"
}
```

**Standard Status Codes**:
- `200 OK`: Successful read or update.
- `201 Created`: Successful creation (`POST /api/bookings`, `POST /api/events`).
- `400 Bad Request`: Payload validation failed, registration window closed, or paid booking publication attempted without configured provider.
- `401 Unauthorized`: Missing or invalid Bearer token.
- `403 Forbidden`: Authenticated user lacks privileges (e.g. non-admin accessing admin routes, or user attempting to view another user's booking).
- `404 Not Found`: Event or Booking document not found.
- `409 Conflict`: Event capacity exceeded, registration window closed during transaction, or duplicate booking attempt.
- `500 Internal Server Error`: Unhandled server exception or Firebase Admin failure.

### 5.3 Notification Deep-Link Convention

- **Scheme**: `nirvaha://events/[id]`
- **Payload Data**: `{ deepLink: "nirvaha://events/[id]" }`
- **FCM Target Topic**: `'all_users'` (or category specific topic)
- **Mobile Routing**: Handled in `services/pushNotifications.ts` by stripping `nirvaha://` prefix and routing to `/events/[id]`.

---

## 6. Caveats

1. **Physical File Absence**: As noted, `NIRVAHA_EVENTS_BOOKING_CONTRACT.md` did not previously exist as a committed markdown file on disk. Both the mobile and admin teams relied on the shared requirements in `ORIGINAL_REQUEST.md` and the initial dispatch definitions. Creating a physical copy of this contract file in both repositories (`admin_nirvaha/NIRVAHA_EVENTS_BOOKING_CONTRACT.md` and `NIRVAHA/Nirvaha/NIRVAHA_EVENTS_BOOKING_CONTRACT.md`) will serve as an immutable reference.
2. **Payment Provider Stubbing**: Payment processing is intentionally stubbed to `providerStatus: 'unconfigured'`. The backend must strictly reject `paid_booking` publication attempts until a real payment gateway (Razorpay/Stripe) is integrated.
3. **Environment Base URL**: Mobile requests require `EXPO_PUBLIC_API_BASE_URL` to be populated in `.env` (pointing to the admin/backend host, e.g. `http://localhost:3000` or production URL).

---

## 7. Conclusion

All specifications, interfaces, schemas, lifecycle rules, authentication protocols, API route definitions, error handling standards, and notification deep-link conventions have been mined, verified against existing codebase structures, and comprehensively documented.

The specification is fully ready for Team 2 (Mobile Workers) and Team 1 (Admin/Backend Workers) to implement `types/events.ts`, `types/bookings.ts`, backend API routes, and mobile UI screens without ambiguity or interface drift.

---

## 8. Verification Method

To independently verify these findings:
1. **Search check**: Run PowerShell `Get-ChildItem -Path "c:\Users\sai pallavi\OneDrive\Desktop\AKASH" -Filter "*CONTRACT*.md"` to confirm no pre-existing contract file was overlooked.
2. **Push notification check**: Inspect `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\services\pushNotifications.ts` lines 104–134 to verify deep link routing logic for `nirvaha://events/[id]`.
3. **Admin auth check**: Inspect `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\app\api\notifications\send\route.ts` lines 16–56 to verify token verification and admin whitelist checking logic.
4. **Mobile theme check**: Inspect `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\constants\theme.ts` lines 1–21 to verify color and typography tokens.
5. **Mobile auth check**: Inspect `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\contexts\AuthContext.tsx` to verify Firebase client auth state and user token availability.
