import { NextRequest } from 'next/server';
import { adminDb } from '@/services/firebase/admin';
import { verifyUserRequest } from '@/lib/auth';
import { apiSuccess, apiError, handleApiError, ApiErrorCode } from '@/lib/apiResponse';
import type { EventBooking } from '@/types/bookings';
import { POST as cancelBookingPost } from './cancel/route';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;
    const snap = await adminDb.collection('bookings').doc(id).get();

    if (!snap.exists) {
      return apiError(`Booking ${id} not found`, 404, ApiErrorCode.BOOKING_NOT_FOUND);
    }

    const booking = snap.data() as EventBooking;

    // Strict user isolation: regular users can only access their own bookings
    if (!authResult.isAdmin && booking.userId !== authResult.uid) {
      return apiError(
        'Forbidden: You do not have permission to view this booking',
        403,
        ApiErrorCode.FORBIDDEN
      );
    }

    return apiSuccess(booking);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  return cancelBookingPost(req, context);
}

export async function POST(req: NextRequest, context: RouteContext) {
  return cancelBookingPost(req, context);
}
