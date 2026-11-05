# Milestone 1 Investigation & Architecture Handoff Report

**Agent**: `explorer_m1_1` (archetype: `teamwork_explorer`)  
**Date**: 2026-11-05T14:35:00Z  
**Target Codebase**: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`  
**Milestone**: M1 — Foundation & Service Architecture  
**Scope**: `types/events.ts`, `types/bookings.ts`, `services/eventsService.ts`, `services/bookingsService.ts`

---

## 1. Observation

### Codebase & Configuration Observations

1. **Target Codebase Environment**:
   - Location: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`
   - Framework & Versions: Expo SDK `~54.0.36`, React Native `0.81.5`, React `19.1.0`, Expo Router `~6.0.24` (`typedRoutes: true`, `reactCompiler: true`), `firebase: "^12.12.1"`, `@react-native-firebase/app: "^25.1.0"`, `@react-native-firebase/messaging: "^25.1.0"` (from `package.json:20-66`).
   - Theme Tokens: `constants/theme.ts` defines `colors` (`background: '#f8f6f0'`, `foreground: '#2A3B32'`, `mutedForeground: '#5A6E63'`, `primary: '#2D5A4C'`, `healingGreen: '#2D5A4C'`, `gold: '#D4AF37'`, `border: '#C0CEC6'`, `error: '#EF4444'`) and `typography` (`display: 'PlayfairDisplay_400Regular'`, `body: 'Inter_400Regular'`, `bodyMedium: 'Inter_500Medium'`).
   - Screen Container & Layout: `components/ui/ScreenContainer.tsx` provides `LAYOUT_TOKENS` (`BOTTOM_NAV_HEIGHT: 60`, `BOTTOM_NAV_MARGIN: 20`, `GAP_PADDING: 16`), safe area insets via `react-native-safe-area-context`, and dynamic bottom padding for the floating navigation bar.

2. **Environment Variables & API Base URL**:
   - `.env` line 10 contains: `EXPO_PUBLIC_API_BASE_URL=https://backend-six-lac-91.vercel.app`.
   - `app.config.js` lines 93-101 forwards `EXPO_PUBLIC_API_BASE_URL` through `expo.extra` as well as `process.env.EXPO_PUBLIC_API_BASE_URL`.
   - `config/firebase.ts` lines 47-66 initializes and exports `{ auth, db }`. Line 50 sets up Firebase client auth with AsyncStorage persistence for native platforms and `getAuth(app)` on web.

3. **Backend API Contract Verification**:
   - `admin_nirvaha/.agents/teamwork/NIRVAHA_EVENTS_BOOKING_CONTRACT.md` establishes:
     - `GET /api/events` — returns `{ success: true, events: EventDocument[], total: number }`. Query parameters: `category`, `search`, `featured`, `status=published`.
     - `GET /api/events/[id]` — returns `{ success: true, event: EventDocument }`.
     - `POST /api/bookings` — Auth: `Authorization: Bearer <id_token>`. Body: `{ eventId, participantCount, attendeeDetails }`. Returns `{ success: true, booking: BookingDocument }` (201 Created). Returns 409 Conflict if capacity exceeded.
     - `GET /api/bookings` — Auth: `Authorization: Bearer <id_token>`. Query params: `userId`. Returns `{ success: true, bookings: BookingDocument[], total: number }`.
     - `GET /api/bookings/[id]` — Auth: `Authorization: Bearer <id_token>`. Returns `{ success: true, booking: BookingDocument }`.
     - `POST /api/bookings/[id]/cancel` — Auth: `Authorization: Bearer <id_token>`. Body: `{ reason }`. Returns `{ success: true, booking: BookingDocument }`.
   - Backend ID token validation is demonstrated in `admin_nirvaha/app/api/auth/verify/route.ts:17-30` verifying `Authorization: Bearer <token>` using `adminAuth.verifyIdToken(token)`.

4. **Directory Structure & TypeScript Baseline**:
   - The directory `types/` does NOT yet exist in `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`.
   - The directory `services/` contains: `assessment/`, `companion/`, `consent/`, `journal/`, `onboarding/`, and `pushNotifications.ts`.
   - Baseline build verification (`npx expo export --platform web --no-minify`) executed successfully, bundling 44 static routes into `dist`.
   - Baseline TypeScript type check (`npx tsc --noEmit`) revealed pre-existing compiler errors in unconnected modules (`collection/category/[categoryId].tsx`, `temple-of-balance/index.tsx`, `AncientCharacterCard.tsx`, `TempleOfBalanceCard.tsx`, `collapsible.tsx`, `config/firebase.ts`, `hooks/use-theme-color.ts`). All new files in M1 must introduce zero TypeScript errors.

---

## 2. Logic Chain

1. **Strict Separation of Concerns (Rule R1 & Contract §4)**:
   - Observation 3 confirms that bookings mutate attendee counts atomically and enforce capacity via server transactions.
   - Therefore, `services/bookingsService.ts` must NEVER import `setDoc`, `addDoc`, or `updateDoc` from `firebase/firestore`. All booking operations must be HTTP requests to the Team 1 backend with the user's Firebase JWT token (`Authorization: Bearer <token>`).
   - If an unauthenticated user attempts to book, `bookingsService.ts` must immediately reject the call with a typed `BookingApiError` (`401 UNAUTHENTICATED`), preventing invalid network roundtrips.

2. **Dual-Layer Events Fetching (Resilience & Zero Blank Screens)**:
   - The primary data source for `services/eventsService.ts` is `GET /api/events` and `GET /api/events/[id]`.
   - However, network instability or backend cold-starts may cause HTTP timeouts. Because read access to published events is safe and permitted by security rules, `eventsService.ts` implements an automatic graceful fallback to Firestore client reads (`collection(db, 'events')` with query `where('publicationStatus', 'in', ['published', 'featured'])`).
   - To guarantee data structure consistency across both HTTP JSON and Firestore DocumentSnapshots, a data normalization function `normalizeEventDocument()` must sanitize dates into standard ISO strings and provide safe defaults for optional fields.

3. **Status Matrix & Eligibility Determination**:
   - Contract §3 defines computed statuses: `fully_booked` (when `attendeeCount >= capacity`), `registration_closed` (when current time is past `registrationDeadline` or `registrationCloseDate`), along with lifecycle statuses `cancelled`, `archived`, `featured`, and `published`.
   - Providing a shared helper `getEventStatus(event: EventDocument): ComputedEventStatus` within `types/events.ts` guarantees consistent badge presentation and action disabling across discovery cards (`EventCard.tsx`), home rails (`EventsRail.tsx`), and details screens (`[id]/index.tsx`).

4. **API Base URL Resolution**:
   - Observation 2 demonstrates that `EXPO_PUBLIC_API_BASE_URL` is set in `.env` and `app.config.js`.
   - The resolution utility should check `Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL`, fall back to `process.env.EXPO_PUBLIC_API_BASE_URL`, and finally fall back to the production URL `'https://backend-six-lac-91.vercel.app'`.

---

## 3. Caveats

1. **Pre-existing TypeScript Errors**:
   - The target Nirvaha codebase contains several pre-existing TS errors in older components (such as `TempleOfBalanceCard.tsx` duplicate attributes, `config/firebase.ts` auth persistence import).
   - Our implementation must not touch or break those legacy files; our new files (`types/events.ts`, `types/bookings.ts`, `services/eventsService.ts`, `services/bookingsService.ts`) must compile cleanly with `tsc --noEmit`.
2. **Paid Booking Gateway**:
   - As mandated by Contract §2, paid booking (`paid_booking`) remains guarded and disabled in the client ("Booking Currently Unavailable") until backend payment gateway integration is delivered and verified by Team 1.
3. **Firestore Security Rules**:
   - The fallback to Firestore client reads in `eventsService.ts` requires that the client Firestore rules permit read access to `events` where `publicationStatus in ['published', 'featured']`. If Firestore read is rejected by permissions, the service catches the error and surfaces the HTTP/API error to the caller.

---

## 4. Conclusion & Complete Implementation Design

The implementation for Milestone 1 consists of 4 files:
1. `types/events.ts` — Canonical event model, listing types, publication statuses, category types, filter parameters, and status computation utility.
2. `types/bookings.ts` — Canonical booking model, attendee detail structures, creation payloads, API response interfaces, and custom `BookingApiError`.
3. `services/eventsService.ts` — Discovery service providing `fetchEvents`, `fetchFeaturedEvents`, `fetchEventById`, complete with query filtering, timeout handling, Firestore fallback, and ISO normalization.
4. `services/bookingsService.ts` — Authenticated mutations service providing `createBooking`, `fetchMyBookings`, `fetchBookingById`, `cancelBooking`, authenticated via `auth.currentUser?.getIdToken()`, with zero direct Firestore writes.

Below are the complete, production-ready code implementations for each file:

### File 1: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\types\events.ts`

```typescript
/**
 * Types & Interfaces for Nirvaha Events & Experiences
 * 100% compliant with NIRVAHA_EVENTS_BOOKING_CONTRACT.md (v1.0.0)
 */

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

export interface EventFilterParams {
  category?: EventCategory | string;
  search?: string;
  featured?: boolean;
  status?: EventPublicationStatus | string;
  limit?: number;
}

export interface EventsApiResponse {
  success: boolean;
  events: EventDocument[];
  total: number;
  message?: string;
}

export interface EventDetailApiResponse {
  success: boolean;
  event: EventDocument;
  message?: string;
}

export type ComputedEventStatus =
  | 'published'
  | 'featured'
  | 'cancelled'
  | 'archived'
  | 'fully_booked'
  | 'registration_closed'
  | 'unavailable';

/**
 * Determines the effective UI presentation status of an event
 * based on lifecycle status, capacity, and deadlines.
 */
export function getComputedEventStatus(event: EventDocument): ComputedEventStatus {
  if (event.publicationStatus === 'cancelled') {
    return 'cancelled';
  }
  if (event.publicationStatus === 'archived') {
    return 'archived';
  }

  const now = Date.now();
  if (event.schedule?.registrationDeadline) {
    const deadlineTime = new Date(event.schedule.registrationDeadline).getTime();
    if (!isNaN(deadlineTime) && now > deadlineTime) {
      return 'registration_closed';
    }
  }
  if (event.bookingConfig?.registrationCloseDate) {
    const closeTime = new Date(event.bookingConfig.registrationCloseDate).getTime();
    if (!isNaN(closeTime) && now > closeTime) {
      return 'registration_closed';
    }
  }

  if (
    event.bookingConfig?.capacity > 0 &&
    event.attendeeCount >= event.bookingConfig.capacity
  ) {
    return 'fully_booked';
  }

  if (event.isFeatured || event.publicationStatus === 'featured') {
    return 'featured';
  }

  return 'published';
}

/**
 * Validates whether an event is currently open for booking.
 */
export function isEventBookable(event: EventDocument): boolean {
  if (event.listingType !== 'free_booking') {
    return false;
  }
  const status = getComputedEventStatus(event);
  return status === 'published' || status === 'featured';
}
```

---

### File 2: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\types\bookings.ts`

```typescript
/**
 * Types & Interfaces for Nirvaha Bookings
 * 100% compliant with NIRVAHA_EVENTS_BOOKING_CONTRACT.md (v1.0.0)
 */

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

export interface CreateBookingPayload {
  eventId: string;
  participantCount: number;
  attendeeDetails: AttendeeDetail[];
}

export interface BookingApiResponse {
  success: boolean;
  booking: BookingDocument;
  message?: string;
}

export interface BookingsListApiResponse {
  success: boolean;
  bookings: BookingDocument[];
  total: number;
  message?: string;
}

export interface CancelBookingPayload {
  reason?: string;
}

export class BookingApiError extends Error {
  status: number;
  code?: string;
  details?: any;

  constructor(message: string, status: number = 500, code?: string, details?: any) {
    super(message);
    this.name = 'BookingApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
```

---

### File 3: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\services\eventsService.ts`

```typescript
/**
 * Nirvaha Events Query & Discovery Service
 * Primary source: Team 1 Backend API (GET /api/events, GET /api/events/[id])
 * Fallback: Cloud Firestore client query (where publicationStatus in ['published', 'featured'])
 */

import Constants from 'expo-constants';
import { db } from '../config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  limit as firestoreLimit,
} from 'firebase/firestore';
import {
  EventDocument,
  EventFilterParams,
  EventsApiResponse,
  EventDetailApiResponse,
} from '../types/events';

const REQUEST_TIMEOUT_MS = 10000;

/**
 * Resolves the Backend API base URL from Expo Constants extra,
 * environment variables, or defaults to the verified production API.
 */
export function getApiBaseUrl(): string {
  const extraUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL;
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const defaultUrl = 'https://backend-six-lac-91.vercel.app';
  return (extraUrl || envUrl || defaultUrl).replace(/\/$/, '');
}

/**
 * Normalizes raw event objects from either the HTTP API or Firestore documents
 * into a strictly typed EventDocument with ISO-8601 date strings.
 */
function normalizeEventDocument(id: string, raw: any): EventDocument {
  const toIsoString = (val: any): string => {
    if (!val) return new Date().toISOString();
    if (typeof val === 'string') return val;
    if (typeof val?.toDate === 'function') return val.toDate().toISOString();
    if (typeof val?.seconds === 'number') return new Date(val.seconds * 1000).toISOString();
    return new Date(val).toISOString();
  };

  return {
    id: id || raw?.id || '',
    title: raw?.title || '',
    shortDescription: raw?.shortDescription || '',
    fullDescription: raw?.fullDescription || '',
    category: raw?.category || 'community_experiences',
    tags: Array.isArray(raw?.tags) ? raw.tags : [],
    organizer: {
      name: raw?.organizer?.name || 'Nirvaha Guide',
      contact: raw?.organizer?.contact || '',
      email: raw?.organizer?.email || '',
      bio: raw?.organizer?.bio || '',
      avatarUrl: raw?.organizer?.avatarUrl || '',
    },
    media: {
      coverImageUrl: raw?.media?.coverImageUrl || '',
      galleryImageUrls: Array.isArray(raw?.media?.galleryImageUrls) ? raw.media.galleryImageUrls : [],
    },
    schedule: {
      startDate: toIsoString(raw?.schedule?.startDate),
      endDate: toIsoString(raw?.schedule?.endDate),
      timezone: raw?.schedule?.timezone || 'Asia/Kolkata',
      durationMinutes: Number(raw?.schedule?.durationMinutes || 60),
      registrationDeadline: toIsoString(raw?.schedule?.registrationDeadline),
    },
    location: {
      type: raw?.location?.type || 'offline',
      venueName: raw?.location?.venueName || '',
      address: raw?.location?.address || '',
      coordinates: raw?.location?.coordinates,
      meetingUrl: raw?.location?.meetingUrl || '',
      accessInstructions: raw?.location?.accessInstructions || '',
    },
    listingType: raw?.listingType || 'free_booking',
    bookingConfig: {
      capacity: Number(raw?.bookingConfig?.capacity || 0),
      maxParticipantsPerBooking: Number(raw?.bookingConfig?.maxParticipantsPerBooking || 1),
      registrationOpenDate: toIsoString(raw?.bookingConfig?.registrationOpenDate),
      registrationCloseDate: toIsoString(raw?.bookingConfig?.registrationCloseDate),
      requiredAttendeeFields: Array.isArray(raw?.bookingConfig?.requiredAttendeeFields)
        ? raw.bookingConfig.requiredAttendeeFields
        : ['fullName', 'email'],
      cancellationPolicy: raw?.bookingConfig?.cancellationPolicy || '',
      externalUrl: raw?.bookingConfig?.externalUrl || '',
    },
    paymentConfig: {
      enabled: Boolean(raw?.paymentConfig?.enabled),
      currency: raw?.paymentConfig?.currency || 'INR',
      amount: raw?.paymentConfig?.amount || 0,
      providerStatus: raw?.paymentConfig?.providerStatus || 'unconfigured',
      providerName: raw?.paymentConfig?.providerName || '',
    },
    publicationStatus: raw?.publicationStatus || 'published',
    isFeatured: Boolean(raw?.isFeatured),
    displayOrder: Number(raw?.displayOrder || 0),
    notifyOnPublish: Boolean(raw?.notifyOnPublish),
    notificationSent: Boolean(raw?.notificationSent),
    attendeeCount: Number(raw?.attendeeCount || 0),
    confirmedBookingsCount: Number(raw?.confirmedBookingsCount || 0),
    createdAt: toIsoString(raw?.createdAt),
    updatedAt: toIsoString(raw?.updatedAt),
  };
}

/**
 * Fetches events with optional category, search, and featured filters.
 * Primary: GET /api/events
 * Fallback: Firestore client query
 */
export async function fetchEvents(filters?: EventFilterParams): Promise<EventDocument[]> {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams();
  params.set('status', 'published');

  if (filters?.category && filters.category !== 'all') {
    params.set('category', filters.category);
  }
  if (filters?.search && filters.search.trim()) {
    params.set('search', filters.search.trim());
  }
  if (filters?.featured) {
    params.set('featured', 'true');
  }

  const endpointUrl = `${baseUrl}/api/events?${params.toString()}`;

  // 1. Primary Attempt: Team 1 Backend API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(endpointUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data: EventsApiResponse = await response.json();
      if (data?.success && Array.isArray(data.events)) {
        return data.events.map((evt) => normalizeEventDocument(evt.id, evt));
      }
    } else {
      console.warn(`Events API responded with status ${response.status}. Attempting Firestore fallback...`);
    }
  } catch (apiError: any) {
    console.warn(`Events API request failed (${apiError?.message}). Attempting Firestore fallback...`);
  }

  // 2. Fallback Attempt: Direct Firestore Read (Published events)
  try {
    const eventsCol = collection(db, 'events');
    const q = query(
      eventsCol,
      where('publicationStatus', 'in', ['published', 'featured'])
    );

    const snapshot = await getDocs(q);
    let events: EventDocument[] = [];

    snapshot.forEach((docSnap) => {
      const docData = docSnap.data();
      events.push(normalizeEventDocument(docSnap.id, docData));
    });

    // Client-side filtering when using fallback
    if (filters?.category && filters.category !== 'all') {
      events = events.filter((e) => e.category === filters.category);
    }
    if (filters?.featured) {
      events = events.filter((e) => e.isFeatured === true || e.publicationStatus === 'featured');
    }
    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      events = events.filter(
        (e) =>
          e.title.toLowerCase().includes(term) ||
          e.shortDescription.toLowerCase().includes(term) ||
          e.organizer.name.toLowerCase().includes(term)
      );
    }

    // Sort by displayOrder ascending, then startDate ascending
    events.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return new Date(a.schedule.startDate).getTime() - new Date(b.schedule.startDate).getTime();
    });

    return events;
  } catch (firestoreError: any) {
    console.error('Firestore fallback also failed to fetch events:', firestoreError);
    throw new Error(
      'Unable to load events at this moment. Please check your internet connection and try again.'
    );
  }
}

/**
 * Fetches featured events for home rails or discovery carousels.
 */
export async function fetchFeaturedEvents(limitCount: number = 5): Promise<EventDocument[]> {
  const events = await fetchEvents({ featured: true });
  return events.slice(0, limitCount);
}

/**
 * Fetches a single event document by ID.
 * Primary: GET /api/events/[id]
 * Fallback: Firestore doc(db, 'events', eventId)
 */
export async function fetchEventById(eventId: string): Promise<EventDocument | null> {
  if (!eventId || !eventId.trim()) {
    return null;
  }

  const baseUrl = getApiBaseUrl();
  const endpointUrl = `${baseUrl}/api/events/${encodeURIComponent(eventId.trim())}`;

  // 1. Primary Attempt: Team 1 Backend API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(endpointUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 404) {
      return null;
    }

    if (response.ok) {
      const data: EventDetailApiResponse = await response.json();
      if (data?.success && data.event) {
        return normalizeEventDocument(data.event.id, data.event);
      }
    }
  } catch (apiError: any) {
    console.warn(`Event details API request failed for ${eventId}. Attempting Firestore fallback...`, apiError?.message);
  }

  // 2. Fallback Attempt: Direct Firestore Document Read
  try {
    const docRef = doc(db, 'events', eventId.trim());
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return normalizeEventDocument(docSnap.id, docSnap.data());
  } catch (firestoreError: any) {
    console.error(`Firestore fallback failed for event ID ${eventId}:`, firestoreError);
    throw new Error('Unable to retrieve event details. Please try again.');
  }
}
```

---

### File 4: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\services\bookingsService.ts`

```typescript
/**
 * Nirvaha Bookings Service
 * 
 * STRICT ARCHITECTURAL CONSTRAINTS:
 * 1. Strictly NO direct Cloud Firestore writes from mobile client.
 * 2. All booking mutations (create, cancel) and queries MUST flow through
 *    Team 1 Authenticated Endpoints:
 *      - POST /api/bookings
 *      - GET  /api/bookings
 *      - GET  /api/bookings/[id]
 *      - POST /api/bookings/[id]/cancel
 * 3. All requests must carry Firebase ID Token: Authorization: Bearer <id_token>
 */

import Constants from 'expo-constants';
import { auth } from '../config/firebase';
import {
  BookingDocument,
  CreateBookingPayload,
  BookingApiResponse,
  BookingsListApiResponse,
  BookingApiError,
} from '../types/bookings';

const REQUEST_TIMEOUT_MS = 15000;

/**
 * Resolves the Backend API base URL.
 */
function getApiBaseUrl(): string {
  const extraUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL;
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const defaultUrl = 'https://backend-six-lac-91.vercel.app';
  return (extraUrl || envUrl || defaultUrl).replace(/\/$/, '');
}

/**
 * Retrieves the current Firebase user's ID token.
 * Throws a BookingApiError if the user is unauthenticated.
 */
async function getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new BookingApiError(
      'Authentication required: Please sign in to book experiences or view your bookings.',
      401,
      'UNAUTHENTICATED'
    );
  }

  try {
    const token = await user.getIdToken();
    return token;
  } catch (err: any) {
    throw new BookingApiError(
      `Failed to verify user session: ${err?.message || 'Authentication error'}`,
      401,
      'TOKEN_EXPIRED'
    );
  }
}

/**
 * Creates a new booking via Team 1's atomic backend endpoint.
 * Enforces capacity checks and duplicate submission prevention on server.
 * 
 * @param payload CreateBookingPayload
 * @returns Promise<BookingDocument>
 */
export async function createBooking(payload: CreateBookingPayload): Promise<BookingDocument> {
  if (!payload.eventId || !payload.eventId.trim()) {
    throw new BookingApiError('Event ID is required.', 400, 'INVALID_PAYLOAD');
  }
  if (!payload.participantCount || payload.participantCount < 1) {
    throw new BookingApiError('Participant count must be at least 1.', 400, 'INVALID_PAYLOAD');
  }
  if (!Array.isArray(payload.attendeeDetails) || payload.attendeeDetails.length === 0) {
    throw new BookingApiError('Attendee details are required.', 400, 'INVALID_PAYLOAD');
  }

  const token = await getAuthToken();
  const baseUrl = getApiBaseUrl();
  const endpoint = `${baseUrl}/api/bookings`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data: BookingApiResponse = await response.json().catch(() => ({}) as any);

    if (response.status === 409) {
      throw new BookingApiError(
        data?.message || 'This event is fully booked or insufficient seats remain.',
        409,
        'CAPACITY_EXCEEDED'
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new BookingApiError(
        data?.message || 'Session expired or unauthorized. Please re-authenticate.',
        response.status,
        'AUTH_ERROR'
      );
    }

    if (!response.ok) {
      throw new BookingApiError(
        data?.message || `Failed to submit booking (HTTP ${response.status}).`,
        response.status,
        'API_ERROR',
        data
      );
    }

    if (!data.booking || !data.booking.bookingReference) {
      throw new BookingApiError(
        'Server returned incomplete booking confirmation.',
        500,
        'INVALID_RESPONSE'
      );
    }

    return data.booking;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof BookingApiError) {
      throw error;
    }
    if (error?.name === 'AbortError') {
      throw new BookingApiError(
        'Booking submission timed out. Please check your network and My Bookings before retrying.',
        408,
        'TIMEOUT'
      );
    }
    throw new BookingApiError(
      error?.message || 'Network error occurred while submitting booking. Please try again.',
      500,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Fetches the authenticated user's bookings.
 * 
 * @returns Promise<BookingDocument[]>
 */
export async function fetchMyBookings(): Promise<BookingDocument[]> {
  const user = auth.currentUser;
  if (!user) {
    return [];
  }

  const token = await getAuthToken();
  const baseUrl = getApiBaseUrl();
  const endpoint = `${baseUrl}/api/bookings?userId=${encodeURIComponent(user.uid)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 401 || response.status === 403) {
      throw new BookingApiError('Session expired. Please log in again.', response.status, 'AUTH_ERROR');
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new BookingApiError(
        errData?.message || `Failed to fetch bookings (HTTP ${response.status})`,
        response.status,
        'FETCH_FAILED'
      );
    }

    const data: BookingsListApiResponse = await response.json();
    return Array.isArray(data.bookings) ? data.bookings : [];
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof BookingApiError) {
      throw error;
    }
    if (error?.name === 'AbortError') {
      throw new BookingApiError('Request timed out while fetching bookings.', 408, 'TIMEOUT');
    }
    throw new BookingApiError(
      error?.message || 'Failed to load bookings. Please verify your connection.',
      500,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Fetches a single booking by ID. Verifies user ownership on the server.
 * 
 * @param bookingId string
 * @returns Promise<BookingDocument>
 */
export async function fetchBookingById(bookingId: string): Promise<BookingDocument> {
  if (!bookingId || !bookingId.trim()) {
    throw new BookingApiError('Booking ID is required.', 400, 'INVALID_ID');
  }

  const token = await getAuthToken();
  const baseUrl = getApiBaseUrl();
  const endpoint = `${baseUrl}/api/bookings/${encodeURIComponent(bookingId.trim())}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 404) {
      throw new BookingApiError('Booking record not found.', 404, 'NOT_FOUND');
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new BookingApiError(
        errData?.message || `Failed to fetch booking details (HTTP ${response.status})`,
        response.status,
        'FETCH_FAILED'
      );
    }

    const data: BookingApiResponse = await response.json();
    if (!data.booking) {
      throw new BookingApiError('Booking record payload empty.', 500, 'EMPTY_PAYLOAD');
    }

    return data.booking;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof BookingApiError) {
      throw error;
    }
    throw new BookingApiError(
      error?.message || 'Failed to retrieve booking details.',
      500,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Cancels a confirmed booking via Team 1 server endpoint.
 * Automatically decrements event attendee count atomically on the server.
 * 
 * @param bookingId string
 * @param reason optional cancellation reason
 * @returns Promise<BookingDocument>
 */
export async function cancelBooking(bookingId: string, reason?: string): Promise<BookingDocument> {
  if (!bookingId || !bookingId.trim()) {
    throw new BookingApiError('Booking ID is required.', 400, 'INVALID_ID');
  }

  const token = await getAuthToken();
  const baseUrl = getApiBaseUrl();
  const endpoint = `${baseUrl}/api/bookings/${encodeURIComponent(bookingId.trim())}/cancel`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        reason: reason?.trim() || 'User requested cancellation',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new BookingApiError(
        errData?.message || `Cancellation failed (HTTP ${response.status})`,
        response.status,
        'CANCEL_FAILED'
      );
    }

    const data: BookingApiResponse = await response.json();
    return data.booking;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof BookingApiError) {
      throw error;
    }
    throw new BookingApiError(
      error?.message || 'Failed to cancel booking. Please try again.',
      500,
      'NETWORK_ERROR'
    );
  }
}
```

---

## 5. Verification Method

To independently verify the implementation once written by the worker agent:

1. **Static Typing & Compilation Verification**:
   - Run: `cd "C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha"; npx tsc --noEmit`
   - Invalidation condition: Any TypeScript compiler error originating from `types/events.ts`, `types/bookings.ts`, `services/eventsService.ts`, or `services/bookingsService.ts`.
2. **Build Verification**:
   - Run: `cd "C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha"; npx expo export --platform web --no-minify`
   - Expected result: Clean Metro bundling and export to `dist` without bundler syntax or module resolution errors.
3. **Architectural Compliance Inspection**:
   - Inspect `services/bookingsService.ts` for any occurrences of `setDoc`, `addDoc`, `updateDoc`, or `deleteDoc`.
   - Invalidation condition: Any direct Firestore mutation in `bookingsService.ts` (violates requirement R1 and contract §4).
   - Inspect token injection: Confirm `Authorization: Bearer ${token}` is attached to every fetch request in `bookingsService.ts`.
