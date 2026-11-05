import { NextRequest } from 'next/server';
import { adminDb } from '@/services/firebase/admin';
import { verifyUserRequest } from '@/lib/auth';
import { apiSuccess, apiError, handleApiError, ApiErrorCode, ApiError } from '@/lib/apiResponse';
import type { EventBooking } from '@/types/bookings';
import type { EventListing } from '@/types/events';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    if (!adminDb) {
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

    const { id: bookingId } = await context.params;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body allowed
    }

    const reason = body?.reason || 'Cancelled by user';

    const result = await adminDb.runTransaction(async (transaction) => {
      const bookingRef = adminDb.collection('bookings').doc(bookingId);
      const bookingDoc = await transaction.get(bookingRef);

      if (!bookingDoc.exists) {
        throw new ApiError(404, 'Booking not found', ApiErrorCode.BOOKING_NOT_FOUND);
      }

      const booking = bookingDoc.data() as EventBooking;

      // Ownership authorization: user must own the booking or be admin
      if (!authResult.isAdmin && booking.userId !== authResult.uid) {
        throw new ApiError(
          403,
          'You do not have permission to cancel this booking',
          ApiErrorCode.FORBIDDEN
        );
      }

      if (booking.status !== 'confirmed') {
        throw new ApiError(400, 'Only confirmed bookings can be cancelled', 'BOOKING_NOT_ACTIVE');
      }

      const eventRef = adminDb.collection('events').doc(booking.eventId);
      const eventDoc = await transaction.get(eventRef);
      const now = new Date().toISOString();

      transaction.update(bookingRef, {
        status: 'cancelled',
        cancelledAt: now,
        cancellationReason: reason,
        cancelledBy: authResult.isAdmin ? 'admin' : 'user',
        updatedAt: now,
      });

      // Atomically restore capacity if event still exists
      if (eventDoc.exists) {
        const event = eventDoc.data() as EventListing;
        transaction.update(eventRef, {
          attendeeCount: Math.max(0, (event.attendeeCount || 0) - (booking.participantCount || 1)),
          confirmedBookingsCount: Math.max(0, (event.confirmedBookingsCount || 0) - 1),
          updatedAt: now,
        });
      }

      return {
        ...booking,
        status: 'cancelled',
        cancelledAt: now,
        cancellationReason: reason,
        cancelledBy: authResult.isAdmin ? 'admin' : 'user',
        updatedAt: now,
      };
    });

    return apiSuccess(result, 200, 'Booking successfully cancelled');
  } catch (error) {
    return handleApiError(error);
  }
}
