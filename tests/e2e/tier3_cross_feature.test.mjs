/**
 * Tier 3 - Cross-Feature Combinations Test Suite
 * Pairwise interactions, multi-service state propagation, push notification idempotency,
 * capacity restoration loops, and compound permission rules.
 */

import { ApiClient, createValidEventPayload, assertEquals, assert, setupTestEnvironment } from './infra/apiClient.mjs';
import { mockMessaging } from './infra/mockFirebase.mjs';

export async function runTier3Tests(reporter) {
  reporter.suite('Tier 3: Cross-Feature Combinations (10 Interaction Tests)');

  // -------------------------------------------------------------
  // COMBINATION 1: Free vs Paid Publishing Under Same Admin
  // -------------------------------------------------------------
  await reporter.test('C1: Free booking event publishes freely while paid event requires live provider', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();

    // 1. Free event
    const freeRes = await admin.post('/api/events', createValidEventPayload({
      title: 'Community Kirtan (Free)',
      listingType: 'free_booking'
    }));
    const freeId = freeRes.body.data.id;
    const pubFree = await admin.post(`/api/events/${freeId}/publish`, { action: 'publish' });
    assertEquals(pubFree.status, 200);
    assertEquals(pubFree.body.data.publicationStatus, 'published');

    // 2. Paid event with unconfigured provider
    const paidRes = await admin.post('/api/events', createValidEventPayload({
      title: 'Intensive Immersion (Paid)',
      listingType: 'paid_booking',
      paymentConfig: {
        enabled: true,
        currency: 'INR',
        amount: 2500,
        provider: 'none',
        providerStatus: 'unconfigured'
      }
    }));
    const paidId = paidRes.body.data.id;
    const pubPaid = await admin.post(`/api/events/${paidId}/publish`, { action: 'publish' });
    assertEquals(pubPaid.status, 400);
    assertEquals(pubPaid.body.code, 'PAYMENT_PROVIDER_UNCONFIGURED');
  });

  // -------------------------------------------------------------
  // COMBINATION 2: Full Booking -> Capacity Saturation -> Cancel -> Re-book Cycle
  // -------------------------------------------------------------
  await reporter.test('C2: Full capacity saturation, cancellation, and re-booking cycle', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();
    const user2 = ApiClient.asUser2();

    // Create 1-seat capacity event
    const evRes = await admin.post('/api/events', createValidEventPayload({
      title: 'Solo Meditation Capsule',
      bookingConfig: { capacity: 1, isUnlimitedCapacity: false, maxParticipantsPerBooking: 1 }
    }));
    const eventId = evRes.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    // Step 1: User 1 books the 1 seat
    const b1 = await user1.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(b1.status, 201);
    const booking1Id = b1.body.data.id;

    // Step 2: User 2 attempts to book and is rejected
    const b2Rejected = await user2.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(b2Rejected.status, 409);
    assertEquals(b2Rejected.body.availableCapacity, 0);

    // Step 3: User 1 cancels the booking
    const cancelRes = await user1.post(`/api/bookings/${booking1Id}/cancel`, { reason: 'No longer available' });
    assertEquals(cancelRes.status, 200);

    // Step 4: User 2 retries and now successfully books!
    const b2Success = await user2.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(b2Success.status, 201);
    assertEquals(b2Success.body.data.userId, 'usr_seeker_102');

    // Step 5: Check event metrics
    const evFinal = await admin.get(`/api/events/${eventId}`);
    assertEquals(evFinal.body.data.attendeeCount, 1);
    assertEquals(evFinal.body.data.confirmedBookingsCount, 1);
  });

  // -------------------------------------------------------------
  // COMBINATION 3: Idempotent FCM Notification Broadcast
  // -------------------------------------------------------------
  await reporter.test('C3: FCM notification broadcast sent once on initial publish and never duplicated on subsequent publish/feature', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();

    const evRes = await admin.post('/api/events', createValidEventPayload({
      title: 'Sacred Sound Awakening',
      notifyOnPublish: true
    }));
    const eventId = evRes.body.data.id;

    // First publish: Should dispatch FCM
    const pub1 = await admin.post(`/api/events/${eventId}/publish`, { action: 'publish', notifyOnPublish: true });
    assertEquals(pub1.status, 200);
    assertEquals(pub1.body.notificationDispatched, true);

    const messages = mockMessaging.sentMessages;
    assertEquals(messages.length, 1, 'Exactly one FCM broadcast dispatched');
    assertEquals(messages[0].message.topic, 'all_users');
    assertEquals(messages[0].message.data.deepLink, `nirvaha://events/${eventId}`);

    // Second publish / feature action: Should NOT dispatch duplicate FCM
    const featRes = await admin.post(`/api/events/${eventId}/publish`, { action: 'feature', notifyOnPublish: true });
    assertEquals(featRes.status, 200);
    assertEquals(featRes.body.notificationDispatched, false);
    assertEquals(mockMessaging.sentMessages.length, 1, 'Still exactly one FCM message, duplicate suppressed');
  });

  // -------------------------------------------------------------
  // COMBINATION 4: Compound Multi-Parameter Query Filtering
  // -------------------------------------------------------------
  await reporter.test('C4: Multi-parameter compound filtering (category + listingType + timeframe + status)', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();

    // Create 3 events with different combos
    const now = Date.now();
    const e1 = await admin.post('/api/events', createValidEventPayload({
      title: 'Upcoming Yoga Workshop',
      category: 'yoga',
      listingType: 'free_booking',
      schedule: { startDate: new Date(now + 86400000).toISOString(), endDate: new Date(now + 90000000).toISOString() }
    }));
    const e2 = await admin.post('/api/events', createValidEventPayload({
      title: 'Upcoming Sound Bath',
      category: 'sound_healing',
      listingType: 'free_booking',
      schedule: { startDate: new Date(now + 86400000).toISOString(), endDate: new Date(now + 90000000).toISOString() }
    }));
    const e3 = await admin.post('/api/events', createValidEventPayload({
      title: 'Past Yoga Gathering',
      category: 'yoga',
      listingType: 'free_booking',
      schedule: { startDate: new Date(now - 90000000).toISOString(), endDate: new Date(now - 86400000).toISOString() }
    }));

    await admin.post(`/api/events/${e1.body.data.id}/publish`, { action: 'publish' });
    await admin.post(`/api/events/${e2.body.data.id}/publish`, { action: 'publish' });
    await admin.post(`/api/events/${e3.body.data.id}/publish`, { action: 'publish' });

    // Query with compound filters: category=yoga & timeframe=upcoming
    const anon = ApiClient.anonymous();
    const res = await anon.get('/api/events?category=yoga&timeframe=upcoming');
    assertEquals(res.status, 200);
    assertEquals(res.body.data.length, 1);
    assertEquals(res.body.data[0].title, 'Upcoming Yoga Workshop');
  });

  // -------------------------------------------------------------
  // COMBINATION 5: Unpublish Locks Bookings while Retaining Existing Reservations
  // -------------------------------------------------------------
  await reporter.test('C5: Unpublish event locks new bookings but preserves existing bookings and cancellation rights', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();
    const user2 = ApiClient.asUser2();

    const evRes = await admin.post('/api/events', createValidEventPayload({
      bookingConfig: { capacity: 10, isUnlimitedCapacity: false, maxParticipantsPerBooking: 2 }
    }));
    const eventId = evRes.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    // User 1 books
    const b1 = await user1.post('/api/bookings', { eventId, participantCount: 1 });
    const bookingId = b1.body.data.id;
    assertEquals(b1.status, 201);

    // Admin unpublishes the event back to draft
    const unpub = await admin.post(`/api/events/${eventId}/publish`, { action: 'unpublish' });
    assertEquals(unpub.body.data.publicationStatus, 'draft');

    // User 2 attempts to book: must be BLOCKED
    const b2 = await user2.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(b2.status, 400);
    assertEquals(b2.body.code, 'EVENT_NOT_OPEN_FOR_BOOKING');

    // User 1 can still access and cancel their reservation
    const getB1 = await user1.get(`/api/bookings/${bookingId}`);
    assertEquals(getB1.status, 200);
    assertEquals(getB1.body.data.status, 'confirmed');

    const cancelB1 = await user1.post(`/api/bookings/${bookingId}/cancel`);
    assertEquals(cancelB1.status, 200);
    assertEquals(cancelB1.body.data.status, 'cancelled');
  });

  // -------------------------------------------------------------
  // COMBINATION 6: Email Whitelist Authorization
  // -------------------------------------------------------------
  await reporter.test('C6: Whitelisted administrator email passes admin authorization without custom claims', async () => {
    setupTestEnvironment();
    const adminWhitelist = ApiClient.asAdminWhitelist();

    const payload = createValidEventPayload({ title: 'Whitelisted Admin Workshop' });
    const res = await adminWhitelist.post('/api/events', payload);
    assertEquals(res.status, 201);
    assertEquals(res.body.data.title, 'Whitelisted Admin Workshop');
  });

  // -------------------------------------------------------------
  // COMBINATION 7: Multi-Tenant Booking Isolation Under Cross-Inspection
  // -------------------------------------------------------------
  await reporter.test('C7: Cross-tenant booking isolation prevents inspection and cancellation between users', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();
    const user2 = ApiClient.asUser2();

    const evRes = await admin.post('/api/events', createValidEventPayload({
      bookingConfig: { capacity: 10, isUnlimitedCapacity: false, maxParticipantsPerBooking: 2 }
    }));
    const eventId = evRes.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    // User 1 creates booking
    const b1 = await user1.post('/api/bookings', { eventId, participantCount: 1 });
    const b1Id = b1.body.data.id;

    // User 2 creates booking
    const b2 = await user2.post('/api/bookings', { eventId, participantCount: 1 });
    const b2Id = b2.body.data.id;

    // User 1 queries own bookings -> sees only b1
    const u1List = await user1.get('/api/bookings');
    assertEquals(u1List.body.data.length, 1);
    assertEquals(u1List.body.data[0].id, b1Id);

    // User 2 queries own bookings -> sees only b2
    const u2List = await user2.get('/api/bookings');
    assertEquals(u2List.body.data.length, 1);
    assertEquals(u2List.body.data[0].id, b2Id);

    // User 1 attempts to cancel User 2's booking -> 403 Forbidden
    const hackCancel = await user1.post(`/api/bookings/${b2Id}/cancel`);
    assertEquals(hackCancel.status, 403);

    // User 2's booking remains intact
    const b2Check = await user2.get(`/api/bookings/${b2Id}`);
    assertEquals(b2Check.body.data.status, 'confirmed');
  });

  // -------------------------------------------------------------
  // COMBINATION 8: Event Archival and Public Visibility
  // -------------------------------------------------------------
  await reporter.test('C8: Event archival hides event from public browse while preserving booking history', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const evRes = await admin.post('/api/events', createValidEventPayload());
    const eventId = evRes.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const b = await user1.post('/api/bookings', { eventId, participantCount: 1 });
    const bookingId = b.body.data.id;

    // Archive event
    const archRes = await admin.post(`/api/events/${eventId}/publish`, { action: 'archive' });
    assertEquals(archRes.body.data.publicationStatus, 'archived');

    // Public listing query returns 0
    const anon = ApiClient.anonymous();
    const publicList = await anon.get('/api/events');
    assertEquals(publicList.body.data.length, 0);

    // User 1 still sees booking in their profile
    const userBookings = await user1.get('/api/bookings');
    assertEquals(userBookings.body.data.length, 1);
    assertEquals(userBookings.body.data[0].id, bookingId);
  });

  // -------------------------------------------------------------
  // COMBINATION 9: Capacity Scaling & Invariant Integrity
  // -------------------------------------------------------------
  await reporter.test('C9: Increasing event capacity via PUT expands available seats while retaining attendee count', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();
    const user2 = ApiClient.asUser2();

    const evRes = await admin.post('/api/events', createValidEventPayload({
      bookingConfig: { capacity: 1, isUnlimitedCapacity: false, maxParticipantsPerBooking: 2 }
    }));
    const eventId = evRes.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    // User 1 fills the only seat
    await user1.post('/api/bookings', { eventId, participantCount: 1 });

    // User 2 cannot book
    const r2Fail = await user2.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(r2Fail.status, 409);

    // Admin expands capacity to 5
    await admin.put(`/api/events/${eventId}`, {
      bookingConfig: { capacity: 5, isUnlimitedCapacity: false, maxParticipantsPerBooking: 2 }
    });

    // Now User 2 can book!
    const r2Success = await user2.post('/api/bookings', { eventId, participantCount: 2 });
    assertEquals(r2Success.status, 201);

    // Final attendee count: 1 + 2 = 3
    const finalEv = await admin.get(`/api/events/${eventId}`);
    assertEquals(finalEv.body.data.attendeeCount, 3);
  });

  // -------------------------------------------------------------
  // COMBINATION 10: Online Event URL Resolution in Confirmation
  // -------------------------------------------------------------
  await reporter.test('C10: Online event creates booking with denormalized meeting link for seamless attendee access', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user = ApiClient.asUser1();

    const meetingUrl = 'https://zoom.us/j/999888777';
    const evRes = await admin.post('/api/events', createValidEventPayload({
      location: {
        type: 'online',
        meetingUrl,
        accessInstructions: 'Passcode sent upon confirmation.'
      }
    }));
    const eventId = evRes.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const bRes = await user.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(bRes.status, 201);
    assertEquals(bRes.body.data.eventLocationType, 'online');
    assertEquals(bRes.body.data.eventVenueOrUrl, meetingUrl);
  });
}
