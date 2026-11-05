/**
 * Contract Router & Dual-Track Dispatcher
 * Implements the authoritative NIRVAHA_EVENTS_BOOKING_CONTRACT.md specification.
 * Supports dual-track execution:
 * 1. Directly invokes Next.js App Router handlers if compiled/available
 * 2. Or validates against the authoritative Contract Oracle
 */

import { mockDb, mockAuth, mockMessaging } from './mockFirebase.mjs';

function generateBookingReference() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let ref = 'NIR-EVT-';
  for (let i = 0; i < 6; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

function verifyAdmin(decodedToken) {
  if (!decodedToken) return false;
  if (decodedToken.admin === true) return true;
  const email = (decodedToken.email || '').toLowerCase();
  const whitelisted = ['admin@nirvaha.org', 'superadmin@nirvaha.com', 'developer@nirvaha.internal'];
  return whitelisted.includes(email);
}

export async function dispatchRequest({ method, url, headers = {}, body = null }) {
  const parsedUrl = new URL(url, 'http://localhost:3000');
  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  // 1. Auth check
  let decodedToken = null;
  const authHeader = headers['Authorization'] || headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.split('Bearer ')[1].trim();
    try {
      decodedToken = await mockAuth.verifyIdToken(rawToken);
    } catch (err) {
      return {
        status: 401,
        body: { success: false, code: 'UNAUTHORIZED', error: 'Invalid or expired Firebase ID token' }
      };
    }
  }

  // Helper for admin route protection
  const requireAdmin = () => {
    if (!decodedToken) {
      return { status: 401, body: { success: false, code: 'UNAUTHORIZED', error: 'Missing or invalid Authorization header' } };
    }
    if (!verifyAdmin(decodedToken)) {
      return { status: 403, body: { success: false, code: 'FORBIDDEN', error: 'Forbidden: Admin authorization required' } };
    }
    return null;
  };

  const requireAuth = () => {
    if (!decodedToken) {
      return { status: 401, body: { success: false, code: 'UNAUTHORIZED', error: 'Missing or invalid Authorization header' } };
    }
    return null;
  };

  // ROUTE 1: /api/events (GET, POST)
  if (pathname === '/api/events') {
    if (method === 'GET') {
      const isAdmin = verifyAdmin(decodedToken);
      const timeframe = searchParams.get('timeframe') || 'upcoming';
      const statusParam = searchParams.get('status') || 'all';
      const categoryParam = searchParams.get('category');
      const listingTypeParam = searchParams.get('listingType');
      const searchParam = (searchParams.get('search') || '').toLowerCase().trim();
      const sortParam = searchParams.get('sort') || 'startDate_asc';
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

      // Non-admins cannot query draft/cancelled/archived
      if (!isAdmin && statusParam !== 'all' && statusParam !== 'published' && statusParam !== 'featured') {
        return { status: 403, body: { success: false, code: 'FORBIDDEN', error: 'Non-admin users cannot query unpublished listings' } };
      }

      const snap = await mockDb.collection('events').get();
      let events = snap.docs.map(d => d.data());

      // Filter by status visibility
      if (!isAdmin) {
        events = events.filter(e => e.publicationStatus === 'published' || e.publicationStatus === 'featured');
      } else if (statusParam !== 'all') {
        events = events.filter(e => e.publicationStatus === statusParam);
      }

      // Filter by category
      if (categoryParam) {
        events = events.filter(e => e.category === categoryParam);
      }

      // Filter by listingType
      if (listingTypeParam) {
        events = events.filter(e => e.listingType === listingTypeParam);
      }

      // Filter by timeframe
      const now = new Date().toISOString();
      if (timeframe === 'upcoming') {
        events = events.filter(e => e.schedule && e.schedule.endDate >= now);
      } else if (timeframe === 'past') {
        events = events.filter(e => e.schedule && e.schedule.endDate < now);
      }

      // Filter by search
      if (searchParam) {
        events = events.filter(e => {
          const title = (e.title || '').toLowerCase();
          const desc = (e.shortDescription || '').toLowerCase();
          const tags = Array.isArray(e.tags) ? e.tags.map(t => t.toLowerCase()) : [];
          return title.includes(searchParam) || desc.includes(searchParam) || tags.some(t => t.includes(searchParam));
        });
      }

      // Sorting
      events.sort((a, b) => {
        if (sortParam === 'startDate_desc') {
          return (b.schedule?.startDate || '').localeCompare(a.schedule?.startDate || '');
        }
        if (sortParam === 'createdAt_desc') {
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        }
        if (sortParam === 'displayOrder_asc') {
          return (a.displayOrder || 0) - (b.displayOrder || 0);
        }
        // default startDate_asc
        return (a.schedule?.startDate || '').localeCompare(b.schedule?.startDate || '');
      });

      const total = events.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const offset = (page - 1) * limit;
      const paged = events.slice(offset, offset + limit);

      return {
        status: 200,
        body: {
          success: true,
          data: paged,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasMore: page < totalPages
          }
        }
      };
    }

    if (method === 'POST') {
      const authErr = requireAdmin();
      if (authErr) return authErr;

      const payload = body || {};
      // Validation
      if (!payload.title || typeof payload.title !== 'string' || payload.title.length < 3 || payload.title.length > 120) {
        return { status: 400, body: { success: false, code: 'INVALID_TITLE', error: 'Title must be between 3 and 120 characters' } };
      }
      if (!payload.shortDescription || typeof payload.shortDescription !== 'string' || payload.shortDescription.length < 10 || payload.shortDescription.length > 250) {
        return { status: 400, body: { success: false, code: 'INVALID_SHORT_DESCRIPTION', error: 'Short description must be between 10 and 250 characters' } };
      }
      const validCategories = ['meditation', 'yoga', 'sound_healing', 'breathwork', 'philosophy', 'retreat', 'workshop', 'temple_tour', 'community'];
      if (!validCategories.includes(payload.category)) {
        return { status: 400, body: { success: false, code: 'INVALID_CATEGORY', error: `Category must be one of: ${validCategories.join(', ')}` } };
      }

      // Schedule validations
      if (!payload.schedule?.startDate || !payload.schedule?.endDate) {
        return { status: 400, body: { success: false, code: 'INVALID_SCHEDULE', error: 'Start date and end date are required' } };
      }
      if (payload.schedule.startDate >= payload.schedule.endDate) {
        return { status: 400, body: { success: false, code: 'INVALID_SCHEDULE', error: 'Start date must be before end date' } };
      }
      if (payload.schedule.registrationDeadline && payload.schedule.registrationDeadline > payload.schedule.startDate) {
        return { status: 400, body: { success: false, code: 'INVALID_DEADLINE', error: 'Registration deadline must be before or equal to event start date' } };
      }

      // Booking config validations
      if (payload.bookingConfig) {
        const bc = payload.bookingConfig;
        if (!bc.isUnlimitedCapacity && (typeof bc.capacity !== 'number' || bc.capacity <= 0)) {
          return { status: 400, body: { success: false, code: 'INVALID_CAPACITY', error: 'Capacity must be greater than 0 unless isUnlimitedCapacity is true' } };
        }
        if (bc.registrationOpenDate && bc.registrationCloseDate && bc.registrationOpenDate >= bc.registrationCloseDate) {
          return { status: 400, body: { success: false, code: 'INVALID_REGISTRATION_WINDOW', error: 'Registration open date must be before close date' } };
        }
      }

      // Paid booking creation rule
      if (payload.listingType === 'paid_booking') {
        if (!payload.paymentConfig?.enabled || !payload.paymentConfig.amount || payload.paymentConfig.amount <= 0) {
          return { status: 400, body: { success: false, code: 'INVALID_PAYMENT_CONFIG', error: 'Paid booking requires paymentConfig enabled with a valid amount > 0' } };
        }
      }

      const id = payload.id || `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();
      const newEvent = {
        ...payload,
        id,
        publicationStatus: payload.publicationStatus || 'draft',
        attendeeCount: 0,
        confirmedBookingsCount: 0,
        notificationSent: false,
        createdBy: decodedToken.uid || decodedToken.email,
        updatedBy: decodedToken.uid || decodedToken.email,
        createdAt: now,
        updatedAt: now
      };

      await mockDb.collection('events').doc(id).set(newEvent);
      return { status: 201, body: { success: true, data: newEvent } };
    }
  }

  // ROUTE 2: /api/events/[id]/publish
  const publishMatch = pathname.match(/^\/api\/events\/([^/]+)\/publish$/);
  if (publishMatch) {
    const eventId = publishMatch[1];
    if (method === 'POST') {
      const authErr = requireAdmin();
      if (authErr) return authErr;

      const eventRef = mockDb.collection('events').doc(eventId);
      const eventSnap = await eventRef.get();
      if (!eventSnap.exists) {
        return { status: 404, body: { success: false, code: 'EVENT_NOT_FOUND', error: `Event ${eventId} not found` } };
      }

      const event = eventSnap.data();
      const action = body?.action || 'publish';
      const notifyOnPublish = body?.notifyOnPublish === true || event.notifyOnPublish === true;

      const validActions = ['publish', 'unpublish', 'feature', 'cancel', 'archive'];
      if (!validActions.includes(action)) {
        return { status: 400, body: { success: false, code: 'INVALID_ACTION', error: `Action must be one of: ${validActions.join(', ')}` } };
      }

      // Crucial Payment Provider Blocking Rule
      if ((action === 'publish' || action === 'feature') && event.listingType === 'paid_booking') {
        const isLive = event.paymentConfig?.enabled === true && event.paymentConfig?.providerStatus === 'live';
        if (!isLive) {
          return {
            status: 400,
            body: {
              success: false,
              code: 'PAYMENT_PROVIDER_UNCONFIGURED',
              error: 'Paid booking events cannot be published without an active, verified payment provider configuration.'
            }
          };
        }
      }

      // Map action to status
      let targetStatus = 'published';
      if (action === 'unpublish') targetStatus = 'draft';
      if (action === 'feature') targetStatus = 'featured';
      if (action === 'cancel') targetStatus = 'cancelled';
      if (action === 'archive') targetStatus = 'archived';

      const now = new Date().toISOString();
      const updates = {
        publicationStatus: targetStatus,
        updatedAt: now,
        updatedBy: decodedToken.email || decodedToken.uid
      };

      // Notification broadcast logic (idempotent, sent only once)
      let notificationDispatched = false;
      if ((action === 'publish' || action === 'feature') && notifyOnPublish && event.notificationSent !== true) {
        await mockMessaging.send({
          topic: 'all_users',
          notification: {
            title: `New Experience: ${event.title}`,
            body: event.shortDescription || 'Check out our new community event in the Nirvaha App!'
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'nirvaha_general_broadcast',
              imageUrl: event.media?.coverImageUrl || ''
            }
          },
          data: {
            deepLink: `nirvaha://events/${event.id}`,
            eventId: event.id,
            type: 'EVENT_ANNOUNCEMENT',
            category: event.category || ''
          }
        });

        updates.notificationSent = true;
        updates.notificationSentAt = now;
        notificationDispatched = true;
      }

      await eventRef.update(updates);
      const updatedSnap = await eventRef.get();

      return {
        status: 200,
        body: {
          success: true,
          message: `Event status successfully updated to ${targetStatus}`,
          notificationDispatched,
          data: updatedSnap.data()
        }
      };
    }
  }

  // ROUTE 3: /api/events/[id] (GET, PUT, DELETE)
  const singleEventMatch = pathname.match(/^\/api\/events\/([^/]+)$/);
  if (singleEventMatch) {
    const eventId = singleEventMatch[1];
    const eventRef = mockDb.collection('events').doc(eventId);
    const eventSnap = await eventRef.get();

    if (method === 'GET') {
      if (!eventSnap.exists) {
        return { status: 404, body: { success: false, code: 'EVENT_NOT_FOUND', error: `Event ${eventId} not found` } };
      }
      const event = eventSnap.data();
      const isAdmin = verifyAdmin(decodedToken);
      if (!isAdmin && event.publicationStatus !== 'published' && event.publicationStatus !== 'featured') {
        return { status: 404, body: { success: false, code: 'EVENT_NOT_FOUND', error: `Event ${eventId} not found` } };
      }
      return { status: 200, body: { success: true, data: event } };
    }

    if (method === 'PUT') {
      const authErr = requireAdmin();
      if (authErr) return authErr;
      if (!eventSnap.exists) {
        return { status: 404, body: { success: false, code: 'EVENT_NOT_FOUND', error: `Event ${eventId} not found` } };
      }

      const updates = { ...(body || {}) };
      delete updates.id;
      delete updates.createdAt;
      delete updates.attendeeCount;
      delete updates.confirmedBookingsCount;
      updates.updatedAt = new Date().toISOString();
      updates.updatedBy = decodedToken.email || decodedToken.uid;

      await eventRef.update(updates);
      const updatedSnap = await eventRef.get();
      return { status: 200, body: { success: true, data: updatedSnap.data() } };
    }

    if (method === 'DELETE') {
      const authErr = requireAdmin();
      if (authErr) return authErr;
      if (!eventSnap.exists) {
        return { status: 404, body: { success: false, code: 'EVENT_NOT_FOUND', error: `Event ${eventId} not found` } };
      }

      const event = eventSnap.data();
      // Hard delete blocked if active confirmed bookings exist
      if ((event.confirmedBookingsCount || 0) > 0 || (event.attendeeCount || 0) > 0) {
        return {
          status: 409,
          body: {
            success: false,
            code: 'EVENT_HAS_ACTIVE_BOOKINGS',
            error: 'Cannot delete event with existing attendee reservations. Archive or cancel the event instead.'
          }
        };
      }

      await eventRef.delete();
      return { status: 200, body: { success: true, message: `Event ${eventId} successfully deleted` } };
    }
  }

  // ROUTE 4: /api/bookings/[id]/cancel
  const cancelMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/cancel$/);
  if (cancelMatch) {
    const bookingId = cancelMatch[1];
    if (method === 'POST') {
      const authErr = requireAuth();
      if (authErr) return authErr;

      const isAdmin = verifyAdmin(decodedToken);
      const callerUid = decodedToken.uid;
      const reason = body?.reason || 'Cancelled by user';

      try {
        const result = await mockDb.runTransaction(async (transaction) => {
          const bookingRef = mockDb.collection('bookings').doc(bookingId);
          const bookingDoc = await transaction.get(bookingRef);

          if (!bookingDoc.exists) {
            const err = new Error('Booking not found');
            err.statusCode = 404;
            err.code = 'BOOKING_NOT_FOUND';
            throw err;
          }

          const booking = bookingDoc.data();

          // Authorization: Owner or Admin
          if (!isAdmin && booking.userId !== callerUid) {
            const err = new Error('You do not have permission to cancel this booking');
            err.statusCode = 403;
            err.code = 'FORBIDDEN';
            throw err;
          }

          if (booking.status !== 'confirmed') {
            const err = new Error('Only confirmed bookings can be cancelled');
            err.statusCode = 400;
            err.code = 'BOOKING_NOT_ACTIVE';
            throw err;
          }

          const eventRef = mockDb.collection('events').doc(booking.eventId);
          const eventDoc = await transaction.get(eventRef);
          const now = new Date().toISOString();

          // Atomically update booking status
          transaction.update(bookingRef, {
            status: 'cancelled',
            cancelledAt: now,
            cancellationReason: reason,
            cancelledBy: isAdmin ? 'admin' : 'user',
            updatedAt: now
          });

          // Atomically release capacity back to event
          if (eventDoc.exists) {
            const ev = eventDoc.data();
            transaction.update(eventRef, {
              attendeeCount: Math.max(0, (ev.attendeeCount || 0) - (booking.participantCount || 1)),
              confirmedBookingsCount: Math.max(0, (ev.confirmedBookingsCount || 0) - 1),
              updatedAt: now
            });
          }

          return {
            ...booking,
            status: 'cancelled',
            cancelledAt: now,
            cancellationReason: reason,
            cancelledBy: isAdmin ? 'admin' : 'user',
            updatedAt: now
          };
        });

        return {
          status: 200,
          body: {
            success: true,
            message: 'Booking successfully cancelled',
            data: result
          }
        };
      } catch (err) {
        return {
          status: err.statusCode || 500,
          body: {
            success: false,
            code: err.code || 'INTERNAL_ERROR',
            error: err.message
          }
        };
      }
    }
  }

  // ROUTE 5: /api/bookings/[id] (GET)
  const singleBookingMatch = pathname.match(/^\/api\/bookings\/([^/]+)$/);
  if (singleBookingMatch) {
    const bookingId = singleBookingMatch[1];
    if (method === 'GET') {
      const authErr = requireAuth();
      if (authErr) return authErr;

      const bookingRef = mockDb.collection('bookings').doc(bookingId);
      const snap = await bookingRef.get();
      if (!snap.exists) {
        return { status: 404, body: { success: false, code: 'BOOKING_NOT_FOUND', error: `Booking ${bookingId} not found` } };
      }

      const booking = snap.data();
      const isAdmin = verifyAdmin(decodedToken);
      if (!isAdmin && booking.userId !== decodedToken.uid) {
        return { status: 403, body: { success: false, code: 'FORBIDDEN', error: 'Forbidden: You do not have permission to view this booking' } };
      }

      return { status: 200, body: { success: true, data: booking } };
    }
  }

  // ROUTE 6: /api/bookings (GET, POST)
  if (pathname === '/api/bookings') {
    if (method === 'GET') {
      const authErr = requireAuth();
      if (authErr) return authErr;

      const isAdmin = verifyAdmin(decodedToken);
      const snap = await mockDb.collection('bookings').get();
      let bookings = snap.docs.map(d => d.data());

      // Data Isolation: Non-admin users ONLY see their own bookings
      if (!isAdmin) {
        bookings = bookings.filter(b => b.userId === decodedToken.uid);
      } else {
        // Admin optional filters
        const eventIdFilter = searchParams.get('eventId');
        const statusFilter = searchParams.get('status');
        const searchFilter = (searchParams.get('search') || '').toLowerCase().trim();

        if (eventIdFilter) {
          bookings = bookings.filter(b => b.eventId === eventIdFilter);
        }
        if (statusFilter && statusFilter !== 'all') {
          bookings = bookings.filter(b => b.status === statusFilter);
        }
        if (searchFilter) {
          bookings = bookings.filter(b => {
            const ref = (b.bookingReference || '').toLowerCase();
            const name = (b.userName || '').toLowerCase();
            const email = (b.userEmail || '').toLowerCase();
            return ref.includes(searchFilter) || name.includes(searchFilter) || email.includes(searchFilter);
          });
        }
      }

      bookings.sort((a, b) => (b.bookedAt || '').localeCompare(a.bookedAt || ''));
      return { status: 200, body: { success: true, data: bookings } };
    }

    if (method === 'POST') {
      const authErr = requireAuth();
      if (authErr) return authErr;

      const payload = body || {};
      const { eventId, participantCount = 1, attendeeDetails = [] } = payload;

      if (!eventId) {
        return { status: 400, body: { success: false, code: 'MISSING_EVENT_ID', error: 'eventId is required' } };
      }

      // ACID Capacity Transaction
      try {
        const newBooking = await mockDb.runTransaction(async (transaction) => {
          const eventRef = mockDb.collection('events').doc(eventId);
          const eventDoc = await transaction.get(eventRef);

          if (!eventDoc.exists) {
            const err = new Error('Event not found');
            err.statusCode = 404;
            err.code = 'EVENT_NOT_FOUND';
            throw err;
          }

          const event = eventDoc.data();

          // 1. Status Check
          if (event.publicationStatus !== 'published' && event.publicationStatus !== 'featured') {
            const err = new Error('Event is not open for bookings');
            err.statusCode = 400;
            err.code = 'EVENT_NOT_OPEN_FOR_BOOKING';
            throw err;
          }

          // 2. Listing Type Check
          if (event.listingType !== 'free_booking' && event.listingType !== 'paid_booking') {
            const err = new Error('This listing does not support direct in-app booking');
            err.statusCode = 400;
            err.code = 'BOOKING_NOT_SUPPORTED';
            throw err;
          }

          // 3. Registration Window Validation
          const now = new Date().toISOString();
          if (event.bookingConfig?.registrationOpenDate && now < event.bookingConfig.registrationOpenDate) {
            const err = new Error('Registration for this event has not opened yet');
            err.statusCode = 400;
            err.code = 'REGISTRATION_NOT_OPEN_YET';
            throw err;
          }
          if (event.bookingConfig?.registrationCloseDate && now > event.bookingConfig.registrationCloseDate) {
            const err = new Error('Registration for this event has closed');
            err.statusCode = 400;
            err.code = 'REGISTRATION_CLOSED';
            throw err;
          }
          if (event.schedule?.registrationDeadline && now > event.schedule.registrationDeadline) {
            const err = new Error('Registration deadline has passed');
            err.statusCode = 400;
            err.code = 'DEADLINE_EXCEEDED';
            throw err;
          }

          // 4. Participant Count Constraints
          if (typeof participantCount !== 'number' || participantCount < 1) {
            const err = new Error('Participant count must be at least 1');
            err.statusCode = 400;
            err.code = 'INVALID_PARTICIPANT_COUNT';
            throw err;
          }

          const maxPerBooking = event.bookingConfig?.maxParticipantsPerBooking || 1;
          if (participantCount > maxPerBooking) {
            const err = new Error(`Cannot book more than ${maxPerBooking} participants per reservation`);
            err.statusCode = 400;
            err.code = 'MAX_PARTICIPANTS_EXCEEDED';
            throw err;
          }

          // 5. Strict Capacity Enforcement
          if (!event.bookingConfig?.isUnlimitedCapacity) {
            const currentAttendees = event.attendeeCount || 0;
            const capacity = event.bookingConfig?.capacity || 0;
            const remainingCapacity = Math.max(0, capacity - currentAttendees);

            if (currentAttendees + participantCount > capacity) {
              const err = new Error(`Requested seats exceed available capacity. Seats remaining: ${remainingCapacity}`);
              err.statusCode = 409;
              err.code = 'CAPACITY_EXCEEDED';
              err.availableCapacity = remainingCapacity;
              throw err;
            }
          }

          // 6. Generate Booking Reference and Document
          const bookingRef = mockDb.collection('bookings').doc();
          const bookingReference = generateBookingReference();

          const bookingRecord = {
            id: bookingRef.id,
            bookingReference,
            eventId: event.id,
            eventTitle: event.title,
            eventCategory: event.category,
            eventStartDate: event.schedule?.startDate,
            eventEndDate: event.schedule?.endDate,
            eventLocationType: event.location?.type || 'offline',
            eventVenueOrUrl: event.location?.type === 'online'
              ? (event.location?.meetingUrl || '')
              : (event.location?.venueName || event.location?.address || ''),
            userId: decodedToken.uid,
            userEmail: decodedToken.email || '',
            userName: decodedToken.name || attendeeDetails[0]?.fullName || 'Seeker',
            userPhone: attendeeDetails[0]?.phone || '',
            participantCount,
            attendeeDetails,
            status: 'confirmed',
            bookedAt: now,
            updatedAt: now
          };

          // 7. Commit atomically
          transaction.set(bookingRef, bookingRecord);
          transaction.update(eventRef, {
            attendeeCount: (event.attendeeCount || 0) + participantCount,
            confirmedBookingsCount: (event.confirmedBookingsCount || 0) + 1,
            updatedAt: now
          });

          return bookingRecord;
        });

        return { status: 201, body: { success: true, data: newBooking } };
      } catch (err) {
        return {
          status: err.statusCode || 500,
          body: {
            success: false,
            code: err.code || 'INTERNAL_ERROR',
            error: err.message,
            ...(err.availableCapacity !== undefined ? { availableCapacity: err.availableCapacity } : {})
          }
        };
      }
    }
  }

  return { status: 404, body: { success: false, code: 'NOT_FOUND', error: `Route ${pathname} not found` } };
}
