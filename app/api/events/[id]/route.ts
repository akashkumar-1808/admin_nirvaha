import { NextRequest } from 'next/server';
import { adminDb } from '@/services/firebase/admin';
import { verifyAdminRequest, verifyUserRequest } from '@/lib/auth';
import { apiSuccess, apiError, handleApiError, ApiErrorCode } from '@/lib/apiResponse';
import { validateUpdateEventInput } from '@/lib/validations/events';
import type { EventListing } from '@/types/events';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    if (!adminDb) {
      return apiError('Firebase Admin SDK not initialized', 500, ApiErrorCode.INTERNAL_ERROR);
    }

    const { id } = await context.params;
    const docRef = adminDb.collection('events').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return apiError(`Event ${id} not found`, 404, ApiErrorCode.EVENT_NOT_FOUND);
    }

    const event = snap.data() as EventListing;
    const userAuth = await verifyUserRequest(req);
    const isAdmin = Boolean(userAuth.authorized && userAuth.isAdmin);

    // Non-admin users can only view published or featured events
    if (!isAdmin && event.publicationStatus !== 'published' && event.publicationStatus !== 'featured') {
      return apiError(`Event ${id} not found`, 404, ApiErrorCode.EVENT_NOT_FOUND);
    }

    return apiSuccess(event);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;
    const docRef = adminDb.collection('events').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return apiError(`Event ${id} not found`, 404, ApiErrorCode.EVENT_NOT_FOUND);
    }

    let rawBody: any;
    try {
      rawBody = await req.json();
    } catch {
      return apiError('Invalid JSON request body', 400, ApiErrorCode.BAD_REQUEST);
    }

    const validation = validateUpdateEventInput(rawBody);
    if (!validation.isValid) {
      return apiError(validation.errors[0] || 'Validation failed', 400, ApiErrorCode.VALIDATION_ERROR, {
        errors: validation.errors,
      });
    }

    // Protect immutable counters and system fields
    const sanitizedUpdates = { ...rawBody };
    delete sanitizedUpdates.id;
    delete sanitizedUpdates.createdAt;
    delete sanitizedUpdates.attendeeCount;
    delete sanitizedUpdates.confirmedBookingsCount;
    delete sanitizedUpdates.notificationSent;
    delete sanitizedUpdates.notificationSentAt;

    sanitizedUpdates.updatedAt = new Date().toISOString();
    sanitizedUpdates.updatedBy = authResult.email || authResult.uid || 'admin';

    await docRef.update(sanitizedUpdates);
    const updatedSnap = await docRef.get();

    return apiSuccess(updatedSnap.data());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  return PUT(req, context);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;
    const docRef = adminDb.collection('events').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return apiError(`Event ${id} not found`, 404, ApiErrorCode.EVENT_NOT_FOUND);
    }

    const event = snap.data() as EventListing;

    // Reject hard delete if active bookings exist
    if ((event.confirmedBookingsCount || 0) > 0 || (event.attendeeCount || 0) > 0) {
      return apiError(
        'Cannot delete event with existing attendee reservations. Archive or cancel the event instead.',
        409,
        ApiErrorCode.EVENT_HAS_ACTIVE_BOOKINGS
      );
    }

    await docRef.delete();
    return apiSuccess({ id }, 200, `Event ${id} successfully deleted`);
  } catch (error) {
    return handleApiError(error);
  }
}
