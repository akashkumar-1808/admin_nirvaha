# NIRVAHA EVENTS, EXPERIENCES & BOOKINGS — SHARED DATA & API CONTRACT

**Version**: 1.0.0  
**Status**: Authoritative Contract Specification  
**Applies to**:  
- Admin Web Console: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha`  
- Mobile Client App: `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`  
**Last Updated**: 2026-11-05  

---

## 1. Executive Summary

This contract defines the unified data architecture, REST API route contracts, FCM push notification specifications, deep linking protocols, and transactional booking rules connecting the Nirvaha Admin Management Console and the Nirvaha Mobile Application.

### Core Architectural Invariants:
1. **Source of Truth**: Firestore database under Firebase Project `nirvaha-app`.
2. **Atomic Capacity & Overbooking Prevention**: All booking reservations and cancellations are committed within Firestore ACID transactions (`runTransaction`), strictly prohibiting overbooking.
3. **Payment Safeguard**: Events with `listingType === 'paid_booking'` cannot be published while payment providers remain unconfigured. Attempts to publish return `400 Bad Request`.
4. **Data Privacy & Isolation**: Regular mobile users can only query and cancel their own bookings (`userId === request.auth.uid`). Only verified administrators can access multi-user booking records.
5. **Idempotent Push Notifications**: An event broadcast notification is sent at most once upon initial publication; subsequent edits never trigger duplicate notifications.

---

## 2. Deep Linking & Push Notification Specification

### 2.1 Deep Link URI Scheme
The canonical deep link URI for event listings is:
```text
nirvaha://events/{id}
```
- **Scheme**: `nirvaha://` (with fallback mapping from `nirvahaapp://events/{id}`)
- **Path**: `events/{id}`
- **Expo Router Target**: `/events/[id]`

#### Deep Link Route Resolution in Mobile (`services/pushNotifications.ts`):
```typescript
const handleDeepLink = (remoteMessage: any) => {
  const deepLink = remoteMessage?.data?.deepLink;
  if (deepLink) {
    let targetRoute = '';
    if (deepLink.startsWith('nirvaha://')) {
      const routeName = deepLink.replace('nirvaha://', '');
      targetRoute = `/${routeName}`; // Maps 'events/xyz123' -> '/events/xyz123'
    } else {
      targetRoute = deepLink;
    }
    if (targetRoute) {
      router.push(targetRoute as any);
    }
  }
};
```

### 2.2 FCM Notification Payload Schema
Push notifications are dispatched via Firebase Cloud Messaging using the server-side Firebase Admin SDK (`adminMessaging.send()`).

#### Topic Subscriptions:
- **Default Broadcast Topic**: `all_users` (all registered mobile devices automatically subscribe on startup)
- **Dedicated Events Topic**: `events_broadcast` (opt-in topic for community event updates)

#### Android Channel Configuration:
- **Channel ID**: `nirvaha_general_broadcast`
- **Importance**: `Notifications.AndroidImportance.MAX` (High priority heads-up banner)
- **Vibration Pattern**: `[0, 250, 250, 250]`
- **Light Color**: `#FF231F7C`

#### Wire Payload Schema:
```json
{
  "notification": {
    "title": "New Experience: Sound Healing Under the Banyan Tree",
    "body": "Join Master Anand for a deep 60-minute meditative sound journey. Limited seats available."
  },
  "android": {
    "priority": "high",
    "notification": {
      "channelId": "nirvaha_general_broadcast",
      "imageUrl": "https://storage.googleapis.com/nirvaha-app.appspot.com/events/sound-healing.jpg"
    }
  },
  "apns": {
    "payload": {
      "aps": {
        "mutable-content": 1,
        "sound": "default"
      }
    },
    "fcmOptions": {
      "imageUrl": "https://storage.googleapis.com/nirvaha-app.appspot.com/events/sound-healing.jpg"
    }
  },
  "data": {
    "deepLink": "nirvaha://events/evt_sound_healing_01",
    "eventId": "evt_sound_healing_01",
    "type": "EVENT_ANNOUNCEMENT",
    "category": "sound_healing"
  },
  "topic": "all_users"
}
```

### 2.3 Idempotency & Notification Dispatch Guard
In the `Event` document:
- `notifyOnPublish`: boolean (admin toggle in event creation/edit form).
- `notificationSent`: boolean (defaults to `false`). Set to `true` when the FCM message is successfully dispatched.
- `notificationSentAt`: ISO 8601 string recording the exact timestamp of dispatch.

**Rule**:
```typescript
if (action === 'publish' && event.notifyOnPublish === true && event.notificationSent !== true) {
  await dispatchFcmEventNotification(event);
  await eventRef.update({
    notificationSent: true,
    notificationSentAt: new Date().toISOString()
  });
}
```
Subsequent updates, edits, unpublishing, or re-publishing must NOT re-trigger the broadcast unless explicitly forced by an administrator.

---

## 3. Canonical Data Models & TypeScript Contracts

### 3.1 Type Definitions (`types/events.ts`)

```typescript
export type EventCategory = 
  | 'meditation'
  | 'yoga'
  | 'sound_healing'
  | 'breathwork'
  | 'philosophy'
  | 'retreat'
  | 'workshop'
  | 'temple_tour'
  | 'community';

export type ListingType = 
  | 'advertisement'         // Informational card, no in-app registration
  | 'external_registration' // Links out to external ticket/registration URL
  | 'free_booking'          // In-app reservation with capacity tracking
  | 'paid_booking';         // In-app paid reservation (blocked when provider unconfigured)

export type LocationType = 'online' | 'offline' | 'hybrid';

export type PublicationStatus = 
  | 'draft'      // Editable, only visible in Admin Console
  | 'published'  // Live in mobile app, accepting bookings
  | 'featured'   // Live + pinned to mobile hero highlights
  | 'cancelled'  // Live notice of cancellation, bookings locked
  | 'archived';  // Retired listing, hidden from general listings

export type PaymentProviderStatus = 'unconfigured' | 'test_mode' | 'live' | 'blocked';
export type PaymentProvider = 'none' | 'razorpay' | 'stripe';

export interface OrganizerInfo {
  name: string;
  email: string;
  contact: string;
  avatarUrl?: string;
  bio?: string;
}

export interface MediaConfig {
  coverImageUrl: string;
  galleryImageUrls: string[];
}

export interface ScheduleConfig {
  startDate: string;            // ISO 8601 UTC
  endDate: string;              // ISO 8601 UTC
  timezone: string;             // e.g. "Asia/Kolkata"
  durationMinutes: number;      // e.g. 90
  registrationDeadline: string; // ISO 8601 UTC
}

export interface LocationConfig {
  type: LocationType;
  venueName?: string;           // Required for offline/hybrid
  address?: string;             // Required for offline/hybrid
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  meetingUrl?: string;          // Required for online/hybrid (only exposed to confirmed attendees if private)
  accessInstructions?: string;  // Landmark directions, room pin, or dress code
}

export interface BookingConfig {
  capacity: number;                  // Maximum total participants allowed (0 = unlimited if isUnlimitedCapacity)
  isUnlimitedCapacity: boolean;      // If true, bypasses capacity checks
  maxParticipantsPerBooking: number; // Maximum seats per single reservation (default: 1, max: 10)
  registrationOpenDate: string;      // ISO 8601 UTC
  registrationCloseDate: string;     // ISO 8601 UTC
  requiredAttendeeFields: Array<'name' | 'email' | 'phone' | 'dietary' | 'emergency_contact'>;
  cancellationPolicy: string;
  allowWaitlist: boolean;
}

export interface PaymentConfig {
  enabled: boolean;
  currency: string;                  // e.g. "INR", "USD"
  amount: number;                    // in standard units (e.g. INR 500)
  provider: PaymentProvider;
  providerStatus: PaymentProviderStatus;
}

export interface EventListing {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  category: EventCategory;
  tags: string[];
  organizer: OrganizerInfo;
  media: MediaConfig;
  schedule: ScheduleConfig;
  location: LocationConfig;
  listingType: ListingType;
  externalUrl?: string;             // Required when listingType === 'external_registration'
  bookingConfig: BookingConfig;
  paymentConfig: PaymentConfig;
  publicationStatus: PublicationStatus;
  displayOrder: number;
  notifyOnPublish: boolean;
  notificationSent: boolean;
  notificationSentAt?: string;
  attendeeCount: number;            // Current total number of confirmed individual attendees
  confirmedBookingsCount: number;   // Current total number of booking transactions
  createdBy: string;                // Admin user ID or email
  updatedBy: string;                // Admin user ID or email
  createdAt: string;                // ISO 8601 UTC
  updatedAt: string;                // ISO 8601 UTC
}
```

---

### 3.2 Type Definitions (`types/bookings.ts`)

```typescript
export type BookingStatus = 
  | 'confirmed'  // Reservation confirmed and seat allocated
  | 'cancelled'  // Reservation cancelled, seat returned to capacity pool
  | 'waitlist'   // Queued for capacity opening
  | 'attended';  // Marked as attended by event organizers

export interface AttendeeDetail {
  fullName: string;
  email?: string;
  phone?: string;
  dietary?: string;
  emergencyContact?: string;
  customResponses?: Record<string, string>;
}

export interface EventBooking {
  id: string;
  bookingReference: string;       // Unique human-readable code e.g. "NIR-EVT-7K2X9P"
  eventId: string;
  eventTitle: string;             // Denormalized for rapid mobile rendering
  eventCategory: EventCategory;
  eventStartDate: string;         // ISO 8601 UTC
  eventEndDate: string;           // ISO 8601 UTC
  eventLocationType: LocationType;
  eventVenueOrUrl: string;        // Physical address or online meeting link
  userId: string;                 // Firebase Auth UID
  userEmail: string;
  userName: string;
  userPhone?: string;
  participantCount: number;       // Number of tickets/attendees booked (>= 1)
  attendeeDetails: AttendeeDetail[];
  status: BookingStatus;
  bookedAt: string;               // ISO 8601 UTC
  cancelledAt?: string;           // ISO 8601 UTC
  cancellationReason?: string;
  cancelledBy?: 'user' | 'admin';
  updatedAt: string;              // ISO 8601 UTC
}
```

---

## 4. Authenticated Backend API Specifications

All endpoints require HTTPS and standard Firebase Bearer token authentication in the `Authorization` header:
```http
Authorization: Bearer <firebase_id_token>
```

### 4.1 Summary of API Endpoints

| Method | Endpoint | Access Role | Description |
|---|---|---|---|
| `GET` | `/api/events` | Public / Admin | List events (Public: published/featured only; Admin: all statuses) |
| `POST` | `/api/events` | Admin Only | Create a new event listing (defaults to draft) |
| `GET` | `/api/events/[id]` | Public / Admin | Retrieve full event details |
| `PUT` | `/api/events/[id]` | Admin Only | Update existing event listing |
| `DELETE` | `/api/events/[id]` | Admin Only | Soft-delete / archive event (hard delete rejected if bookings exist) |
| `POST` | `/api/events/[id]/publish` | Admin Only | Transition event status (publish/unpublish/feature/cancel/archive) |
| `GET` | `/api/bookings` | User / Admin | List bookings (User: own bookings only; Admin: all bookings) |
| `POST` | `/api/bookings` | Authenticated User | Atomically reserve seats via Firestore transaction |
| `GET` | `/api/bookings/[id]` | Owner / Admin | Retrieve specific booking record |
| `POST` | `/api/bookings/[id]/cancel` | Owner / Admin | Atomically cancel booking and release seats |

---

### 4.2 Endpoint Specifications

#### 1. `GET /api/events`
- **Query Parameters**:
  - `timeframe`: `'upcoming'` (default) | `'past'` | `'all'`
  - `status`: `'all'` | `'published'` | `'draft'` | `'featured'` | `'cancelled'` | `'archived'` (Admin only for non-published)
  - `category`: Filter by `EventCategory`
  - `listingType`: Filter by `ListingType`
  - `search`: Case-insensitive text search matching title or tags
  - `sort`: `'startDate_asc'` (default) | `'startDate_desc'` | `'createdAt_desc'` | `'displayOrder_asc'`
  - `page`: number (default: 1)
  - `limit`: number (default: 20, max: 100)
- **Response Format (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "evt_meditation_101",
      "title": "Sunrise Vipassana Meditation",
      "shortDescription": "Begin your day with grounding mindfulness at the lotus pavilion.",
      "category": "meditation",
      "listingType": "free_booking",
      "publicationStatus": "published",
      "schedule": {
        "startDate": "2026-11-20T06:00:00.000Z",
        "endDate": "2026-11-20T07:30:00.000Z",
        "timezone": "Asia/Kolkata",
        "durationMinutes": 90,
        "registrationDeadline": "2026-11-19T22:00:00.000Z"
      },
      "location": {
        "type": "offline",
        "venueName": "Lotus Pavilion, Nirvaha Ashram",
        "address": "Rishikesh, Uttarakhand, India"
      },
      "bookingConfig": {
        "capacity": 30,
        "isUnlimitedCapacity": false,
        "maxParticipantsPerBooking": 2,
        "registrationOpenDate": "2026-11-01T00:00:00.000Z",
        "registrationCloseDate": "2026-11-19T22:00:00.000Z",
        "requiredAttendeeFields": ["name", "email", "phone"],
        "cancellationPolicy": "Cancel anytime up to 12 hours before event start."
      },
      "attendeeCount": 18,
      "confirmedBookingsCount": 12,
      "media": {
        "coverImageUrl": "https://storage.googleapis.com/nirvaha-app.appspot.com/events/lotus.jpg",
        "galleryImageUrls": []
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasMore": false
  }
}
```

---

#### 2. `POST /api/events`
- **Access**: Administrator only.
- **Request Body**: Full `EventListing` payload (excluding `id`, `attendeeCount`, `confirmedBookingsCount`, `notificationSent`, timestamps).
- **Validation**:
  - `title`: string (3-120 chars)
  - `shortDescription`: string (10-250 chars)
  - `category`: valid `EventCategory`
  - `schedule.startDate` < `schedule.endDate`
  - `schedule.registrationDeadline` <= `schedule.startDate`
  - If `listingType === 'paid_booking'`, `paymentConfig.enabled` must be true and `amount` > 0.
- **Response Format (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "evt_gen_8b2a3c",
    "title": "Sound Immersion Evening",
    "publicationStatus": "draft",
    "attendeeCount": 0,
    "confirmedBookingsCount": 0,
    "notificationSent": false,
    "createdAt": "2026-11-05T14:00:00.000Z",
    "updatedAt": "2026-11-05T14:00:00.000Z"
  }
}
```

---

#### 3. `POST /api/events/[id]/publish`
- **Access**: Administrator only.
- **Request Body**:
```json
{
  "action": "publish", // "publish" | "unpublish" | "feature" | "cancel" | "archive"
  "notifyOnPublish": true
}
```
- **Crucial Enforcement Rules**:
  1. **Payment Blocking Rule**:
     If `action === 'publish'` or `'feature'` AND `event.listingType === 'paid_booking'`:
     If `event.paymentConfig.providerStatus !== 'live'` or `event.paymentConfig.enabled !== true`:
     **MUST ABORT IMMEDIATELY with HTTP 400 Bad Request**:
     ```json
     {
       "success": false,
       "code": "PAYMENT_PROVIDER_UNCONFIGURED",
       "error": "Paid booking events cannot be published without an active, verified payment provider configuration."
     }
     ```
  2. **Notification Broadcast**:
     If `action === 'publish'` or `'feature'` and `notifyOnPublish === true` and `event.notificationSent !== true`:
     Dispatches FCM message to `all_users` topic with `nirvaha://events/[id]` deep link, then sets `notificationSent: true`.

---

#### 4. `POST /api/bookings`
- **Access**: Any authenticated user (`Authorization: Bearer <token>`).
- **Request Body**:
```json
{
  "eventId": "evt_meditation_101",
  "participantCount": 2,
  "attendeeDetails": [
    {
      "fullName": "Aarav Sharma",
      "email": "aarav@example.com",
      "phone": "+919876543210"
    },
    {
      "fullName": "Priya Sharma",
      "email": "priya@example.com",
      "phone": "+919876543211"
    }
  ]
}
```
- **Response Format (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "bk_98f3c1a4",
    "bookingReference": "NIR-EVT-7K2X9P",
    "eventId": "evt_meditation_101",
    "eventTitle": "Sunrise Vipassana Meditation",
    "participantCount": 2,
    "status": "confirmed",
    "bookedAt": "2026-11-05T14:15:30.000Z"
  }
}
```
- **Error Responses**:
  - `400 Bad Request` (`REGISTRATION_CLOSED`): Registration window has closed or deadline passed.
  - `400 Bad Request` (`EVENT_NOT_OPEN_FOR_BOOKING`): Event is draft, cancelled, or archived.
  - `409 Conflict` (`CAPACITY_EXCEEDED`): Requested seats exceed remaining capacity.
  ```json
  {
    "success": false,
    "code": "CAPACITY_EXCEEDED",
    "error": "Requested participants exceed available capacity. Seats remaining: 1",
    "availableCapacity": 1
  }
  ```

---

#### 5. `POST /api/bookings/[id]/cancel`
- **Access**: Booking Owner (`userId === token.uid`) or Administrator.
- **Request Body**:
```json
{
  "reason": "Family emergency"
}
```
- **Response Format (200 OK)**:
```json
{
  "success": true,
  "message": "Booking successfully cancelled",
  "data": {
    "id": "bk_98f3c1a4",
    "bookingReference": "NIR-EVT-7K2X9P",
    "status": "cancelled",
    "cancelledAt": "2026-11-05T14:30:00.000Z",
    "cancellationReason": "Family emergency",
    "cancelledBy": "user"
  }
}
```

---

## 5. Concurrency & Transactional Capacity Logic

To prevent race conditions, double booking, and phantom capacity consumption under concurrent load, Firestore's ACID transaction API (`adminDb.runTransaction()`) is strictly used.

### 5.1 Booking Creation Transaction Logic
```typescript
await adminDb.runTransaction(async (transaction) => {
  const eventRef = adminDb.collection('events').doc(eventId);
  const eventDoc = await transaction.get(eventRef);

  if (!eventDoc.exists) {
    const error: any = new Error('Event not found');
    error.statusCode = 404;
    error.code = 'EVENT_NOT_FOUND';
    throw error;
  }

  const event = eventDoc.data() as EventListing;

  // 1. Status Check
  if (event.publicationStatus !== 'published' && event.publicationStatus !== 'featured') {
    const error: any = new Error('Event is not open for bookings');
    error.statusCode = 400;
    error.code = 'EVENT_NOT_OPEN_FOR_BOOKING';
    throw error;
  }

  // 2. Listing Type Check
  if (event.listingType !== 'free_booking' && event.listingType !== 'paid_booking') {
    const error: any = new Error('This listing does not support direct in-app booking');
    error.statusCode = 400;
    error.code = 'BOOKING_NOT_SUPPORTED';
    throw error;
  }

  // 3. Registration Window Validation
  const now = new Date().toISOString();
  if (event.bookingConfig.registrationOpenDate && now < event.bookingConfig.registrationOpenDate) {
    const error: any = new Error('Registration for this event has not opened yet');
    error.statusCode = 400;
    error.code = 'REGISTRATION_NOT_OPEN_YET';
    throw error;
  }
  if (event.bookingConfig.registrationCloseDate && now > event.bookingConfig.registrationCloseDate) {
    const error: any = new Error('Registration for this event has closed');
    error.statusCode = 400;
    error.code = 'REGISTRATION_CLOSED';
    throw error;
  }
  if (event.schedule.registrationDeadline && now > event.schedule.registrationDeadline) {
    const error: any = new Error('Registration deadline has passed');
    error.statusCode = 400;
    error.code = 'DEADLINE_EXCEEDED';
    throw error;
  }

  // 4. Participant Count Constraints
  if (!participantCount || participantCount < 1) {
    const error: any = new Error('Participant count must be at least 1');
    error.statusCode = 400;
    error.code = 'INVALID_PARTICIPANT_COUNT';
    throw error;
  }
  const maxPerBooking = event.bookingConfig.maxParticipantsPerBooking || 1;
  if (participantCount > maxPerBooking) {
    const error: any = new Error(`Cannot book more than ${maxPerBooking} participants per reservation`);
    error.statusCode = 400;
    error.code = 'MAX_PARTICIPANTS_EXCEEDED';
    throw error;
  }

  // 5. Strict Capacity Enforcement
  if (!event.bookingConfig.isUnlimitedCapacity) {
    const currentAttendees = event.attendeeCount || 0;
    const capacity = event.bookingConfig.capacity;
    const remainingCapacity = Math.max(0, capacity - currentAttendees);

    if (currentAttendees + participantCount > capacity) {
      const error: any = new Error(`Requested seats exceed available capacity. Seats remaining: ${remainingCapacity}`);
      error.statusCode = 409;
      error.code = 'CAPACITY_EXCEEDED';
      error.availableCapacity = remainingCapacity;
      throw error;
    }
  }

  // 6. Generate Booking Reference and Document
  const bookingRef = adminDb.collection('bookings').doc();
  const bookingReference = generateBookingReference(); // e.g. "NIR-EVT-XXXXXX"

  const newBooking: EventBooking = {
    id: bookingRef.id,
    bookingReference,
    eventId: event.id,
    eventTitle: event.title,
    eventCategory: event.category,
    eventStartDate: event.schedule.startDate,
    eventEndDate: event.schedule.endDate,
    eventLocationType: event.location.type,
    eventVenueOrUrl: event.location.type === 'online' 
      ? (event.location.meetingUrl || '') 
      : (event.location.venueName || event.location.address || ''),
    userId: user.uid,
    userEmail: user.email || '',
    userName: user.name || attendeeDetails[0]?.fullName || 'Seeker',
    userPhone: attendeeDetails[0]?.phone || '',
    participantCount,
    attendeeDetails,
    status: 'confirmed',
    bookedAt: now,
    updatedAt: now
  };

  // 7. Write Booking and Update Event Atomically
  transaction.set(bookingRef, newBooking);
  transaction.update(eventRef, {
    attendeeCount: (event.attendeeCount || 0) + participantCount,
    confirmedBookingsCount: (event.confirmedBookingsCount || 0) + 1,
    updatedAt: now
  });

  return newBooking;
});
```

### 5.2 Booking Cancellation Transaction Logic
```typescript
await adminDb.runTransaction(async (transaction) => {
  const bookingRef = adminDb.collection('bookings').doc(bookingId);
  const bookingDoc = await transaction.get(bookingRef);

  if (!bookingDoc.exists) {
    const error: any = new Error('Booking not found');
    error.statusCode = 404;
    throw error;
  }

  const booking = bookingDoc.data() as EventBooking;

  // Authorization check
  if (!isAdmin && booking.userId !== callerUid) {
    const error: any = new Error('You do not have permission to cancel this booking');
    error.statusCode = 403;
    throw error;
  }

  if (booking.status !== 'confirmed') {
    const error: any = new Error('Only confirmed bookings can be cancelled');
    error.statusCode = 400;
    error.code = 'BOOKING_NOT_ACTIVE';
    throw error;
  }

  const eventRef = adminDb.collection('events').doc(booking.eventId);
  const eventDoc = await transaction.get(eventRef);
  const now = new Date().toISOString();

  // Atomically update booking status
  transaction.update(bookingRef, {
    status: 'cancelled',
    cancelledAt: now,
    cancellationReason: reason || 'Cancelled by user',
    cancelledBy: isAdmin ? 'admin' : 'user',
    updatedAt: now
  });

  // Atomically release reserved capacity if event exists
  if (eventDoc.exists) {
    const event = eventDoc.data() as EventListing;
    transaction.update(eventRef, {
      attendeeCount: Math.max(0, (event.attendeeCount || 0) - booking.participantCount),
      confirmedBookingsCount: Math.max(0, (event.confirmedBookingsCount || 0) - 1),
      updatedAt: now
    });
  }
});
```

---

## 6. Payment Blocking & Provider Safety Rules

1. **Default State**:
   - Every newly created event initializes with `paymentConfig.enabled = false` and `paymentConfig.providerStatus = 'unconfigured'`.
2. **Publish Barrier**:
   - If an administrator marks an event as `listingType === 'paid_booking'`, the system requires an active verified payment gateway configuration (`providerStatus === 'live'`).
   - In development/mock phases where payment gateways are unintegrated, the system blocks publishing with:
     - HTTP Status: `400 Bad Request`
     - Code: `PAYMENT_PROVIDER_UNCONFIGURED`
     - Error Message: *"Paid booking events cannot be published without an active, verified payment provider configuration."*
3. **Admin UI Form Guidance**:
   - When selecting **Paid Booking** in the Admin Console, an informative warning badge is displayed indicating that paid booking transactions are disabled until provider keys (Razorpay/Stripe) and verification webhooks are configured.
   - The UI disables the "Publish" button with a tooltip unless configured.

---

## 7. Security, Authorization & User Data Isolation

### 7.1 Admin Verification Pattern
Every route requiring admin privilege performs two-layer validation matching the existing console architecture:
```typescript
export async function verifyAdminRequest(req: NextRequest): Promise<{ email: string; uid: string }> {
  if (!adminAuth) {
    throw new ApiError(500, 'Firebase Admin SDK not initialized');
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid Authorization header');
  }

  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await adminAuth.verifyIdToken(token);
  const email = decodedToken.email || '';

  let isAuthorized = decodedToken.admin === true;
  if (!isAuthorized) {
    const authorizedEmailsStr = process.env.AUTHORIZED_ADMIN_EMAILS || '';
    const authorizedEmails = authorizedEmailsStr
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);

    isAuthorized = authorizedEmails.includes(email.toLowerCase());
  }

  if (!isAuthorized) {
    throw new ApiError(403, 'Forbidden: Admin authorization required');
  }

  return { email, uid: decodedToken.uid };
}
```

### 7.2 User Data Isolation
- When mobile users invoke `GET /api/bookings`, the query MUST enforce `where('userId', '==', decodedToken.uid)`.
- When accessing `GET /api/bookings/[id]`, if `booking.userId !== decodedToken.uid` and the caller is not an admin, the API returns `403 Forbidden`.
- Sensitive organizer contact notes or internal admin tags are scrubbed from public mobile responses.

---

## 8. Mobile Integration Guide (`Nirvaha` App)

### 8.1 Proposed Route Structure
```text
Nirvaha/app/
├── events/
│   ├── index.tsx              # Browse events with category filters and search
│   ├── [id].tsx               # Deep link target for nirvaha://events/[id]
│   └── [id]/
│       ├── book.tsx           # Multi-attendee booking reservation modal
│       └── confirmation.tsx   # Success screen with bookingReference & calendar export
└── profile/
    └── bookings.tsx           # User's reservations (Active, Past, Cancelled)
```

### 8.2 Mobile Experience Expectations
1. **Real-time Availability**:
   - The event screen displays live availability (e.g., "Only 3 seats remaining").
   - When `attendeeCount >= capacity`, the booking CTA changes to **Event Full** (disabled) or **Join Waitlist**.
2. **Deep Link Handling**:
   - Launching `nirvaha://events/[id]` from a push notification immediately resolves to `/events/[id]`.
   - If the user is unauthenticated, the app redirects to `/pages/Auth` and resumes to `/events/[id]` upon successful login.
3. **Attendee Information Gathering**:
   - Dynamically renders input fields based on `event.bookingConfig.requiredAttendeeFields`.
   - Pre-fills primary attendee name and email from `useAuth()` context.

---

## 9. Error Code Catalog

| Error Code | HTTP Status | Description | Trigger Condition |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid Firebase Bearer token | Authorization header missing or token expired |
| `FORBIDDEN` | 403 | Caller does not have required permissions | Non-admin accessing admin route, or user accessing another user's booking |
| `EVENT_NOT_FOUND` | 404 | Event ID does not exist | Invalid or deleted event ID |
| `BOOKING_NOT_FOUND` | 404 | Booking ID does not exist | Invalid or deleted booking ID |
| `EVENT_NOT_OPEN_FOR_BOOKING` | 400 | Event is not in published/featured status | User attempting to book a draft, cancelled, or archived event |
| `REGISTRATION_NOT_OPEN_YET` | 400 | Registration window not yet open | `now < registrationOpenDate` |
| `REGISTRATION_CLOSED` | 400 | Registration window has closed | `now > registrationCloseDate` |
| `DEADLINE_EXCEEDED` | 400 | Registration deadline has passed | `now > registrationDeadline` |
| `INVALID_PARTICIPANT_COUNT` | 400 | Invalid ticket count | `participantCount < 1` |
| `MAX_PARTICIPANTS_EXCEEDED` | 400 | Requested participants exceeds limit | `participantCount > maxParticipantsPerBooking` |
| `CAPACITY_EXCEEDED` | 409 | Event capacity is full | `attendeeCount + participantCount > capacity` |
| `PAYMENT_PROVIDER_UNCONFIGURED` | 400 | Paid booking cannot be published | Attempting to publish paid event without active provider |
| `BOOKING_ALREADY_CANCELLED` | 400 | Booking has already been cancelled | Attempting to cancel an inactive booking |
| `EVENT_HAS_ACTIVE_BOOKINGS` | 409 | Cannot hard delete event with bookings | Attempting hard delete on event with confirmed bookings |
| `INTERNAL_ERROR` | 500 | Unhandled server error | Firebase service failure or unhandled exception |
