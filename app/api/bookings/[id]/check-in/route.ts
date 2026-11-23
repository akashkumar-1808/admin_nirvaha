import { NextRequest } from 'next/server';
import { adminDb } from '@/services/firebase/admin';
import { verifyAdminRequest } from '@/lib/auth';
import { apiSuccess, apiError, handleApiError, ApiErrorCode } from '@/lib/apiResponse';
import type { EventBooking } from '@/types/bookings';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/bookings/[id]/check-in
 * Marks a booking as 'attended' with atomic timestamp and staff auditor tracking.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const db = adminDb;
    if (!db) {
      return apiError('Firebase Admin SDK not initialized', 500, ApiErrorCode.INTERNAL_ERROR);
    }

    const authResult = await verifyAdminRequest(req);
    if (!authResult.authorized) {
      return apiError(
        authResult.error || 'Admin authorization required for attendance check-in',
        authResult.status || 403,
        authResult.status === 401 ? ApiErrorCode.UNAUTHORIZED : ApiErrorCode.FORBIDDEN
      );
    }

    const { id } = await context.params;
    const bookingRef = db.collection('bookings').doc(id);
    const snap = await bookingRef.get();

    if (!snap.exists) {
      return apiError(`Booking ${id} not found`, 404, ApiErrorCode.BOOKING_NOT_FOUND);
    }

    const booking = snap.data() as EventBooking;

    if (booking.status === 'cancelled') {
      return apiError(
        'Cannot check in attendee: this reservation has been cancelled.',
        400,
        ApiErrorCode.BOOKING_ALREADY_CANCELLED
      );
    }

    if (booking.status === 'attended') {
      return apiError(
        `Attendee is already checked in (Checked in on ${new Date(booking.checkedInAt || '').toLocaleTimeString()}).`,
        400,
        ApiErrorCode.ALREADY_CHECKED_IN,
        { checkedInAt: booking.checkedInAt, bookingReference: booking.bookingReference }
      );
    }

    const nowIso = new Date().toISOString();
    const checkedInBy = authResult.email || authResult.uid || 'admin';

    await bookingRef.update({
      status: 'attended',
      checkedInAt: nowIso,
      checkedInBy,
      updatedAt: nowIso,
    });

    const updatedSnap = await bookingRef.get();
    const updatedBooking = { ...updatedSnap.data(), id: updatedSnap.id } as EventBooking;

    return apiSuccess({
      message: `Successfully checked in ${updatedBooking.userName} (${updatedBooking.bookingReference})`,
      booking: updatedBooking,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
