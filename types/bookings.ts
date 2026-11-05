/**
 * NIRVAHA EVENTS & EXPERIENCES MANAGEMENT SYSTEM
 * Booking Models, Attendee Details, DTOs & Queries
 *
 * Authoritative specification derived from NIRVAHA_EVENTS_BOOKING_CONTRACT.md
 * Target Location: admin_nirvaha/types/bookings.ts
 */

import type { EventCategory, EventLocationType } from './events';

// ============================================================================
// 1. ENUMS & CONSTANTS
// ============================================================================

/**
 * Status of an individual event booking reservation.
 * - confirmed: Reservation confirmed and seats allocated
 * - cancelled: Reservation cancelled and seats released back to event capacity pool
 * - waitlist: Queued waiting for seat availability
 * - attended: Marked as attended by event organizers/administrators
 */
export type BookingStatus =
  | 'confirmed'
  | 'cancelled'
  | 'waitlist'
  | 'attended';

export const BOOKING_STATUSES: readonly BookingStatus[] = [
  'confirmed',
  'cancelled',
  'waitlist',
  'attended',
] as const;

// ============================================================================
// 2. ATTENDEE STRUCTURES
// ============================================================================

/**
 * Individual attendee information collected during reservation.
 */
export interface AttendeeDetail {
  fullName: string;
  email?: string;
  phone?: string;
  notes?: string;
  dietary?: string;
  emergencyContact?: string;
  customResponses?: Record<string, string>;
}

// ============================================================================
// 3. CORE BOOKING MODEL
// ============================================================================

/**
 * Canonical Event Booking document stored in Firestore collection `bookings`.
 */
export interface EventBooking {
  id: string;
  bookingReference: string;       // Unique human-readable code e.g. "NIR-EVT-7K2X9P"
  eventId: string;
  eventTitle: string;             // Denormalized for rapid mobile and console display
  eventCategory?: EventCategory;  // Denormalized event category
  eventDate: string;              // ISO 8601 UTC date string or event start date
  eventStartDate?: string;        // ISO 8601 UTC start datetime
  eventEndDate?: string;          // ISO 8601 UTC end datetime
  eventLocationType?: EventLocationType; // Physical or online
  eventVenueOrUrl?: string;       // Physical venue address or online meeting link
  userId: string;                 // Firebase Auth UID of the reserving user
  userEmail: string;              // Email address of the reserving user
  userName: string;               // Display name or primary attendee name
  userPhone?: string;             // Contact phone number
  participantCount: number;       // Number of seats/tickets reserved (>= 1)
  attendeeDetails: AttendeeDetail[]; // Array of attendee information records
  status: BookingStatus;          // Current reservation status
  bookedAt: string;               // ISO 8601 UTC timestamp of initial reservation
  cancelledAt?: string;           // ISO 8601 UTC timestamp of cancellation (if cancelled)
  cancellationReason?: string;    // Free-form cancellation rationale
  cancelledBy?: 'user' | 'admin'; // Actor who performed cancellation
  updatedAt?: string;             // ISO 8601 UTC timestamp of last modification
  metadata?: Record<string, unknown>; // Extensible metadata (e.g. payment ref, check-in data)
}

// ============================================================================
// 4. REQUEST PAYLOADS & DTOs
// ============================================================================

/**
 * Input payload for creating a new booking reservation (`POST /api/bookings`).
 */
export interface CreateBookingInput {
  eventId: string;
  participantCount: number;
  attendeeDetails: AttendeeDetail[];
  userId?: string;                // Injected on server from verified Firebase ID token
  userEmail?: string;             // Optional client override or prefilled from auth token
  userName?: string;              // Optional client override or prefilled from auth token
  userPhone?: string;             // Contact phone number
  metadata?: Record<string, unknown>;
}

/**
 * Input payload for cancelling an existing booking (`POST /api/bookings/[id]/cancel`).
 */
export interface CancelBookingInput {
  reason?: string;
  cancelledBy?: 'user' | 'admin';
}

/**
 * Query filter parameters for listing bookings (`GET /api/bookings`).
 */
export type BookingSortOption =
  | 'bookedAt_desc'
  | 'bookedAt_asc'
  | 'participantCount_desc'
  | 'participantCount_asc';

export interface BookingListQuery {
  eventId?: string;
  userId?: string;                // Filter by specific user (enforced for non-admins)
  status?: BookingStatus | 'all'; // Filter by reservation status
  search?: string;                // Case-insensitive search on reference, user name, or email
  sort?: BookingSortOption;       // Sorting option
  page?: number;                  // Pagination page index (1-based)
  limit?: number;                 // Page limit (default 20, max 100)
}

// ============================================================================
// 5. SUMMARY METRICS & EXPORT STRUCTURES
// ============================================================================

/**
 * Aggregated summary metrics for the Bookings Console.
 */
export interface BookingSummaryMetrics {
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  totalSeatsReserved: number;
  attendedBookings: number;
}

/**
 * Flattened booking record structure tailored for CSV export.
 */
export interface BookingCsvRow {
  bookingReference: string;
  eventTitle: string;
  eventDate: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  participantCount: number;
  status: string;
  bookedAt: string;
  cancelledAt: string;
  cancellationReason: string;
}
