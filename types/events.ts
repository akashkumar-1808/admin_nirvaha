/**
 * NIRVAHA EVENTS & EXPERIENCES MANAGEMENT SYSTEM
 * TypeScript Data Models, Enums, DTOs & API Contracts
 *
 * Authoritative specification derived from NIRVAHA_EVENTS_BOOKING_CONTRACT.md
 * Target Location: admin_nirvaha/types/events.ts
 */

// ============================================================================
// 1. ENUMS & CONSTANTS
// ============================================================================

/**
 * Event Categories recognized across the Nirvaha platform.
 */
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

export const EVENT_CATEGORIES: readonly EventCategory[] = [
  'meditation',
  'yoga',
  'sound_healing',
  'breathwork',
  'philosophy',
  'retreat',
  'workshop',
  'temple_tour',
  'community',
] as const;

/**
 * Lifecycle publication states for an event listing.
 * - draft: Editable, visible only to administrators in Admin Console
 * - published: Live on mobile app, active for inquiries or bookings
 * - featured: Published + highlighted in mobile hero/carousel
 * - cancelled: Public notice of cancellation, booking locked
 * - archived: Retired listing, hidden from discovery
 */
export type EventPublicationStatus =
  | 'draft'
  | 'published'
  | 'featured'
  | 'cancelled'
  | 'archived';

/** Alias for contract backwards compatibility */
export type PublicationStatus = EventPublicationStatus;

export const EVENT_PUBLICATION_STATUSES: readonly EventPublicationStatus[] = [
  'draft',
  'published',
  'featured',
  'cancelled',
  'archived',
] as const;

/**
 * Functional listing behaviour of the event.
 * - advertisement: Informational card, no in-app registration
 * - external_registration: Redirects out to third-party registration/ticketing URL
 * - free_booking: In-app seat reservation with capacity tracking
 * - paid_booking: In-app paid reservation (blocked if payment provider unconfigured)
 */
export type EventListingType =
  | 'advertisement'
  | 'external_registration'
  | 'free_booking'
  | 'paid_booking';

/** Alias for contract backwards compatibility */
export type ListingType = EventListingType;

export const EVENT_LISTING_TYPES: readonly EventListingType[] = [
  'advertisement',
  'external_registration',
  'free_booking',
  'paid_booking',
] as const;

/**
 * Physical or virtual venue location type.
 */
export type EventLocationType = 'online' | 'offline' | 'hybrid';

/** Alias for contract backwards compatibility */
export type LocationType = EventLocationType;

export const EVENT_LOCATION_TYPES: readonly EventLocationType[] = [
  'online',
  'offline',
  'hybrid',
] as const;

/**
 * Supported payment providers.
 */
export type PaymentProvider = 'none' | 'razorpay' | 'stripe';

export const PAYMENT_PROVIDERS: readonly PaymentProvider[] = [
  'none',
  'razorpay',
  'stripe',
] as const;

/**
 * Payment gateway configuration / readiness states.
 * CRITICAL INVARIANT: 'paid_booking' events CANNOT be published unless status is 'active' or 'live'.
 */
export type PaymentProviderStatus =
  | 'unconfigured'
  | 'pending'
  | 'active'
  | 'test_mode'
  | 'live'
  | 'blocked';

export const PAYMENT_PROVIDER_STATUSES: readonly PaymentProviderStatus[] = [
  'unconfigured',
  'pending',
  'active',
  'test_mode',
  'live',
  'blocked',
] as const;

/**
 * Attendee profile fields that can be marked required during booking.
 */
export type AttendeeField =
  | 'fullName'
  | 'name'
  | 'email'
  | 'phone'
  | 'notes'
  | 'dietary'
  | 'emergency_contact';

export const REQUIRED_ATTENDEE_FIELDS: readonly AttendeeField[] = [
  'fullName',
  'name',
  'email',
  'phone',
  'notes',
  'dietary',
  'emergency_contact',
] as const;

// ============================================================================
// 2. SUB-CONFIGURATION INTERFACES
// ============================================================================

/**
 * Details of the host, teacher, or organizing entity.
 */
export interface OrganizerDetails {
  name: string;
  contact?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
}

/** Alias for contract compatibility */
export type OrganizerInfo = OrganizerDetails;

/**
 * Visual media assets for the event listing.
 */
export interface EventMedia {
  coverImageUrl: string;
  galleryImageUrls: string[];
}

/** Alias for contract compatibility */
export type MediaConfig = EventMedia;

/**
 * Timing, schedule, and timezone settings.
 */
export interface EventSchedule {
  startDate: string;            // ISO 8601 UTC string (e.g. "2026-11-20T06:00:00.000Z")
  endDate: string;              // ISO 8601 UTC string (e.g. "2026-11-20T07:30:00.000Z")
  timezone: string;             // IANA timezone identifier (e.g. "Asia/Kolkata")
  durationMinutes?: number;      // Calculated or explicit duration in minutes
  registrationDeadline?: string; // ISO 8601 UTC string; must be <= startDate
}

/** Alias for contract compatibility */
export type ScheduleConfig = EventSchedule;

/**
 * Geographic coordinates.
 */
export interface EventCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Physical venue or virtual meeting details.
 */
export interface EventLocation {
  type: EventLocationType;
  venueName?: string;          // Required for offline and hybrid
  address?: string;            // Required for offline and hybrid
  city?: string;               // Optional city name
  coordinates?: EventCoordinates;
  meetingUrl?: string;         // Required for online and hybrid
  accessInstructions?: string; // Landmark, room PIN, dress code, etc.
}

/** Alias for contract compatibility */
export type LocationConfig = EventLocation;

/**
 * Booking, reservation, capacity, and attendee requirements.
 */
export interface BookingConfig {
  capacity: number;                  // Maximum total participants allowed (0 = unlimited if isUnlimitedCapacity)
  isUnlimitedCapacity?: boolean;      // If true, capacity checks are bypassed
  maxParticipantsPerBooking: number; // Max seats allowed per reservation (default: 1, range: 1-10)
  registrationOpenDate: string;      // ISO 8601 UTC string
  registrationCloseDate: string;     // ISO 8601 UTC string
  requiredAttendeeFields: AttendeeField[]; // Fields collected during checkout
  cancellationPolicy?: string;       // Human-readable cancellation terms
  allowWaitlist?: boolean;           // Whether waitlisting is permitted when capacity is full
}

/**
 * Payment configuration and gateway readiness.
 */
export interface PaymentConfig {
  enabled: boolean;
  currency: string;                     // 3-letter currency code, e.g. "INR", "USD"
  amount: number;                       // Base unit amount (e.g. 500 for INR 500)
  provider?: PaymentProvider;            // Payment gateway provider
  providerStatus: PaymentProviderStatus; // Readiness status
}

// ============================================================================
// 3. CORE EVENT MODEL
// ============================================================================

/**
 * Canonical Event Listing document stored in Firestore collection `events`.
 */
export interface EventListing {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  category: EventCategory;
  tags: string[];
  organizer: OrganizerDetails;
  media: EventMedia;
  schedule: EventSchedule;
  location: EventLocation;
  listingType: EventListingType;
  externalUrl?: string;             // Destination link when listingType === 'external_registration'
  bookingConfig: BookingConfig;
  paymentConfig: PaymentConfig;
  publicationStatus: EventPublicationStatus;
  displayOrder: number;             // Ascending sort priority (0 is highest priority)
  notifyOnPublish: boolean;         // Admin toggle to broadcast FCM push upon publishing
  notificationSent?: boolean;       // Set to true once initial broadcast is dispatched
  notificationSentAt?: string;      // ISO 8601 UTC timestamp of broadcast dispatch
  publishedNotificationSentAt?: string; // Alias for notificationSentAt
  attendeeCount: number;            // Current total number of confirmed individual attendees
  confirmedBookingsCount: number;   // Current total number of confirmed booking reservations
  createdBy?: string;               // Admin UID or email of creator
  createdById?: string;             // UID of creator (alias)
  updatedBy?: string;               // Admin UID or email of last updater
  createdAt: string;                // ISO 8601 UTC timestamp
  updatedAt: string;                // ISO 8601 UTC timestamp
}

// ============================================================================
// 4. REQUEST PAYLOADS & DTOs
// ============================================================================

/**
 * Input payload for creating a new event listing (`POST /api/events`).
 */
export interface CreateEventInput {
  title: string;
  shortDescription: string;
  fullDescription: string;
  category: EventCategory;
  tags?: string[];
  organizer: OrganizerDetails;
  media: EventMedia;
  schedule: EventSchedule;
  location: EventLocation;
  listingType: EventListingType;
  externalUrl?: string;
  bookingConfig: BookingConfig;
  paymentConfig: PaymentConfig;
  publicationStatus?: EventPublicationStatus; // Defaults to 'draft'
  displayOrder?: number;                     // Defaults to 0
  notifyOnPublish?: boolean;                 // Defaults to false
}

/**
 * Input payload for updating an existing event listing (`PUT /api/events/[id]`).
 */
export type UpdateEventInput = Partial<CreateEventInput> & {
  id?: string;
};

/**
 * Supported lifecycle actions for `POST /api/events/[id]/publish`.
 */
export type PublishEventAction =
  | 'publish'
  | 'unpublish'
  | 'feature'
  | 'cancel'
  | 'archive';

/**
 * Input payload for publishing or transitioning event status (`POST /api/events/[id]/publish`).
 */
export interface PublishEventInput {
  action: PublishEventAction;
  notifyOnPublish?: boolean;
}

/**
 * Query filter parameters for listing events (`GET /api/events`).
 */
export type EventTimeframe = 'upcoming' | 'past' | 'all';

export type EventSortOption =
  | 'startDate_asc'
  | 'startDate_desc'
  | 'createdAt_desc'
  | 'createdAt_asc'
  | 'displayOrder_asc';

export interface EventListQuery {
  timeframe?: EventTimeframe;
  status?: EventPublicationStatus | 'all';
  category?: EventCategory | 'all';
  listingType?: EventListingType | 'all';
  search?: string;
  sort?: EventSortOption;
  page?: number;
  limit?: number;
}

// ============================================================================
// 5. API RESPONSE WRAPPERS & METRICS
// ============================================================================

/**
 * Pagination metadata included with list responses.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Standardized API response structure.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
  details?: unknown;
  pagination?: PaginationMeta;
}

/**
 * Standardized error response structure.
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
  availableCapacity?: number;
}

/**
 * Aggregated summary metrics for the Events Dashboard.
 */
export interface EventSummaryMetrics {
  totalEvents: number;
  publishedEvents: number;
  draftEvents: number;
  upcomingEvents: number;
  cancelledEvents: number;
  totalRegistrations: number;
  confirmedBookings: number;
}
