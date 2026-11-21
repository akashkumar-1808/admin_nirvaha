import { NextRequest } from 'next/server';
import { adminDb, adminMessaging } from '@/services/firebase/admin';
import { verifyAdminRequest } from '@/lib/auth';
import { apiSuccess, apiError, handleApiError, ApiErrorCode } from '@/lib/apiResponse';
import type { EventListing, EventPublicationStatus } from '@/types/events';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
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
    const eventRef = adminDb.collection('events').doc(id);
    const snap = await eventRef.get();

    if (!snap.exists) {
      return apiError(`Event ${id} not found`, 404, ApiErrorCode.EVENT_NOT_FOUND);
    }

    const event = snap.data() as EventListing;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body defaults to publish action
    }

    const action = body?.action || 'publish';
    const notifyOnPublish = body?.notifyOnPublish === true || event.notifyOnPublish === true;

    const validActions = ['publish', 'unpublish', 'feature', 'cancel', 'archive'];
    if (!validActions.includes(action)) {
      return apiError(`Action must be one of: ${validActions.join(', ')}`, 400, 'INVALID_ACTION');
    }

    // STRICT PAYMENT PROVIDER SAFEKEEPER
    if ((action === 'publish' || action === 'feature') && event.listingType === 'paid_booking') {
      const isLive =
        event.paymentConfig?.enabled === true &&
        (event.paymentConfig?.providerStatus === 'live' || event.paymentConfig?.providerStatus === 'active');

      if (!isLive) {
        return apiError(
          'Paid booking events cannot be published without an active, verified payment provider configuration.',
          400,
          ApiErrorCode.PAYMENT_PROVIDER_UNCONFIGURED
        );
      }
    }

    let targetStatus: EventPublicationStatus = 'published';
    if (action === 'unpublish') targetStatus = 'draft';
    if (action === 'feature') targetStatus = 'featured';
    if (action === 'cancel') targetStatus = 'cancelled';
    if (action === 'archive') targetStatus = 'archived';

    const nowIso = new Date().toISOString();
    const updates: Record<string, any> = {
      publicationStatus: targetStatus,
      updatedAt: nowIso,
      updatedBy: authResult.email || authResult.uid || 'admin',
    };

    let notificationDispatched = false;
    if (
      (action === 'publish' || action === 'feature') &&
      notifyOnPublish &&
      event.notificationSent !== true
    ) {
      if (adminMessaging) {
        try {
          await adminMessaging.send({
            topic: 'all_users',
            notification: {
              title: `New Experience: ${event.title}`,
              body: event.shortDescription || 'Check out our new community event in the Nirvaha App!',
            },
            android: {
              priority: 'high',
              notification: {
                channelId: 'nirvaha_general_broadcast',
                imageUrl: event.media?.coverImageUrl || '',
              },
            },
            data: {
              deepLink: `nirvaha://events/${event.id}`,
              eventId: event.id,
              type: 'EVENT_ANNOUNCEMENT',
              category: event.category || '',
            },
          });
        } catch (fcmErr) {
          console.warn('FCM broadcast warning:', fcmErr);
        }
      }

      updates.notificationSent = true;
      updates.notificationSentAt = nowIso;
      notificationDispatched = true;
    }

    await eventRef.update(updates);
    const updatedSnap = await eventRef.get();

    return apiSuccess(
      updatedSnap.data(),
      200,
      `Event status successfully updated to ${targetStatus}`,
      { notificationDispatched }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

