/**
 * Booking validation helpers and sanitizers
 * File: lib/validations/bookings.ts
 */

import type { AttendeeDetail, BookingStatus } from '@/types/bookings';
import type { EventListing } from '@/types/events';

export interface CreateBookingInput {
  eventId: string;
  participantCount: number;
  userEmail: string;
  userName: string;
  userPhone?: string;
  attendeeDetails: AttendeeDetail[];
}

export interface CancelBookingInput {
  reason: string;
  bookingId?: string;
}

export interface BookingValidationEventContext {
  capacity?: number;
  isUnlimitedCapacity?: boolean;
  maxParticipantsPerBooking?: number;
  requiredAttendeeFields?: string[];
  registrationOpenDate?: string;
  registrationCloseDate?: string;
  registrationDeadline?: string;
  publicationStatus?: string;
  listingType?: string;
  attendeeCount?: number;
}

export interface ValidationResult<T> {
  isValid: boolean;
  errors: string[];
  sanitized?: T;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates and sanitizes booking creation input
 */
export function validateCreateBookingInput(
  data: unknown,
  eventContext?: BookingValidationEventContext | Partial<EventListing>
): ValidationResult<CreateBookingInput> {
  const errors: string[] = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
    };
  }

  const raw = data as Record<string, any>;

  // 1. Event ID
  const eventId = typeof raw.eventId === 'string' ? raw.eventId.trim() : '';
  if (!eventId) {
    errors.push('Event ID is required');
  }

  // 2. Participant Count
  const rawParticipantCount = raw.participantCount;
  let participantCount = 0;
  if (
    typeof rawParticipantCount !== 'number' ||
    isNaN(rawParticipantCount) ||
    !Number.isInteger(rawParticipantCount) ||
    rawParticipantCount < 1
  ) {
    errors.push('Participant count must be an integer of at least 1');
  } else {
    participantCount = rawParticipantCount;
  }

  // 3. User Email
  const userEmail = typeof raw.userEmail === 'string' ? raw.userEmail.trim().toLowerCase() : '';
  if (!userEmail || !EMAIL_REGEX.test(userEmail)) {
    errors.push('A valid user email address is required');
  }

  // 4. User Name
  const userName = typeof raw.userName === 'string' ? raw.userName.trim() : '';
  if (!userName || userName.length < 2) {
    errors.push('User name is required (minimum 2 characters)');
  }

  // 5. User Phone (optional)
  let userPhone: string | undefined = undefined;
  if (raw.userPhone !== undefined && raw.userPhone !== null && String(raw.userPhone).trim() !== '') {
    const cleanedPhone = String(raw.userPhone).trim();
    if (cleanedPhone.length < 7) {
      errors.push('User phone number is invalid (must be at least 7 digits)');
    } else {
      userPhone = cleanedPhone;
    }
  }

  // 6. Attendee Details Array
  const rawAttendees = raw.attendeeDetails;
  const sanitizedAttendees: AttendeeDetail[] = [];

  if (!Array.isArray(rawAttendees)) {
    errors.push('Attendee details must be an array');
  } else {
    if (participantCount > 0 && rawAttendees.length !== participantCount) {
      errors.push(
        `Attendee details array length (${rawAttendees.length}) must match participant count (${participantCount})`
      );
    }

    // Resolve required attendee fields from eventContext
    let requiredFields: string[] = [];
    if (eventContext) {
      if (Array.isArray((eventContext as any).requiredAttendeeFields)) {
        requiredFields = (eventContext as any).requiredAttendeeFields;
      } else if (
        (eventContext as any).bookingConfig &&
        Array.isArray((eventContext as any).bookingConfig.requiredAttendeeFields)
      ) {
        requiredFields = (eventContext as any).bookingConfig.requiredAttendeeFields;
      }
    }

    rawAttendees.forEach((attendee: any, index: number) => {
      const num = index + 1;
      if (!attendee || typeof attendee !== 'object') {
        errors.push(`Attendee #${num} must be a valid object`);
        return;
      }

      // Full name is always mandatory
      const fullName = typeof attendee.fullName === 'string' && attendee.fullName.trim().length >= 2
        ? attendee.fullName.trim()
        : (typeof attendee.name === 'string' && attendee.name.trim().length >= 2 ? attendee.name.trim() : '');

      if (!fullName) {
        errors.push(`Attendee #${num} full name is required`);
      }

      // Check required fields from event configuration
      let email: string | undefined = undefined;
      if (attendee.email !== undefined && attendee.email !== null) {
        const cleaned = String(attendee.email).trim().toLowerCase();
        if (cleaned && !EMAIL_REGEX.test(cleaned)) {
          errors.push(`Attendee #${num} has an invalid email format`);
        } else if (cleaned) {
          email = cleaned;
        }
      }
      if (requiredFields.includes('email') && !email) {
        errors.push(`Attendee #${num} email is required`);
      }

      let phone: string | undefined = undefined;
      if (attendee.phone !== undefined && attendee.phone !== null) {
        const cleaned = String(attendee.phone).trim();
        if (cleaned && cleaned.length < 7) {
          errors.push(`Attendee #${num} phone number must be at least 7 digits`);
        } else if (cleaned) {
          phone = cleaned;
        }
      }
      if (requiredFields.includes('phone') && !phone) {
        errors.push(`Attendee #${num} phone number is required`);
      }

      let dietary: string | undefined = undefined;
      if (typeof attendee.dietary === 'string' && attendee.dietary.trim()) {
        dietary = attendee.dietary.trim();
      }
      if (requiredFields.includes('dietary') && !dietary) {
        errors.push(`Attendee #${num} dietary preference is required`);
      }

      let emergencyContact: string | undefined = undefined;
      if (typeof attendee.emergencyContact === 'string' && attendee.emergencyContact.trim()) {
        emergencyContact = attendee.emergencyContact.trim();
      }
      if ((requiredFields.includes('emergency_contact') || requiredFields.includes('emergencyContact')) && !emergencyContact) {
        errors.push(`Attendee #${num} emergency contact is required`);
      }

      const notes = typeof attendee.notes === 'string' && attendee.notes.trim() ? attendee.notes.trim() : undefined;
      const customResponses = attendee.customResponses && typeof attendee.customResponses === 'object'
        ? attendee.customResponses
        : undefined;

      sanitizedAttendees.push({
        fullName,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(dietary ? { dietary } : {}),
        ...(emergencyContact ? { emergencyContact } : {}),
        ...(notes ? { notes } : {}),
        ...(customResponses ? { customResponses } : {}),
      });
    });
  }

  // 7. Event Contextual Checks
  if (eventContext) {
    const now = new Date().toISOString();
    const pubStatus = (eventContext as any).publicationStatus;
    const listingType = (eventContext as any).listingType;
    const bookingConfig = (eventContext as any).bookingConfig || eventContext;

    if (pubStatus && pubStatus !== 'published' && pubStatus !== 'featured') {
      errors.push(`Event is not open for bookings (status: ${pubStatus})`);
    }

    if (listingType && listingType !== 'free_booking' && listingType !== 'paid_booking') {
      errors.push('This listing does not support direct in-app booking');
    }

    const regOpen = bookingConfig.registrationOpenDate;
    const regClose = bookingConfig.registrationCloseDate;
    const deadline = (eventContext as any).schedule?.registrationDeadline || bookingConfig.registrationDeadline;

    if (regOpen && now < regOpen) {
      errors.push('Registration for this event has not opened yet');
    }
    if (regClose && now > regClose) {
      errors.push('Registration for this event has closed');
    }
    if (deadline && now > deadline) {
      errors.push('Registration deadline has passed');
    }

    const maxPerBooking = bookingConfig.maxParticipantsPerBooking || 1;
    if (participantCount > 0 && participantCount > maxPerBooking) {
      errors.push(`Requested participant count (${participantCount}) exceeds maximum allowed per booking (${maxPerBooking})`);
    }

    const isUnlimited = Boolean(bookingConfig.isUnlimitedCapacity);
    const capacity = typeof bookingConfig.capacity === 'number' ? bookingConfig.capacity : 0;
    const currentAttendees = typeof (eventContext as any).attendeeCount === 'number' ? (eventContext as any).attendeeCount : 0;

    if (!isUnlimited && capacity > 0 && participantCount > 0) {
      const remaining = Math.max(0, capacity - currentAttendees);
      if (currentAttendees + participantCount > capacity) {
        errors.push(`Requested participants exceed available capacity. Seats remaining: ${remaining}`);
      }
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    sanitized: {
      eventId,
      participantCount,
      userEmail,
      userName,
      ...(userPhone ? { userPhone } : {}),
      attendeeDetails: sanitizedAttendees,
    },
  };
}

/**
 * Validates and sanitizes booking cancellation input
 */
export function validateCancelBookingInput(data: unknown): ValidationResult<CancelBookingInput> {
  const errors: string[] = [];
  let reason = 'Cancelled by user';
  let bookingId: string | undefined = undefined;

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const raw = data as Record<string, any>;

    if (raw.reason !== undefined && raw.reason !== null) {
      if (typeof raw.reason !== 'string') {
        errors.push('Cancellation reason must be a string');
      } else if (raw.reason.length > 500) {
        errors.push('Cancellation reason cannot exceed 500 characters');
      } else if (raw.reason.trim().length > 0) {
        reason = raw.reason.trim();
      }
    }

    if (raw.bookingId !== undefined && raw.bookingId !== null) {
      if (typeof raw.bookingId !== 'string' || !raw.bookingId.trim()) {
        errors.push('Booking ID must be a non-empty string');
      } else {
        bookingId = raw.bookingId.trim();
      }
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    sanitized: {
      reason,
      ...(bookingId ? { bookingId } : {}),
    },
  };
}
