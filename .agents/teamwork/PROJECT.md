# Project: Nirvaha Mobile Events, Experiences & Bookings

## Architecture
- **Target Repository**: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`
- **Backend API & Admin**: `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha`
- **Framework**: Expo SDK 54 (`~54.0.36`), React Native `0.81.5`, React `19.1.0`, Expo Router `~6.0.24` (`typedRoutes: true`)
- **Theme & UI**: `constants/theme.ts` (`primary: '#2D5A4C'`, `gold: '#D4AF37'`, `background: '#f8f6f0'`, `foreground: '#2A3B32'`), `ScreenContainer.tsx` safe area system with floating `BottomNav.tsx` dynamic padding.
- **Data Flow**:
  - Event Discovery: `services/eventsService.ts` queries Team 1 backend `GET /api/events` (with fallback to client Firestore if allowed).
  - Booking Mutations: `services/bookingsService.ts` executes authenticated HTTP requests (`POST /api/bookings`, `POST /api/bookings/[id]/cancel`) with Firebase ID Token (`Authorization: Bearer <token>`). NEVER writes directly to Firestore.
  - Concurrency & Capacity: Managed atomically on Team 1 server via Firestore `runTransaction`.
  - Deep Linking: Push notifications carry `data.deepLink` (`nirvaha://events/[id]` / `nirvahaapp://events/[id]`), routed to `/events/[id]` via `services/pushNotifications.ts`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | `EventDocument` & `BookingDocument` Models | Canonical TypeScript interface definitions matching backend contract | M1 | `NIRVAHA_EVENTS_BOOKING_CONTRACT.md` / `types/events.ts`, `types/bookings.ts` |
| 2 | Authenticated Bookings API Client | HTTP service for booking creation, retrieval, and cancellation with Firebase Bearer token | M1 | `services/bookingsService.ts` |
| 3 | Events Discovery & Query Service | HTTP/Firestore service for listing published events, category filtering, search, and details | M1 | `services/eventsService.ts` |
| 4 | Event Discovery Screen | Full screen with category chips, search bar, pull-to-refresh, empty & error states | M2 | `app/events/index.tsx` |
| 5 | Event Card Component | Reusable card displaying cover image, category, title, date/time, venue/online, price, and featured badge | M2 | `components/events/EventCard.tsx` |
| 6 | Home Screen Events Rail | Featured & upcoming horizontal rail embedded in home tab without disrupting existing layout | M2 | `components/home/EventsRail.tsx`, `app/(tabs)/index.tsx` |
| 7 | Event Details Screen | Detailed view displaying full description, organizer, schedule, venue/online details, pricing, availability | M3 | `app/events/[id]/index.tsx` |
| 8 | Dynamic Listing Action: Advertisement | Informational listing with no booking action, optional configured CTA opening destination URL | M3 | `app/events/[id]/index.tsx` |
| 9 | Dynamic Listing Action: External Registration | Displays Register CTA opening external URL via Linking without local booking creation | M3 | `app/events/[id]/index.tsx` |
| 10 | Dynamic Listing Action: Free Booking | Displays Book Free / Register CTA navigating to in-app registration form | M3 | `app/events/[id]/index.tsx` |
| 11 | Dynamic Listing Action: Paid Booking Safeguard | Displays pricing; Book Now remains disabled/unavailable until payment provider is confirmed; no fake payments | M3 | `app/events/[id]/index.tsx` |
| 12 | Event Ineligible Status Handling | Handles Cancelled, Fully booked, Registration closed, Archived, Unavailable with explicit badges and disabled actions | M3 | `app/events/[id]/index.tsx`, `components/events/StatusBadge.tsx` |
| 13 | Registration Form Screen | Form validating fullName, email, phone, notes, handling loading state and submission errors | M4 | `app/events/[id]/register.tsx` |
| 14 | In-Flight Duplicate Prevention | Form disables submission and controls while request is in flight | M4 | `app/events/[id]/register.tsx` |
| 15 | Booking Confirmation Screen | Displays success state with server-generated reference (`NIR-EVT-...`), event info, joining notes, navigation back | M4 | `app/events/[id]/confirmation.tsx` |
| 16 | My Bookings Screen | List of user's own bookings showing status, booking reference, date, payment status, joining instructions | M5 | `app/events/my-bookings.tsx` |
| 17 | Profile Account Menu Integration | Entry point for My Bookings added cleanly to profile settings menu | M5 | `components/profile/SettingsSection.tsx`, `app/profile.tsx` |
| 18 | Deep Linking & Push Notifications | Route `nirvaha://events/[id]` to `/events/[id]` supporting cold start, background resume, and foreground tap | M5 | `services/pushNotifications.ts` |
| 19 | Visual Design & Theme Adherence | Deep forest green `#2D5A4C`, warm ivory `#f8f6f0`, restrained gold `#D4AF37`, Playfair & Inter fonts, safe area insets | M1-M6 | `constants/theme.ts`, `ScreenContainer.tsx` |
| 20 | Robust State Handling Across All Screens | Loading spinners, empty listing states, no search results, network retry button, user-friendly error banners | M1-M6 | All event screens and components |
| 21 | Build & Type Integrity Verification | Clean build export (`npx expo export --platform web` & `android`), zero new TS errors on new modules | M6 | Tooling & verification scripts |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Mobile Foundation & Backend Integration | `types/events.ts`, `types/bookings.ts`, `types/api.ts`, `services/apiClient.ts`, `services/eventsService.ts`, `services/bookingsService.ts`, `NIRVAHA_EVENTS_BOOKING_CONTRACT.md`, `scratch/verify_m1_foundation.ts` | none | DONE |
| M2 | Events Discovery & Home Screen Integration | `components/events/EventCard.tsx`, `components/events/CategoryChips.tsx`, `components/events/StatusBadge.tsx`, `app/events/index.tsx`, `components/home/EventsRail.tsx`, `app/(tabs)/index.tsx` | M1 | PLANNED |
| M3 | Event Details & Dynamic Listing Behaviour | `app/events/[id]/index.tsx` (all 4 listing types, dynamic action, status guards) | M1, M2 | PLANNED |
| M4 | Registration Flow & Booking Confirmation | `app/events/[id]/register.tsx`, `app/events/[id]/confirmation.tsx` | M1, M3 | PLANNED |
| M5 | My Bookings, Profile & Deep Linking Integration | `app/events/my-bookings.tsx`, `components/profile/SettingsSection.tsx`, `services/pushNotifications.ts` | M1, M3, M4 | PLANNED |
| M6 | Comprehensive Verification, Build Export & Hardening | Full build export check (`npx expo export`), TS check, ESLint check, adversarial review, forensic integrity audit | M1, M2, M3, M4, M5 | PLANNED |

## Interface Contracts

### 1. `types/events.ts`
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
  startDate: string;
  endDate: string;
  timezone: string;
  durationMinutes: number;
  registrationDeadline: string;
}

export interface EventLocation {
  type: LocationType;
  venueName?: string;
  address?: string;
  coordinates?: { latitude: number; longitude: number };
  meetingUrl?: string;
  accessInstructions?: string;
}

export interface EventBookingConfig {
  capacity: number;
  maxParticipantsPerBooking: number;
  registrationOpenDate: string;
  registrationCloseDate: string;
  requiredAttendeeFields: Array<'fullName' | 'email' | 'phone' | 'notes'>;
  cancellationPolicy?: string;
  externalUrl?: string;
}

export interface EventPaymentConfig {
  enabled: boolean;
  currency?: string;
  amount?: number;
  providerStatus: 'unconfigured' | 'pending' | 'active';
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
```

### 2. `types/bookings.ts`
```typescript
import { LocationType } from './events';

export type BookingStatus = 'confirmed' | 'cancelled' | 'waitlist' | 'attended';
export type PaymentStatus = 'none' | 'pending' | 'paid' | 'refunded';

export interface AttendeeDetail {
  fullName: string;
  email: string;
  phone?: string;
  notes?: string;
}

export interface BookingDocument {
  id: string;
  bookingReference: string;
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

export interface CreateBookingPayload {
  eventId: string;
  participantCount: number;
  attendeeDetails: AttendeeDetail[];
}
```

### 3. `services/eventsService.ts`
- `fetchEvents(filters?: { category?: string; search?: string; featured?: boolean }): Promise<EventDocument[]>`
- `fetchFeaturedEvents(limitCount?: number): Promise<EventDocument[]>`
- `fetchEventById(eventId: string): Promise<EventDocument | null>`

### 4. `services/bookingsService.ts`
- `createBooking(payload: CreateBookingPayload): Promise<BookingDocument>` -> calls `POST /api/bookings` with Bearer token
- `fetchMyBookings(): Promise<BookingDocument[]>` -> calls `GET /api/bookings` with Bearer token
- `fetchBookingById(bookingId: string): Promise<BookingDocument>` -> calls `GET /api/bookings/[id]` with Bearer token
- `cancelBooking(bookingId: string, reason?: string): Promise<BookingDocument>` -> calls `POST /api/bookings/[id]/cancel` with Bearer token

## Code Layout
```
C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\
├── types/
│   ├── events.ts              (M1 - Worker exclusive)
│   └── bookings.ts            (M1 - Worker exclusive)
├── services/
│   ├── eventsService.ts       (M1 - Worker exclusive)
│   ├── bookingsService.ts     (M1 - Worker exclusive)
│   └── pushNotifications.ts   (M5 - Worker exclusive)
├── components/
│   ├── events/
│   │   ├── EventCard.tsx      (M2 - Worker exclusive)
│   │   ├── CategoryChips.tsx  (M2 - Worker exclusive)
│   │   └── StatusBadge.tsx    (M2 - Worker exclusive)
│   ├── home/
│   │   └── EventsRail.tsx     (M2 - Worker exclusive)
│   └── profile/
│       └── SettingsSection.tsx(M5 - Worker exclusive)
└── app/
    ├── (tabs)/
    │   └── index.tsx          (M2 - Worker exclusive)
    └── events/
        ├── index.tsx          (M2 - Worker exclusive)
        ├── my-bookings.tsx    (M5 - Worker exclusive)
        └── [id]/
            ├── index.tsx      (M3 - Worker exclusive)
            ├── register.tsx   (M4 - Worker exclusive)
            └── confirmation.tsx (M4 - Worker exclusive)
```
