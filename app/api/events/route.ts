import { NextRequest } from 'next/server';
import { adminDb, adminMessaging } from '@/services/firebase/admin';
import { verifyAdminRequest, verifyUserRequest } from '@/lib/auth';
import {
  apiSuccess,
  apiPaginatedSuccess,
  apiError,
  handleApiError,
  ApiErrorCode,
  PaginationMeta,
} from '@/lib/apiResponse';
import { validateCreateEventInput } from '@/lib/validations/events';
import type { EventListing, EventCategory, EventListingType } from '@/types/events';

/**
 * GET /api/events
 * Query Parameters:
 * - timeframe: 'upcoming' (default) | 'past' | 'all'
 * - status: 'all' | 'published' | 'draft' | 'featured' | 'cancelled' | 'archived'
 * - category: filter by EventCategory
 * - listingType: filter by EventListingType
 * - search: case-insensitive text search matching title, shortDescription, or tags
 * - sort: 'startDate_asc' (default) | 'startDate_desc' | 'createdAt_desc' | 'createdAt_asc' | 'displayOrder_asc'
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 */
export async function GET(req: NextRequest) {
  try {
    if (!adminDb) {
      return apiError('Firebase Admin SDK not initialized', 500, ApiErrorCode.INTERNAL_ERROR);
    }

    const { searchParams } = new URL(req.url);
    const timeframe = searchParams.get('timeframe') || 'upcoming';
    const statusParam = searchParams.get('status') || 'all';
    const categoryParam = searchParams.get('category');
    const listingTypeParam = searchParams.get('listingType');
    const searchParam = (searchParams.get('search') || '').toLowerCase().trim();
    const sortParam = searchParams.get('sort') || 'startDate_asc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    // Optional user verification for role-based filtering
    const userAuth = await verifyUserRequest(req);
    const isAdmin = Boolean(userAuth.authorized && userAuth.isAdmin);

    // Non-admins cannot query draft/cancelled/archived directly
    if (!isAdmin && statusParam !== 'all' && statusParam !== 'published' && statusParam !== 'featured') {
      return apiError('Non-admin users cannot query unpublished listings', 403, ApiErrorCode.FORBIDDEN);
    }

    const snapshot = await adminDb.collection('events').get();
    let events: EventListing[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
      } as EventListing;
    });

    // Public / Non-admin isolation: only published or featured
    if (!isAdmin) {
      events = events.filter(
        (e) => e.publicationStatus === 'published' || e.publicationStatus === 'featured'
      );
    } else if (statusParam !== 'all') {
      events = events.filter((e) => e.publicationStatus === statusParam);
    }

    // Category filter
    if (categoryParam && categoryParam !== 'all') {
      events = events.filter((e) => e.category === categoryParam);
    }

    // Listing type filter
    if (listingTypeParam && listingTypeParam !== 'all') {
      events = events.filter((e) => e.listingType === listingTypeParam);
    }

    // Timeframe filter
    const nowIso = new Date().toISOString();
    if (timeframe === 'upcoming') {
      events = events.filter((e) => (e.schedule?.endDate ? e.schedule.endDate >= nowIso : true));
    } else if (timeframe === 'past') {
      events = events.filter((e) => (e.schedule?.endDate ? e.schedule.endDate < nowIso : false));
    }

    // Search query matching
    if (searchParam) {
      events = events.filter((e) => {
        const title = (e.title || '').toLowerCase();
        const shortDesc = (e.shortDescription || '').toLowerCase();
        const fullDesc = (e.fullDescription || '').toLowerCase();
        const tags = Array.isArray(e.tags) ? e.tags.map((t) => String(t).toLowerCase()) : [];
        return (
          title.includes(searchParam) ||
          shortDesc.includes(searchParam) ||
          fullDesc.includes(searchParam) ||
          tags.some((t) => t.includes(searchParam))
        );
      });
    }

    // Sort order
    events.sort((a, b) => {
      if (sortParam === 'startDate_desc') {
        return (b.schedule?.startDate || '').localeCompare(a.schedule?.startDate || '');
      }
      if (sortParam === 'createdAt_desc') {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }
      if (sortParam === 'createdAt_asc') {
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      }
      if (sortParam === 'displayOrder_asc') {
        return (a.displayOrder || 0) - (b.displayOrder || 0);
      }
      // default: startDate_asc
      return (a.schedule?.startDate || '').localeCompare(b.schedule?.startDate || '');
    });

    // Pagination
    const total = events.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const paged = events.slice(offset, offset + limit);

    const pagination: PaginationMeta = {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    };

    return apiPaginatedSuccess(paged, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/events
 * Creates a new event listing (Admin only)
 */
export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return apiError('Firebase Admin SDK not initialized', 500, ApiErrorCode.INTERNAL_ERROR);
    }

    const authResult = await verifyAdminRequest(req);
    if (!authResult.authorized) {
      return apiError(
        authResult.error || 'Admin authorization required',
        authResult.status || 403,
        authResult.status === 401 ? ApiErrorCode.UNAUTHORIZED : ApiErrorCode.FORBIDDEN
      );
    }

    let rawBody: any;
    try {
      rawBody = await req.json();
    } catch {
      return apiError('Invalid JSON request body', 400, ApiErrorCode.BAD_REQUEST);
    }

    if (!rawBody.title || typeof rawBody.title !== 'string' || rawBody.title.trim().length < 3) {
      return apiError('Title must be between 3 and 120 characters', 400, 'INVALID_TITLE');
    }
    if (rawBody.title.trim().length > 120) {
      return apiError('Title cannot exceed 120 characters', 400, 'INVALID_TITLE');
    }

    if (!rawBody.shortDescription || typeof rawBody.shortDescription !== 'string' || rawBody.shortDescription.trim().length < 10) {
      return apiError('Short description must be between 10 and 250 characters', 400, 'INVALID_SHORT_DESCRIPTION');
    }
    if (rawBody.shortDescription.trim().length > 250) {
      return apiError('Short description cannot exceed 250 characters', 400, 'INVALID_SHORT_DESCRIPTION');
    }

    const validCategories = [
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
    if (!rawBody.category || !validCategories.includes(rawBody.category)) {
      return apiError(`Category must be one of: ${validCategories.join(', ')}`, 400, 'INVALID_CATEGORY');
    }

    if (!rawBody.schedule?.startDate || !rawBody.schedule?.endDate) {
      return apiError('Start date and end date are required', 400, 'INVALID_SCHEDULE');
    }
    if (rawBody.schedule.startDate >= rawBody.schedule.endDate) {
      return apiError('Start date must be before end date', 400, 'INVALID_SCHEDULE');
    }
    if (rawBody.schedule.registrationDeadline && rawBody.schedule.registrationDeadline > rawBody.schedule.startDate) {
      return apiError('Registration deadline must be before or equal to event start date', 400, 'INVALID_DEADLINE');
    }

    if (rawBody.bookingConfig) {
      const bc = rawBody.bookingConfig;
      if (!bc.isUnlimitedCapacity && (typeof bc.capacity !== 'number' || bc.capacity <= 0)) {
        return apiError('Capacity must be greater than 0 unless isUnlimitedCapacity is true', 400, 'INVALID_CAPACITY');
      }
      if (bc.registrationOpenDate && bc.registrationCloseDate && bc.registrationOpenDate >= bc.registrationCloseDate) {
        return apiError('Registration open date must be before close date', 400, 'INVALID_REGISTRATION_WINDOW');
      }
    }

    if (rawBody.listingType === 'paid_booking') {
      if (!rawBody.paymentConfig?.enabled || !rawBody.paymentConfig.amount || rawBody.paymentConfig.amount <= 0) {
        return apiError(
          'Paid booking requires paymentConfig enabled with a valid amount > 0',
          400,
          'INVALID_PAYMENT_CONFIG'
        );
      }
    }

    const validation = validateCreateEventInput(rawBody);
    if (!validation.isValid) {
      return apiError(validation.errors[0] || 'Validation failed', 400, ApiErrorCode.VALIDATION_ERROR, {
        errors: validation.errors,
      });
    }

    const sanitized = validation.sanitized!;
    const nowIso = new Date().toISOString();
    const docRef = rawBody.id
      ? adminDb.collection('events').doc(rawBody.id)
      : adminDb.collection('events').doc();

    const newEvent: EventListing = {
      id: docRef.id,
      title: sanitized.title,
      shortDescription: sanitized.shortDescription,
      fullDescription: sanitized.fullDescription,
      category: sanitized.category as EventCategory,
      tags: sanitized.tags || [],
      organizer: sanitized.organizer,
      media: sanitized.media,
      schedule: sanitized.schedule,
      location: sanitized.location,
      listingType: sanitized.listingType as EventListingType,
      ...(sanitized.externalUrl ? { externalUrl: sanitized.externalUrl } : {}),
      bookingConfig: sanitized.bookingConfig,
      paymentConfig: {
        enabled: sanitized.paymentConfig?.enabled || false,
        currency: sanitized.paymentConfig?.currency || 'INR',
        amount: sanitized.paymentConfig?.amount || 0,
        provider: sanitized.paymentConfig?.provider || 'none',
        providerStatus: sanitized.paymentConfig?.providerStatus || 'unconfigured',
      },
      publicationStatus: (rawBody.publicationStatus as any) || 'draft',
      displayOrder: sanitized.displayOrder || 0,
      notifyOnPublish: sanitized.notifyOnPublish || false,
      notificationSent: false,
      attendeeCount: 0,
      confirmedBookingsCount: 0,
      createdBy: authResult.email || authResult.uid || 'admin',
      updatedBy: authResult.email || authResult.uid || 'admin',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await docRef.set(newEvent);

    // FCM Broadcast on Event Creation (when created in published or featured status)
    const isPublished = newEvent.publicationStatus === 'published' || newEvent.publicationStatus === 'featured';
    if (isPublished && (newEvent.notifyOnPublish || rawBody.notifyOnPublish)) {
      if (adminMessaging) {
        try {
          await adminMessaging.send({
            topic: 'all_users',
            notification: {
              title: `New Experience: ${newEvent.title}`,
              body: newEvent.shortDescription || 'Discover this new gathering in Nirvaha!',
            },
            android: {
              priority: 'high',
              notification: {
                channelId: 'nirvaha_general_broadcast',
                imageUrl: newEvent.media?.coverImageUrl || '',
              },
            },
            data: {
              deepLink: `nirvaha://events/${newEvent.id}`,
              eventId: newEvent.id,
              type: 'EVENT_ANNOUNCEMENT',
              category: newEvent.category || '',
            },
          });
          await docRef.update({
            notificationSent: true,
            notificationSentAt: nowIso,
          });
          newEvent.notificationSent = true;
          newEvent.notificationSentAt = nowIso;
        } catch (fcmErr) {
          console.warn('FCM broadcast warning on event creation:', fcmErr);
        }
      }
    }

    return apiSuccess(newEvent, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

