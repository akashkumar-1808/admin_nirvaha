/**
 * Event validation helpers and sanitizers
 * File: lib/validations/events.ts
 */

import type {
  EventListing,
  EventCategory,
  ListingType,
  LocationType,
  PublicationStatus,
  PaymentProviderStatus,
  OrganizerInfo,
  MediaConfig,
  ScheduleConfig,
  LocationConfig,
  BookingConfig,
  PaymentConfig,
} from '@/types/events';

export interface CreateEventInput {
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
  externalUrl?: string;
  bookingConfig: BookingConfig;
  paymentConfig: PaymentConfig;
  displayOrder: number;
  notifyOnPublish: boolean;
}

export type UpdateEventInput = Partial<CreateEventInput> & {
  publicationStatus?: PublicationStatus;
};

export interface PublishEventInput {
  action: 'publish' | 'unpublish' | 'feature' | 'cancel' | 'archive';
  notifyOnPublish?: boolean;
}

export interface ValidationResult<T> {
  isValid: boolean;
  errors: string[];
  sanitized?: T;
}

const VALID_EVENT_CATEGORIES: EventCategory[] = [
  'meditation',
  'yoga',
  'sound_healing',
  'breathwork',
  'philosophy',
  'retreat',
  'workshop',
  'temple_tour',
  'community',
];

const VALID_LISTING_TYPES: ListingType[] = [
  'advertisement',
  'external_registration',
  'free_booking',
  'paid_booking',
];

const VALID_LOCATION_TYPES: LocationType[] = ['online', 'offline', 'hybrid'];

const VALID_PUBLICATION_STATUSES: PublicationStatus[] = [
  'draft',
  'published',
  'featured',
  'cancelled',
  'archived',
];

const VALID_PUBLISH_ACTIONS = ['publish', 'unpublish', 'feature', 'cancel', 'archive'] as const;

function isValidIsoDate(str: unknown): str is string {
  if (typeof str !== 'string' || !str.trim()) return false;
  const timestamp = Date.parse(str);
  return !isNaN(timestamp);
}

function isValidHttpUrl(str: unknown): boolean {
  if (typeof str !== 'string' || !str.trim()) return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates and sanitizes payload for creating a new event listing
 */
export function validateCreateEventInput(data: unknown): ValidationResult<CreateEventInput> {
  const errors: string[] = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
    };
  }

  const raw = data as Record<string, any>;

  // 1. Title validation
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title || title.length < 3) {
    errors.push('Title is required and must be at least 3 characters');
  } else if (title.length > 120) {
    errors.push('Title cannot exceed 120 characters');
  }

  // 2. Short Description validation
  const shortDescription = typeof raw.shortDescription === 'string' ? raw.shortDescription.trim() : '';
  if (!shortDescription || shortDescription.length < 10) {
    errors.push('Short description is required and must be between 10 and 250 characters');
  } else if (shortDescription.length > 250) {
    errors.push('Short description cannot exceed 250 characters');
  }

  // 3. Full Description (optional, fallback to shortDescription)
  const fullDescription = typeof raw.fullDescription === 'string' && raw.fullDescription.trim().length > 0
    ? raw.fullDescription.trim()
    : shortDescription;

  // 4. Category validation
  const category = raw.category as EventCategory;
  if (!category || !VALID_EVENT_CATEGORIES.includes(category)) {
    errors.push(`Category must be one of: ${VALID_EVENT_CATEGORIES.join(', ')}`);
  }

  // 5. Listing Type validation
  const listingType = raw.listingType as ListingType;
  if (!listingType || !VALID_LISTING_TYPES.includes(listingType)) {
    errors.push(`Listing type must be one of: ${VALID_LISTING_TYPES.join(', ')}`);
  }

  // 6. External URL validation for external_registration
  let externalUrl: string | undefined = undefined;
  if (listingType === 'external_registration') {
    const rawExternalUrl = typeof raw.externalUrl === 'string' ? raw.externalUrl.trim() : '';
    if (!rawExternalUrl || !isValidHttpUrl(rawExternalUrl)) {
      errors.push('A valid external registration URL is required when listingType is external_registration');
    } else {
      externalUrl = rawExternalUrl;
    }
  } else if (typeof raw.externalUrl === 'string' && raw.externalUrl.trim()) {
    if (isValidHttpUrl(raw.externalUrl.trim())) {
      externalUrl = raw.externalUrl.trim();
    }
  }

  // 7. Schedule validation
  const rawSchedule = raw.schedule;
  if (!rawSchedule || typeof rawSchedule !== 'object') {
    errors.push('Schedule configuration is required');
  }

  const startDate = rawSchedule?.startDate;
  const endDate = rawSchedule?.endDate;
  const registrationDeadline = rawSchedule?.registrationDeadline;
  const timezone = typeof rawSchedule?.timezone === 'string' && rawSchedule.timezone.trim()
    ? rawSchedule.timezone.trim()
    : 'Asia/Kolkata';

  let validStartDate = false;
  let validEndDate = false;

  if (!isValidIsoDate(startDate)) {
    errors.push('Schedule start date is required and must be a valid ISO 8601 date string');
  } else {
    validStartDate = true;
  }

  if (!isValidIsoDate(endDate)) {
    errors.push('Schedule end date is required and must be a valid ISO 8601 date string');
  } else {
    validEndDate = true;
  }

  if (validStartDate && validEndDate) {
    if (new Date(endDate).getTime() < new Date(startDate).getTime()) {
      errors.push('Event end date must be on or after start date');
    }
  }

  if (registrationDeadline !== undefined && registrationDeadline !== null && registrationDeadline !== '') {
    if (!isValidIsoDate(registrationDeadline)) {
      errors.push('Registration deadline must be a valid ISO 8601 date string');
    } else if (validStartDate && new Date(registrationDeadline).getTime() > new Date(startDate).getTime()) {
      errors.push('Registration deadline must be before or equal to event start date');
    }
  }

  let durationMinutes = typeof rawSchedule?.durationMinutes === 'number' && rawSchedule.durationMinutes > 0
    ? Math.round(rawSchedule.durationMinutes)
    : 0;

  if (durationMinutes === 0 && validStartDate && validEndDate) {
    durationMinutes = Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 60000));
  }

  const sanitizedSchedule: ScheduleConfig = {
    startDate: validStartDate ? new Date(startDate).toISOString() : '',
    endDate: validEndDate ? new Date(endDate).toISOString() : '',
    timezone,
    durationMinutes,
    registrationDeadline: isValidIsoDate(registrationDeadline)
      ? new Date(registrationDeadline).toISOString()
      : (validStartDate ? new Date(startDate).toISOString() : ''),
  };

  // 8. Location validation
  const rawLocation = raw.location;
  if (!rawLocation || typeof rawLocation !== 'object') {
    errors.push('Location configuration is required');
  }

  const locationType = rawLocation?.type as LocationType;
  if (!locationType || !VALID_LOCATION_TYPES.includes(locationType)) {
    errors.push(`Location type must be one of: ${VALID_LOCATION_TYPES.join(', ')}`);
  }

  const venueName = typeof rawLocation?.venueName === 'string' ? rawLocation.venueName.trim() : '';
  const address = typeof rawLocation?.address === 'string' ? rawLocation.address.trim() : '';
  const meetingUrl = typeof rawLocation?.meetingUrl === 'string' ? rawLocation.meetingUrl.trim() : '';
  const accessInstructions = typeof rawLocation?.accessInstructions === 'string' ? rawLocation.accessInstructions.trim() : '';

  if (locationType === 'offline' || locationType === 'hybrid') {
    if (!venueName && !address) {
      errors.push('Venue name or address is required for offline or hybrid events');
    }
  }

  if (locationType === 'online' || locationType === 'hybrid') {
    if (meetingUrl && !isValidHttpUrl(meetingUrl)) {
      errors.push('Meeting URL must be a valid HTTP or HTTPS URL');
    } else if (locationType === 'online' && !meetingUrl && !accessInstructions) {
      errors.push('Online events require either a meeting URL or access instructions');
    }
  }

  const sanitizedLocation: LocationConfig = {
    type: locationType || 'offline',
    ...(venueName ? { venueName } : {}),
    ...(address ? { address } : {}),
    ...(meetingUrl ? { meetingUrl } : {}),
    ...(accessInstructions ? { accessInstructions } : {}),
    ...(rawLocation?.coordinates && typeof rawLocation.coordinates.latitude === 'number' && typeof rawLocation.coordinates.longitude === 'number'
      ? { coordinates: { latitude: rawLocation.coordinates.latitude, longitude: rawLocation.coordinates.longitude } }
      : {}),
  };

  // 9. Booking configuration validation
  const rawBooking = raw.bookingConfig;
  const isUnlimitedCapacity = Boolean(rawBooking?.isUnlimitedCapacity);
  const capacity = typeof rawBooking?.capacity === 'number' ? Math.round(rawBooking.capacity) : 0;
  let maxParticipants = typeof rawBooking?.maxParticipantsPerBooking === 'number'
    ? Math.round(rawBooking.maxParticipantsPerBooking)
    : 1;

  if (listingType === 'free_booking' || listingType === 'paid_booking' || rawBooking) {
    if (!isUnlimitedCapacity) {
      if (capacity <= 0) {
        errors.push('Capacity must be a positive number greater than 0');
      }
    }

    if (maxParticipants < 1) {
      errors.push('Max participants per booking must be at least 1');
      maxParticipants = 1;
    } else if (!isUnlimitedCapacity && capacity > 0 && maxParticipants > capacity) {
      errors.push('Max participants per booking cannot exceed total event capacity');
    }

    const regOpen = rawBooking?.registrationOpenDate;
    const regClose = rawBooking?.registrationCloseDate;

    if (regOpen && !isValidIsoDate(regOpen)) {
      errors.push('Registration open date must be a valid ISO 8601 date string');
    }
    if (regClose && !isValidIsoDate(regClose)) {
      errors.push('Registration close date must be a valid ISO 8601 date string');
    }
    if (isValidIsoDate(regOpen) && isValidIsoDate(regClose)) {
      if (new Date(regClose).getTime() < new Date(regOpen).getTime()) {
        errors.push('Registration close date must be on or after registration open date');
      }
    }
  }

  const requiredAttendeeFields = Array.isArray(rawBooking?.requiredAttendeeFields)
    ? rawBooking.requiredAttendeeFields.filter((f: any) =>
        ['fullName', 'name', 'email', 'phone', 'dietary', 'emergency_contact', 'notes'].includes(f)
      )
    : ['fullName', 'email', 'phone'];

  const sanitizedBooking: BookingConfig = {
    capacity: isUnlimitedCapacity ? 0 : Math.max(0, capacity),
    isUnlimitedCapacity,
    maxParticipantsPerBooking: maxParticipants,
    registrationOpenDate: isValidIsoDate(rawBooking?.registrationOpenDate)
      ? new Date(rawBooking.registrationOpenDate).toISOString()
      : (validStartDate ? new Date().toISOString() : ''),
    registrationCloseDate: isValidIsoDate(rawBooking?.registrationCloseDate)
      ? new Date(rawBooking.registrationCloseDate).toISOString()
      : (sanitizedSchedule.registrationDeadline || sanitizedSchedule.startDate),
    requiredAttendeeFields: requiredAttendeeFields.length > 0 ? requiredAttendeeFields : ['fullName', 'email', 'phone'],
    cancellationPolicy: typeof rawBooking?.cancellationPolicy === 'string' && rawBooking.cancellationPolicy.trim()
      ? rawBooking.cancellationPolicy.trim()
      : 'Free cancellation up to 24 hours before event start.',
    allowWaitlist: Boolean(rawBooking?.allowWaitlist),
  };

  // 10. Payment configuration validation
  const rawPayment = raw.paymentConfig;
  const isPaid = listingType === 'paid_booking';
  const paymentAmount = typeof rawPayment?.amount === 'number' ? rawPayment.amount : 0;
  const paymentCurrency = typeof rawPayment?.currency === 'string' && rawPayment.currency.trim()
    ? rawPayment.currency.trim().toUpperCase()
    : 'INR';

  if (isPaid) {
    if (paymentAmount <= 0) {
      errors.push('Ticket price amount must be greater than 0 for paid bookings');
    }
  }

  const sanitizedPayment: PaymentConfig = {
    enabled: isPaid || Boolean(rawPayment?.enabled),
    currency: paymentCurrency,
    amount: isPaid ? Math.max(0, paymentAmount) : 0,
    provider: (rawPayment?.provider as any) || (isPaid ? 'none' : 'none'),
    providerStatus: (rawPayment?.providerStatus as PaymentProviderStatus) || 'unconfigured',
  };

  // 11. Tags validation
  const tags = Array.isArray(raw.tags)
    ? Array.from(new Set(raw.tags.map((t: any) => String(t).trim().toLowerCase()).filter((t: string) => t.length > 0)))
    : [];

  // 12. Organizer info
  const sanitizedOrganizer: OrganizerInfo = {
    name: typeof raw.organizer?.name === 'string' && raw.organizer.name.trim()
      ? raw.organizer.name.trim()
      : 'Nirvaha Team',
    email: typeof raw.organizer?.email === 'string' ? raw.organizer.email.trim() : '',
    contact: typeof raw.organizer?.contact === 'string' ? raw.organizer.contact.trim() : '',
    avatarUrl: typeof raw.organizer?.avatarUrl === 'string' ? raw.organizer.avatarUrl.trim() : '',
    bio: typeof raw.organizer?.bio === 'string' ? raw.organizer.bio.trim() : '',
  };

  // 13. Media config
  const sanitizedMedia: MediaConfig = {
    coverImageUrl: typeof raw.media?.coverImageUrl === 'string' ? raw.media.coverImageUrl.trim() : '',
    galleryImageUrls: Array.isArray(raw.media?.galleryImageUrls)
      ? raw.media.galleryImageUrls.map((u: any) => String(u).trim()).filter((u: string) => u.length > 0)
      : [],
  };

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    sanitized: {
      title,
      shortDescription,
      fullDescription,
      category,
      tags,
      organizer: sanitizedOrganizer,
      media: sanitizedMedia,
      schedule: sanitizedSchedule,
      location: sanitizedLocation,
      listingType,
      ...(externalUrl ? { externalUrl } : {}),
      bookingConfig: sanitizedBooking,
      paymentConfig: sanitizedPayment,
      displayOrder: typeof raw.displayOrder === 'number' ? Math.round(raw.displayOrder) : 0,
      notifyOnPublish: Boolean(raw.notifyOnPublish),
    },
  };
}

/**
 * Validates and sanitizes payload for updating an existing event listing
 */
export function validateUpdateEventInput(data: unknown): ValidationResult<UpdateEventInput> {
  const errors: string[] = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
    };
  }

  const raw = data as Record<string, any>;
  const sanitized: UpdateEventInput = {};

  if (raw.title !== undefined) {
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!title || title.length < 3) {
      errors.push('Title must be at least 3 characters');
    } else if (title.length > 120) {
      errors.push('Title cannot exceed 120 characters');
    } else {
      sanitized.title = title;
    }
  }

  if (raw.shortDescription !== undefined) {
    const desc = typeof raw.shortDescription === 'string' ? raw.shortDescription.trim() : '';
    if (!desc || desc.length < 10) {
      errors.push('Short description must be between 10 and 250 characters');
    } else if (desc.length > 250) {
      errors.push('Short description cannot exceed 250 characters');
    } else {
      sanitized.shortDescription = desc;
    }
  }

  if (raw.fullDescription !== undefined) {
    sanitized.fullDescription = typeof raw.fullDescription === 'string' ? raw.fullDescription.trim() : '';
  }

  if (raw.category !== undefined) {
    if (!VALID_EVENT_CATEGORIES.includes(raw.category)) {
      errors.push(`Category must be one of: ${VALID_EVENT_CATEGORIES.join(', ')}`);
    } else {
      sanitized.category = raw.category;
    }
  }

  if (raw.listingType !== undefined) {
    if (!VALID_LISTING_TYPES.includes(raw.listingType)) {
      errors.push(`Listing type must be one of: ${VALID_LISTING_TYPES.join(', ')}`);
    } else {
      sanitized.listingType = raw.listingType;
    }
  }

  if (raw.publicationStatus !== undefined) {
    if (!VALID_PUBLICATION_STATUSES.includes(raw.publicationStatus)) {
      errors.push(`Publication status must be one of: ${VALID_PUBLICATION_STATUSES.join(', ')}`);
    } else {
      sanitized.publicationStatus = raw.publicationStatus;
    }
  }

  if (raw.schedule !== undefined && typeof raw.schedule === 'object') {
    const s = raw.schedule;
    if (s.startDate !== undefined && !isValidIsoDate(s.startDate)) {
      errors.push('Schedule start date must be a valid ISO 8601 date string');
    }
    if (s.endDate !== undefined && !isValidIsoDate(s.endDate)) {
      errors.push('Schedule end date must be a valid ISO 8601 date string');
    }
    if (isValidIsoDate(s.startDate) && isValidIsoDate(s.endDate)) {
      if (new Date(s.endDate).getTime() < new Date(s.startDate).getTime()) {
        errors.push('Event end date must be on or after start date');
      }
    }
    if (s.registrationDeadline !== undefined && s.registrationDeadline !== null && s.registrationDeadline !== '') {
      if (!isValidIsoDate(s.registrationDeadline)) {
        errors.push('Registration deadline must be a valid ISO 8601 date string');
      } else if (isValidIsoDate(s.startDate) && new Date(s.registrationDeadline).getTime() > new Date(s.startDate).getTime()) {
        errors.push('Registration deadline must be before or equal to event start date');
      }
    }
    sanitized.schedule = s as ScheduleConfig;
  }

  if (raw.location !== undefined && typeof raw.location === 'object') {
    const loc = raw.location;
    if (loc.type !== undefined && !VALID_LOCATION_TYPES.includes(loc.type)) {
      errors.push(`Location type must be one of: ${VALID_LOCATION_TYPES.join(', ')}`);
    }
    if (loc.meetingUrl && !isValidHttpUrl(loc.meetingUrl)) {
      errors.push('Meeting URL must be a valid HTTP or HTTPS URL');
    }
    sanitized.location = loc as LocationConfig;
  }

  if (raw.bookingConfig !== undefined && typeof raw.bookingConfig === 'object') {
    const bc = raw.bookingConfig;
    if (bc.capacity !== undefined && !bc.isUnlimitedCapacity && (typeof bc.capacity !== 'number' || bc.capacity <= 0)) {
      errors.push('Capacity must be a positive number greater than 0');
    }
    if (bc.maxParticipantsPerBooking !== undefined && (typeof bc.maxParticipantsPerBooking !== 'number' || bc.maxParticipantsPerBooking < 1)) {
      errors.push('Max participants per booking must be at least 1');
    }
    sanitized.bookingConfig = bc as BookingConfig;
  }

  if (raw.paymentConfig !== undefined && typeof raw.paymentConfig === 'object') {
    sanitized.paymentConfig = raw.paymentConfig as PaymentConfig;
  }

  if (raw.organizer !== undefined && typeof raw.organizer === 'object') {
    sanitized.organizer = raw.organizer as OrganizerInfo;
  }

  if (raw.media !== undefined && typeof raw.media === 'object') {
    sanitized.media = raw.media as MediaConfig;
  }

  if (Array.isArray(raw.tags)) {
    sanitized.tags = Array.from(new Set(raw.tags.map((t: any) => String(t).trim().toLowerCase()).filter((t: string) => t.length > 0)));
  }

  if (typeof raw.displayOrder === 'number') {
    sanitized.displayOrder = Math.round(raw.displayOrder);
  }

  if (raw.notifyOnPublish !== undefined) {
    sanitized.notifyOnPublish = Boolean(raw.notifyOnPublish);
  }

  if (raw.externalUrl !== undefined) {
    if (raw.externalUrl && !isValidHttpUrl(raw.externalUrl)) {
      errors.push('External URL must be a valid HTTP or HTTPS URL');
    } else {
      sanitized.externalUrl = raw.externalUrl ? String(raw.externalUrl).trim() : undefined;
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [], sanitized };
}

/**
 * Validates publication transition requests and enforces the strict payment invariant
 */
export function validatePublishEventInput(
  data: unknown,
  currentEvent?: EventListing
): ValidationResult<PublishEventInput> {
  const errors: string[] = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
    };
  }

  const raw = data as Record<string, any>;
  const action = raw.action;

  if (!action || !VALID_PUBLISH_ACTIONS.includes(action)) {
    errors.push(`Invalid publication action. Must be one of: ${VALID_PUBLISH_ACTIONS.join(', ')}`);
  }

  // CRITICAL PAYMENT INVARIANT:
  // If listingType === 'paid_booking' and paymentConfig.providerStatus !== 'active' (or 'live'),
  // publishing must fail validation with:
  // "Publication of paid bookings is blocked until an approved payment provider is configured"
  if (action === 'publish' || action === 'feature') {
    const listingType = raw.listingType || currentEvent?.listingType;
    if (listingType === 'paid_booking') {
      const paymentConfig = raw.paymentConfig || currentEvent?.paymentConfig;
      const providerStatus = paymentConfig?.providerStatus;
      const isEnabled = paymentConfig?.enabled !== false;

      const isApproved = (providerStatus === 'active' || providerStatus === 'live') && isEnabled;

      if (!isApproved) {
        errors.push('Publication of paid bookings is blocked until an approved payment provider is configured');
      }
    }

    if (currentEvent) {
      if (currentEvent.listingType === 'external_registration' && !currentEvent.externalUrl) {
        errors.push('Cannot publish external registration event without external URL');
      }
      if (currentEvent.schedule?.endDate && new Date(currentEvent.schedule.endDate).getTime() < Date.now()) {
        errors.push('Cannot publish an event whose end date is in the past');
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
      action,
      notifyOnPublish: Boolean(raw.notifyOnPublish),
    },
  };
}
