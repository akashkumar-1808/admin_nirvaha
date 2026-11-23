import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase/admin';
import { verifyUserRequest } from '@/lib/auth';
import { apiSuccess, apiError, handleApiError, ApiErrorCode, ApiError } from '@/lib/apiResponse';
import type { EventBooking } from '@/types/bookings';
import type { EventListing } from '@/types/events';

function generateBookingReference(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let ref = 'NIR-EVT-';
  for (let i = 0; i < 6; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

export async function GET(req: NextRequest) {
  try {
    const db = adminDb;
    if (!db) {
      return apiError('Firebase Admin SDK not initialized', 500, ApiErrorCode.INTERNAL_ERROR);
    }

    const authResult = await verifyUserRequest(req);
    if (!authResult.authorized) {
      return apiError(
        authResult.error || 'Missing or invalid Authorization header',
        authResult.status || 401,
        ApiErrorCode.UNAUTHORIZED
      );
    }

    const { searchParams } = new URL(req.url);
    const eventIdFilter = searchParams.get('eventId');
    const statusFilter = searchParams.get('status');
    const searchFilter = (searchParams.get('search') || '').toLowerCase().trim();

    const snapshot = await db.collection('bookings').get();
    let bookings: EventBooking[] = snapshot.docs.map((d) => ({
      ...d.data(),
      id: d.id,
    })) as EventBooking[];

    if (!authResult.isAdmin) {
      bookings = bookings.filter((b) => b.userId === authResult.uid);
    } else {
      if (eventIdFilter) {
        bookings = bookings.filter((b) => b.eventId === eventIdFilter);
      }
      if (statusFilter && statusFilter !== 'all') {
        bookings = bookings.filter((b) => b.status === statusFilter);
      }
      if (searchFilter) {
        bookings = bookings.filter((b) => {
          const ref = (b.bookingReference || '').toLowerCase();
          const name = (b.userName || '').toLowerCase();
          const email = (b.userEmail || '').toLowerCase();
          return ref.includes(searchFilter) || name.includes(searchFilter) || email.includes(searchFilter);
        });
      }
    }

    bookings.sort((a, b) => (b.bookedAt || '').localeCompare(a.bookedAt || ''));

    return NextResponse.json({
      success: true,
      data: bookings,
      bookings,
      total: bookings.length,
    }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = adminDb;
    if (!db) {
      return apiError('Firebase Admin SDK not initialized', 500, ApiErrorCode.INTERNAL_ERROR);
    }

    const authResult = await verifyUserRequest(req);
    if (!authResult.authorized) {
      return apiError(
        authResult.error || 'Missing or invalid Authorization header',
        authResult.status || 401,
        ApiErrorCode.UNAUTHORIZED
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return apiError('Invalid JSON request body', 400, ApiErrorCode.BAD_REQUEST);
    }

    const { eventId, participantCount = 1, attendeeDetails = [] } = body || {};

    if (!eventId) {
      return apiError('eventId is required', 400, 'MISSING_EVENT_ID');
    }

    if (typeof participantCount !== 'number' || participantCount < 1) {
      return apiError('Participant count must be at least 1', 400, ApiErrorCode.INVALID_PARTICIPANT_COUNT);
    }

    // STRICT ANTI-DUPLICATION CHECK: User cannot register twice for the same event
    const userUid = authResult.uid!;
    const userEmail = (body?.userEmail || authResult.email || '').toLowerCase().trim();

    // Check for existing active bookings by userId
    const userBookingsSnap = await db
      .collection('bookings')
      .where('eventId', '==', eventId)
      .where('userId', '==', userUid)
      .get();

    const activeUserBooking = userBookingsSnap.docs.find((d) => {
      const data = d.data();
      return data.status === 'confirmed' || data.status === 'waitlist' || data.status === 'attended';
    });

    if (activeUserBooking) {
      const data = activeUserBooking.data();
      return apiError(
        'You are already registered for this experience. Duplicate registrations are not permitted.',
        409,
        ApiErrorCode.DUPLICATE_BOOKING,
        {
          existingBookingId: activeUserBooking.id,
          bookingReference: data.bookingReference,
          status: data.status,
        }
      );
    }

    // Check by email if provided
    if (userEmail) {
      const emailBookingsSnap = await db
        .collection('bookings')
        .where('eventId', '==', eventId)
        .where('userEmail', '==', userEmail)
        .get();

      const activeEmailBooking = emailBookingsSnap.docs.find((d) => {
        const data = d.data();
        return data.status === 'confirmed' || data.status === 'waitlist' || data.status === 'attended';
      });

      if (activeEmailBooking) {
        const data = activeEmailBooking.data();
        return apiError(
          'A reservation with this email address already exists for this experience.',
          409,
          ApiErrorCode.DUPLICATE_BOOKING,
          {
            existingBookingId: activeEmailBooking.id,
            bookingReference: data.bookingReference,
            status: data.status,
          }
        );
      }
    }

    const newBooking = await db.runTransaction(async (transaction) => {
      const eventRef = db.collection('events').doc(eventId);
      const eventDoc = await transaction.get(eventRef);

      if (!eventDoc.exists) {
        throw new ApiError(404, 'Event not found', ApiErrorCode.EVENT_NOT_FOUND);
      }

      const event = eventDoc.data() as EventListing;

      if (event.publicationStatus !== 'published' && event.publicationStatus !== 'featured') {
        throw new ApiError(400, 'Event is not open for bookings', ApiErrorCode.EVENT_NOT_OPEN_FOR_BOOKING);
      }

      if (event.listingType !== 'free_booking' && event.listingType !== 'paid_booking') {
        throw new ApiError(400, 'This listing does not support direct in-app booking', ApiErrorCode.BOOKING_NOT_SUPPORTED);
      }

      const now = new Date().toISOString();
      if (event.bookingConfig?.registrationOpenDate && now < event.bookingConfig.registrationOpenDate) {
        throw new ApiError(400, 'Registration for this event has not opened yet', ApiErrorCode.REGISTRATION_NOT_OPEN_YET);
      }
      if (event.bookingConfig?.registrationCloseDate && now > event.bookingConfig.registrationCloseDate) {
        throw new ApiError(400, 'Registration for this event has closed', ApiErrorCode.REGISTRATION_CLOSED);
      }
      if (event.schedule?.registrationDeadline && now > event.schedule.registrationDeadline) {
        throw new ApiError(400, 'Registration deadline has passed', ApiErrorCode.DEADLINE_EXCEEDED);
      }

      const maxPerBooking = event.bookingConfig?.maxParticipantsPerBooking || 1;
      if (participantCount > maxPerBooking) {
        throw new ApiError(
          400,
          `Cannot book more than ${maxPerBooking} participants per reservation`,
          ApiErrorCode.MAX_PARTICIPANTS_EXCEEDED
        );
      }

      if (!event.bookingConfig?.isUnlimitedCapacity) {
        const currentAttendees = event.attendeeCount || 0;
        const capacity = event.bookingConfig?.capacity || 0;
        const remainingCapacity = Math.max(0, capacity - currentAttendees);

        if (currentAttendees + participantCount > capacity) {
          const err: any = new ApiError(
            409,
            `Requested seats exceed available capacity. Seats remaining: ${remainingCapacity}`,
            ApiErrorCode.CAPACITY_EXCEEDED,
            { availableCapacity: remainingCapacity }
          );
          err.availableCapacity = remainingCapacity;
          throw err;
        }
      }

      const bookingRef = db.collection('bookings').doc();
      const bookingReference = generateBookingReference();

      const bookingRecord: EventBooking = {
        id: bookingRef.id,
        bookingReference,
        eventId: event.id,
        eventTitle: event.title,
        eventCategory: event.category,
        eventDate: event.schedule?.startDate || now,
        eventStartDate: event.schedule?.startDate,
        eventEndDate: event.schedule?.endDate,
        eventLocationType: event.location?.type || 'offline',
        eventVenueOrUrl:
          event.location?.type === 'online'
            ? event.location?.meetingUrl || ''
            : event.location?.venueName || event.location?.address || '',
        userId: authResult.uid!,
        userEmail: body?.userEmail || authResult.email || '',
        userName: body?.userName || attendeeDetails?.[0]?.fullName || 'Seeker',
        userPhone: body?.userPhone || attendeeDetails?.[0]?.phone || '',
        participantCount,
        attendeeDetails: attendeeDetails || [],
        status: 'confirmed',
        bookedAt: now,
        updatedAt: now,
      };

      transaction.set(bookingRef, bookingRecord);
      transaction.update(eventRef, {
        attendeeCount: (event.attendeeCount || 0) + participantCount,
        confirmedBookingsCount: (event.confirmedBookingsCount || 0) + 1,
        updatedAt: now,
      });

      return bookingRecord;
    });

    return NextResponse.json({
      success: true,
      data: newBooking,
      booking: newBooking,
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
