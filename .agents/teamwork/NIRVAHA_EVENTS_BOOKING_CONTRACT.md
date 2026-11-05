# NIRVAHA EVENTS & BOOKINGS DATA & API CONTRACT

**Status**: Agreed Canonical Specification  
**Version**: 1.0.0  
**Effective**: 2026-11-05  

---

## 1. Data Models & TypeScript Definitions

```typescript
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
  externalUrl?: string;
}

export interface EventPaymentConfig {
  enabled: boolean;
  currency?: string;
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
  bookingReference: string; // Format: NIR-EVT-YYYY-XXXXXX
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

---

## 2. Dynamic Listing Types & Primary Actions

| Listing Type | Primary Action Label | Dynamic Behavior |
|--------------|----------------------|------------------|
| `advertisement` | None / Configured CTA | Informational only. No in-app booking. If an external link is configured, CTA opens destination. |
| `external_registration` | "Register" | Opens configured external URL via device browser (`Linking.openURL`). No in-app booking record. |
| `free_booking` | "Book Free" / "Register" | Opens in-app registration form (`/events/[id]/register`). Submits to `POST /api/bookings`. Navigates to `/events/[id]/confirmation`. |
| `paid_booking` | "Book Now" (Disabled) | Displays pricing details. Remains disabled with "Booking Currently Unavailable" until live payment gateway credentials and backend verification are confirmed. |

---

## 3. Event Status Matrix & Eligibility

| Event Status | Eligibility | UI Presentation | Booking Action Allowed? |
|--------------|-------------|-----------------|-------------------------|
| `published` | Eligible (if capacity > 0 and within registration dates) | Normal display | YES (for `free_booking`) |
| `featured` | Eligible (prioritized on rails) | Featured gold badge | YES (for `free_booking`) |
| `cancelled` | Ineligible | "Event Cancelled" badge | NO (Action disabled) |
| `archived` | Ineligible | "Event Concluded" badge | NO (Action disabled) |
| `fully_booked` (computed) | Ineligible | "Sold Out" badge | NO (Action disabled) |
| `registration_closed` (computed) | Ineligible | "Registration Closed" badge | NO (Action disabled) |
| `unavailable` | Ineligible | Error / Retry view | NO |

---

## 4. Backend API Endpoints (Team 1)

Base URL: Configured via `EXPO_PUBLIC_API_BASE_URL` (e.g. `https://backend-six-lac-91.vercel.app` or `http://localhost:3000`).

### Public / Client Endpoints
- `GET /api/events` — Query params: `category`, `search`, `featured`, `status=published`. Returns `{ success: true, events: EventDocument[], total: number }`.
- `GET /api/events/[id]` — Returns `{ success: true, event: EventDocument }`.
- `POST /api/bookings` — Auth: `Authorization: Bearer <id_token>`. Body: `{ eventId, participantCount, attendeeDetails }`. Returns `{ success: true, booking: BookingDocument }` (201 Created). Returns 409 Conflict if capacity exceeded.
- `GET /api/bookings` — Auth: `Authorization: Bearer <id_token>`. Query params: `userId`. Returns `{ success: true, bookings: BookingDocument[], total: number }`. Non-admins only access own bookings.
- `GET /api/bookings/[id]` — Auth: `Authorization: Bearer <id_token>`. Returns `{ success: true, booking: BookingDocument }`. Enforces user ownership.
- `POST /api/bookings/[id]/cancel` — Auth: `Authorization: Bearer <id_token>`. Body: `{ reason }`. Decrements attendee count atomically.

---

## 5. Push Notifications & Deep Linking

- Scheme: `nirvaha://events/[id]` and `nirvahaapp://events/[id]`.
- Destination Route: `/events/[id]`.
- Background, Foreground, and Cold-Start supported.
