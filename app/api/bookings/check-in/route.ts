import { NextRequest } from 'next/server';
import { adminDb } from '@/services/firebase/admin';
import { verifyAdminRequest } from '@/lib/auth';
import { apiSuccess, apiError, handleApiError, ApiErrorCode } from '@/lib/apiResponse';
import type { EventBooking } from '@/types/bookings';

function parsePassInput(rawRef?: string, rawId?: string) {
  let ref = (rawRef || '').trim();
  let id = (rawId || '').trim();

  const candidate = ref || id;
  if (candidate.startsWith('nirvaha://') || candidate.startsWith('nirvahaapp://') || candidate.includes('?')) {
    try {
      const url = new URL(candidate.replace(/^nirvaha(app)?:\/\//, 'https://nirvaha.app/'));
      const pRef = url.searchParams.get('ref');
      const pId = url.searchParams.get('id');
      if (pRef) ref = pRef;
      if (pId) id = pId;
    } catch {
      const mRef = candidate.match(/[?&]ref=([^&]+)/);
      if (mRef) ref = decodeURIComponent(mRef[1]);
      const mId = candidate.match(/[?&]id=([^&]+)/);
      if (mId) id = decodeURIComponent(mId[1]);
    }
  }

  return {
    cleanRef: ref.toUpperCase(),
    cleanId: id,
  };
}

/**
 * POST /api/bookings/check-in
 * Body: { reference?: string; bookingId?: string; verifyOnly?: boolean; dryRun?: boolean }
 * Scans or verifies a reservation pass by code or ID and marks status as 'attended'.
 * If verifyOnly is true, verifies pass validity and returns booking details without mutating state.
 */
export async function POST(req: NextRequest) {
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

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return apiError('Invalid JSON request body', 400, ApiErrorCode.BAD_REQUEST);
    }

    const { reference, bookingId, verifyOnly, dryRun } = body || {};
    const { cleanRef, cleanId } = parsePassInput(reference, bookingId);

    if (!cleanRef && !cleanId) {
      return apiError('Either reference code (e.g. NIR-EVT-XXXXXX) or bookingId is required', 400, ApiErrorCode.BAD_REQUEST);
    }

    let bookingDoc: FirebaseFirestore.DocumentSnapshot | null = null;

    if (cleanId) {
      const snap = await db.collection('bookings').doc(cleanId).get();
      if (snap.exists) {
        bookingDoc = snap;
      }
    }

    if (!bookingDoc && cleanRef) {
      const snap = await db
        .collection('bookings')
        .where('bookingReference', '==', cleanRef)
        .limit(1)
        .get();

      if (!snap.empty) {
        bookingDoc = snap.docs[0];
      }
    }

    if (!bookingDoc || !bookingDoc.exists) {
      return apiError(
        `Pass not found for ${cleanRef || cleanId}. Please verify the booking reference.`,
        404,
        ApiErrorCode.BOOKING_NOT_FOUND
      );
    }

    const booking = bookingDoc.data() as EventBooking;
    const fullBooking: EventBooking = {
      ...booking,
      id: bookingDoc.id,
    };

    // If verifyOnly / dryRun is requested, return legibility report without modifying Firestore
    if (verifyOnly || dryRun) {
      return apiSuccess({
        message: booking.status === 'confirmed'
          ? `Pass verified: ${booking.userName} (${booking.participantCount} ${booking.participantCount === 1 ? 'Seat' : 'Seats'})`
          : booking.status === 'attended'
          ? `Pass already redeemed by ${booking.userName}`
          : `Reservation is ${booking.status}`,
        booking: fullBooking,
        legibility: {
          isValid: booking.status === 'confirmed',
          status: booking.status,
          alreadyAttended: booking.status === 'attended',
          isCancelled: booking.status === 'cancelled',
          checkedInAt: booking.checkedInAt,
          checkedInBy: booking.checkedInBy,
          cancellationReason: booking.cancellationReason,
        },
      });
    }

    if (booking.status === 'cancelled') {
      return apiError(
        `Cannot admit attendee: reservation ${booking.bookingReference} was CANCELLED.`,
        400,
        ApiErrorCode.BOOKING_ALREADY_CANCELLED,
        { booking: fullBooking }
      );
    }

    if (booking.status === 'attended') {
      return apiError(
        `Pass already redeemed: ${booking.userName} was checked in on ${new Date(booking.checkedInAt || '').toLocaleTimeString()}.`,
        400,
        ApiErrorCode.ALREADY_CHECKED_IN,
        { checkedInAt: booking.checkedInAt, booking: fullBooking }
      );
    }

    const nowIso = new Date().toISOString();
    const checkedInBy = authResult.email || authResult.uid || 'admin';

    await bookingDoc.ref.update({
      status: 'attended',
      checkedInAt: nowIso,
      checkedInBy,
      updatedAt: nowIso,
    });

    const updated: EventBooking = {
      ...fullBooking,
      status: 'attended',
      checkedInAt: nowIso,
      checkedInBy,
      updatedAt: nowIso,
    };

    return apiSuccess({
      message: `Admission confirmed! Welcome, ${updated.userName} (${updated.participantCount} ${updated.participantCount === 1 ? 'Guest' : 'Guests'}).`,
      booking: updated,
      legibility: {
        isValid: true,
        status: 'attended',
        alreadyAttended: true,
        isCancelled: false,
        checkedInAt: nowIso,
        checkedInBy,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
