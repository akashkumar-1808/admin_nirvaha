/**
 * Events Service for Nirvaha Mobile Application
 *
 * Implements:
 * 1. Primary HTTP API queries to Team 1 backend endpoints (`GET /api/events`, `GET /api/events/[id]`).
 * 2. Hardened fallback to Cloud Firestore client reads strictly restricted to `publicationStatus in ['published', 'featured']`.
 * 3. Complete date and structure normalization for both HTTP JSON and Firestore DocumentSnapshot.
 * 4. Strictly zero direct Firestore write operations.
 */

import {
  EventDocument,
  EventFilterParams,
  EventCategory,
  EventListingType,
  EventPublicationStatus,
  LocationType,
} from '../types/events';
import { publicRequest } from './apiClient';
import { db } from '../config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit as firestoreLimit,
} from 'firebase/firestore';

/**
 * Universal date normalizer: converts string timestamps, Date objects,
 * or Firestore Timestamp ({ seconds, nanoseconds } or .toDate()) to ISO-8601 string.
 */
function toIsoString(val: any, fallback = new Date().toISOString()): string {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (val instanceof Date) return val.toISOString();
  if (typeof val.toDate === 'function') {
    try {
      return val.toDate().toISOString();
    } catch {
      return fallback;
    }
  }
  if (typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000).toISOString();
  }
  return fallback;
}

/**
 * Normalizes an incoming event document (from API or Firestore) into canonical EventDocument.
 * Populates safe defaults and guarantees date fields are strictly ISO-8601 strings.
 */
export function normalizeEventDocument(raw: any, idFallback?: string): EventDocument {
  const id = raw.id || idFallback || '';
  const now = new Date().toISOString();

  return {
    id,
    title: raw.title || 'Untitled Experience',
    shortDescription: raw.shortDescription || '',
    fullDescription: raw.fullDescription || raw.shortDescription || '',
    category: (raw.category as EventCategory) || 'meditation',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    organizer: {
      name: raw.organizer?.name || 'Nirvaha Guide',
      email: raw.organizer?.email || '',
      contact: raw.organizer?.contact,
      bio: raw.organizer?.bio,
      avatarUrl: raw.organizer?.avatarUrl,
    },
    media: {
      coverImageUrl:
        raw.media?.coverImageUrl ||
        'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80',
      galleryImageUrls: Array.isArray(raw.media?.galleryImageUrls)
        ? raw.media.galleryImageUrls
        : [],
    },
    schedule: {
      startDate: toIsoString(raw.schedule?.startDate, now),
      endDate: toIsoString(raw.schedule?.endDate, now),
      timezone: raw.schedule?.timezone || 'UTC',
      durationMinutes: Number(raw.schedule?.durationMinutes) || 60,
      registrationDeadline: toIsoString(raw.schedule?.registrationDeadline, now),
    },
    location: {
      type: (raw.location?.type as LocationType) || 'online',
      venueName: raw.location?.venueName,
      address: raw.location?.address,
      coordinates: raw.location?.coordinates,
      meetingUrl: raw.location?.meetingUrl,
      accessInstructions: raw.location?.accessInstructions,
    },
    listingType: (raw.listingType as EventListingType) || 'advertisement',
    bookingConfig: {
      capacity: Number(raw.bookingConfig?.capacity) || 0,
      maxParticipantsPerBooking:
        Number(raw.bookingConfig?.maxParticipantsPerBooking) || 1,
      registrationOpenDate: toIsoString(raw.bookingConfig?.registrationOpenDate, now),
      registrationCloseDate: toIsoString(raw.bookingConfig?.registrationCloseDate, now),
      requiredAttendeeFields: Array.isArray(raw.bookingConfig?.requiredAttendeeFields)
        ? raw.bookingConfig.requiredAttendeeFields
        : ['fullName', 'email'],
      cancellationPolicy: raw.bookingConfig?.cancellationPolicy,
      externalUrl: raw.bookingConfig?.externalUrl,
    },
    paymentConfig: {
      enabled: Boolean(raw.paymentConfig?.enabled),
      currency: raw.paymentConfig?.currency || 'INR',
      amount: Number(raw.paymentConfig?.amount) || 0,
      providerStatus: raw.paymentConfig?.providerStatus || 'unconfigured',
      providerName: raw.paymentConfig?.providerName,
    },
    publicationStatus:
      (raw.publicationStatus as EventPublicationStatus) || 'published',
    isFeatured: Boolean(raw.isFeatured || raw.publicationStatus === 'featured'),
    displayOrder: Number(raw.displayOrder) || 0,
    notifyOnPublish: Boolean(raw.notifyOnPublish),
    notificationSent: Boolean(raw.notificationSent),
    attendeeCount: Number(raw.attendeeCount) || 0,
    confirmedBookingsCount: Number(raw.confirmedBookingsCount) || 0,
    createdAt: toIsoString(raw.createdAt, now),
    updatedAt: toIsoString(raw.updatedAt, now),
  };
}

/**
 * Fetch published events with optional filtering.
 * Primary: Backend API (`GET /api/events`)
 * Secondary fallback: Firestore client read strictly enforcing `publicationStatus in ['published', 'featured']`
 */
export async function fetchEvents(
  filters?: EventFilterParams
): Promise<EventDocument[]> {
  const queryParams = new URLSearchParams();

  // Enforce published status
  queryParams.append('status', 'published');

  if (filters?.category && filters.category !== 'all') {
    queryParams.append('category', filters.category);
  }
  if (filters?.search && filters.search.trim()) {
    queryParams.append('search', filters.search.trim());
  }
  if (filters?.featured !== undefined) {
    queryParams.append('featured', String(filters.featured));
  }
  if (filters?.limit) {
    queryParams.append('limit', String(filters.limit));
  }

  const endpoint = `/api/events?${queryParams.toString()}`;

  // 1. Primary: Backend REST API
  try {
    const response = await publicRequest<{
      success: boolean;
      events: any[];
      total?: number;
    }>(endpoint);

    if (response && Array.isArray(response.events)) {
      return response.events.map((raw) => normalizeEventDocument(raw));
    }
  } catch (apiError) {
    // Graceful fallback to Cloud Firestore client read
    console.warn('[eventsService] Primary API unreachable, attempting Firestore fallback', apiError);
  }

  // 2. Hardened Secondary Fallback: Cloud Firestore
  // Strictly enforce publicationStatus in ['published', 'featured']
  try {
    const eventsRef = collection(db, 'events');
    const constraints: any[] = [
      where('publicationStatus', 'in', ['published', 'featured']),
    ];

    if (filters?.category && filters.category !== 'all') {
      constraints.push(where('category', '==', filters.category));
    }
    if (filters?.limit) {
      constraints.push(firestoreLimit(filters.limit));
    }

    const q = query(eventsRef, ...constraints);
    const snapshot = await getDocs(q);

    let docs = snapshot.docs.map((docSnap) =>
      normalizeEventDocument({ id: docSnap.id, ...docSnap.data() }, docSnap.id)
    );

    // Filter by search string locally if specified
    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      docs = docs.filter(
        (docItem) =>
          docItem.title.toLowerCase().includes(term) ||
          docItem.shortDescription.toLowerCase().includes(term)
      );
    }

    // Filter by featured if specified
    if (filters?.featured !== undefined) {
      docs = docs.filter((docItem) => Boolean(docItem.isFeatured) === filters.featured);
    }

    return docs;
  } catch (firestoreError) {
    console.error('[eventsService] Both primary API and Firestore fallback failed', firestoreError);
    throw new Error('Unable to fetch experiences. Please verify your connection and try again.');
  }
}

/**
 * Fetch featured experiences for rails and highlight banners.
 */
export async function fetchFeaturedEvents(limitCount = 5): Promise<EventDocument[]> {
  return fetchEvents({ featured: true, limit: limitCount });
}

/**
 * Fetch a single event document by its ID.
 * Primary: Backend API (`GET /api/events/[id]`)
 * Secondary fallback: Firestore client doc read with publicationStatus verification
 */
export async function fetchEventById(eventId: string): Promise<EventDocument | null> {
  if (!eventId) return null;

  // 1. Primary: Backend REST API
  try {
    const response = await publicRequest<{
      success: boolean;
      event: any;
    }>(`/api/events/${eventId}`);

    if (response && response.event) {
      return normalizeEventDocument(response.event, eventId);
    }
  } catch (apiError: any) {
    // If backend returns 404, event genuinely does not exist
    if (apiError?.status === 404 || apiError?.isNotFound) {
      return null;
    }
    console.warn(`[eventsService] Primary API error on event ${eventId}, attempting Firestore fallback`, apiError);
  }

  // 2. Hardened Secondary Fallback: Cloud Firestore
  try {
    const docRef = doc(db, 'events', eventId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    // Enforce publicationStatus visibility restriction
    if (
      data.publicationStatus !== 'published' &&
      data.publicationStatus !== 'featured'
    ) {
      console.warn(`[eventsService] Event ${eventId} exists but has restricted status: ${data.publicationStatus}`);
      return null;
    }

    return normalizeEventDocument({ id: docSnap.id, ...data }, docSnap.id);
  } catch (firestoreError) {
    console.error(`[eventsService] Failed to retrieve event ${eventId}`, firestoreError);
    throw new Error('Unable to retrieve event details. Please try again.');
  }
}
