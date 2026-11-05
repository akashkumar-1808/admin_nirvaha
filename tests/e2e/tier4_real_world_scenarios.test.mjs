/**
 * Tier 4 - Real-World Application Scenarios Test Suite
 * End-to-end multi-step flows simulating real-world usage:
 * 1. Free Community Workshop Full Lifecycle (Draft -> Publish -> Multi-booking -> Cancel -> Archive)
 * 2. Multi-Attendee Spiritual Retreat with Strict Privacy & Custom Attendee Details
 * 3. Strict Payment Guard Lockdown & Paid Experience Onboarding
 * 4. High-Demand Concert Capacity Saturation & Registration Contention
 * 5. Emergency Event Cancellation & Admin Console Workflow
 */

import { ApiClient, createValidEventPayload, assertEquals, assert, setupTestEnvironment } from './infra/apiClient.mjs';
import { mockMessaging } from './infra/mockFirebase.mjs';

export async function runTier4Tests(reporter) {
  reporter.suite('Tier 4: Real-World Application Scenarios (5 Comprehensive E2E Flows)');

  // -------------------------------------------------------------
  // SCENARIO 1: Free Community Workshop Full Lifecycle
  // -------------------------------------------------------------
  await reporter.test('S1: Free Community Meditation Workshop Full Lifecycle Flow', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();
    const user2 = ApiClient.asUser2();

    // Step 1: Admin drafts a 20-seat weekend workshop
    reporter.log('  [S1.1] Admin creates draft workshop (capacity: 20, maxPerBooking: 2)');
    const createRes = await admin.post('/api/events', createValidEventPayload({
      title: 'Weekend Mindfulness & Vipassana Retreat',
      category: 'meditation',
      listingType: 'free_booking',
      bookingConfig: { capacity: 20, isUnlimitedCapacity: false, maxParticipantsPerBooking: 2 },
      notifyOnPublish: true
    }));
    assertEquals(createRes.status, 201);
    const eventId = createRes.body.data.id;
    assertEquals(createRes.body.data.publicationStatus, 'draft');

    // Step 2: Admin publishes event with push notification
    reporter.log('  [S1.2] Admin publishes listing and broadcasts FCM notification');
    const pubRes = await admin.post(`/api/events/${eventId}/publish`, { action: 'publish', notifyOnPublish: true });
    assertEquals(pubRes.status, 200);
    assertEquals(pubRes.body.data.publicationStatus, 'published');
    assertEquals(mockMessaging.sentMessages.length, 1);
    assertEquals(mockMessaging.sentMessages[0].message.data.deepLink, `nirvaha://events/${eventId}`);

    // Step 3: User 1 receives deep link notification and reserves 2 seats
    reporter.log('  [S1.3] User 1 books 2 seats with attendee details');
    const book1Res = await user1.post('/api/bookings', {
      eventId,
      participantCount: 2,
      attendeeDetails: [
        { fullName: 'Priya Sharma', email: 'priya@example.com', phone: '+919876543210' },
        { fullName: 'Ananya Sharma', email: 'ananya@example.com', phone: '+919876543211' }
      ]
    });
    assertEquals(book1Res.status, 201);
    const booking1Id = book1Res.body.data.id;
    assert(book1Res.body.data.bookingReference.startsWith('NIR-EVT-'));

    // Step 4: User 2 reserves 1 seat
    reporter.log('  [S1.4] User 2 books 1 seat');
    const book2Res = await user2.post('/api/bookings', {
      eventId,
      participantCount: 1,
      attendeeDetails: [{ fullName: 'Aarav Patel', email: 'aarav@example.com' }]
    });
    assertEquals(book2Res.status, 201);

    // Step 5: Verify capacity counts: 2 + 1 = 3 attendees
    reporter.log('  [S1.5] Verify event metrics: attendeeCount === 3, confirmedBookings === 2');
    const evMid = await admin.get(`/api/events/${eventId}`);
    assertEquals(evMid.body.data.attendeeCount, 3);
    assertEquals(evMid.body.data.confirmedBookingsCount, 2);

    // Step 6: User 1 has emergency and cancels booking
    reporter.log('  [S1.6] User 1 cancels 2-seat reservation with reason');
    const cancelRes = await user1.post(`/api/bookings/${booking1Id}/cancel`, { reason: 'Family illness' });
    assertEquals(cancelRes.status, 200);
    assertEquals(cancelRes.body.data.status, 'cancelled');

    // Verify capacity restored: 3 - 2 = 1 attendee remaining
    const evAfterCancel = await admin.get(`/api/events/${eventId}`);
    assertEquals(evAfterCancel.body.data.attendeeCount, 1);
    assertEquals(evAfterCancel.body.data.confirmedBookingsCount, 1);

    // Step 7: Workshop concludes -> Admin archives event
    reporter.log('  [S1.7] Admin archives event after conclusion');
    const archRes = await admin.post(`/api/events/${eventId}/publish`, { action: 'archive' });
    assertEquals(archRes.status, 200);
    assertEquals(archRes.body.data.publicationStatus, 'archived');

    // Public list should not show archived event
    const anon = ApiClient.anonymous();
    const publicList = await anon.get('/api/events');
    assert(!publicList.body.data.some(e => e.id === eventId));
  });

  // -------------------------------------------------------------
  // SCENARIO 2: Multi-Attendee Retreat with Strict Privacy
  // -------------------------------------------------------------
  await reporter.test('S2: Spiritual Retreat Multi-Attendee Flow with Strict Data Isolation', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1(); // Aarav
    const user2 = ApiClient.asUser2(); // Priya

    // Step 1: Admin creates retreat with capacity 10, max 3/booking
    reporter.log('  [S2.1] Admin creates 3-day Himalayan retreat');
    const evRes = await admin.post('/api/events', createValidEventPayload({
      title: 'Himalayan Silent Wisdom Retreat',
      category: 'retreat',
      bookingConfig: {
        capacity: 10,
        isUnlimitedCapacity: false,
        maxParticipantsPerBooking: 3,
        requiredAttendeeFields: ['name', 'email', 'dietary', 'emergency_contact']
      }
    }));
    const eventId = evRes.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    // Step 2: User 1 reserves 3 seats with detailed dietary and contact notes
    reporter.log('  [S2.2] User 1 books 3 seats with custom dietary preferences');
    const b1 = await user1.post('/api/bookings', {
      eventId,
      participantCount: 3,
      attendeeDetails: [
        { fullName: 'Aarav Patel', email: 'aarav@example.com', dietary: 'Strict Sattvic', emergencyContact: '+919111111111' },
        { fullName: 'Meera Patel', email: 'meera@example.com', dietary: 'Gluten-Free', emergencyContact: '+919111111111' },
        { fullName: 'Dev Patel', email: 'dev@example.com', dietary: 'Vegan', emergencyContact: '+919111111111' }
      ]
    });
    assertEquals(b1.status, 201);
    const b1Id = b1.body.data.id;

    // Step 3: User 2 opens app and queries bookings -> User 1 booking must NOT appear
    reporter.log('  [S2.3] User 2 queries personal bookings: receives empty list (isolated)');
    const u2List = await user2.get('/api/bookings');
    assertEquals(u2List.body.data.length, 0);

    // Step 4: User 2 attempts direct access to User 1 booking -> 403 Forbidden
    reporter.log('  [S2.4] User 2 attempts unauthorized access to User 1 booking: rejected 403');
    const hackAttempt = await user2.get(`/api/bookings/${b1Id}`);
    assertEquals(hackAttempt.status, 403);

    // Step 5: Admin accesses booking console -> sees full multi-attendee record
    reporter.log('  [S2.5] Admin queries booking details: sees complete attendee info and dietary notes');
    const adminView = await admin.get(`/api/bookings/${b1Id}`);
    assertEquals(adminView.status, 200);
    assertEquals(adminView.body.data.attendeeDetails.length, 3);
    assertEquals(adminView.body.data.attendeeDetails[0].dietary, 'Strict Sattvic');
  });

  // -------------------------------------------------------------
  // SCENARIO 3: Strict Payment Guard Lockdown & Paid Experience Onboarding
  // -------------------------------------------------------------
  await reporter.test('S3: Strict Payment Guard Lockdown & Paid Experience Onboarding Flow', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();

    // Step 1: Admin creates paid immersion with unconfigured provider
    reporter.log('  [S3.1] Admin drafts paid event ($50 / INR 4000) with providerStatus = unconfigured');
    const createRes = await admin.post('/api/events', createValidEventPayload({
      title: 'Advanced Sound Immersion Masterclass',
      category: 'sound_healing',
      listingType: 'paid_booking',
      paymentConfig: {
        enabled: true,
        currency: 'INR',
        amount: 4000,
        provider: 'none',
        providerStatus: 'unconfigured'
      }
    }));
    assertEquals(createRes.status, 201);
    const eventId = createRes.body.data.id;

    // Step 2: Admin attempts to publish -> Strictly blocked
    reporter.log('  [S3.2] Admin attempts publish: blocked with 400 PAYMENT_PROVIDER_UNCONFIGURED');
    const pubBlocked = await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });
    assertEquals(pubBlocked.status, 400);
    assertEquals(pubBlocked.body.code, 'PAYMENT_PROVIDER_UNCONFIGURED');

    // Step 3: Admin attempts to feature -> Also strictly blocked
    reporter.log('  [S3.3] Admin attempts feature: also blocked with 400 PAYMENT_PROVIDER_UNCONFIGURED');
    const featBlocked = await admin.post(`/api/events/${eventId}/publish`, { action: 'feature' });
    assertEquals(featBlocked.status, 400);
    assertEquals(featBlocked.body.code, 'PAYMENT_PROVIDER_UNCONFIGURED');

    // Step 4: Admin configures approved payment provider (Razorpay Live)
    reporter.log('  [S3.4] Admin updates payment provider configuration to live Razorpay gateway');
    const updateRes = await admin.put(`/api/events/${eventId}`, {
      paymentConfig: {
        enabled: true,
        currency: 'INR',
        amount: 4000,
        provider: 'razorpay',
        providerStatus: 'live'
      }
    });
    assertEquals(updateRes.status, 200);

    // Step 5: Admin re-attempts publication -> Succeeded!
    reporter.log('  [S3.5] Admin publishes now-configured paid event: succeeds with 200 OK');
    const pubSuccess = await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });
    assertEquals(pubSuccess.status, 200);
    assertEquals(pubSuccess.body.data.publicationStatus, 'published');
  });

  // -------------------------------------------------------------
  // SCENARIO 4: High-Demand Concert Capacity Saturation & Contention
  // -------------------------------------------------------------
  await reporter.test('S4: High-Demand Temple Concert Capacity Saturation & Contention Flow', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();
    const user2 = ApiClient.asUser2();
    const user3 = ApiClient.withToken('usr_seeker_103:kavita@example.com:user');

    // Step 1: Admin creates exclusive 3-seat temple concert
    reporter.log('  [S4.1] Admin creates intimate 3-seat Sitar Concert');
    const evRes = await admin.post('/api/events', createValidEventPayload({
      title: 'Sacred Sitar & Tabla Sunset Concert',
      bookingConfig: { capacity: 3, isUnlimitedCapacity: false, maxParticipantsPerBooking: 2 }
    }));
    const eventId = evRes.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    // Step 2: User 1 books 2 seats
    reporter.log('  [S4.2] User 1 books 2 seats -> remaining capacity is 1');
    const b1 = await user1.post('/api/bookings', { eventId, participantCount: 2 });
    assertEquals(b1.status, 201);
    const b1Id = b1.body.data.id;

    // Step 3: User 2 attempts to book 2 seats -> rejected because only 1 remains
    reporter.log('  [S4.3] User 2 attempts to book 2 seats: rejected 409 (availableCapacity: 1)');
    const b2Fail = await user2.post('/api/bookings', { eventId, participantCount: 2 });
    assertEquals(b2Fail.status, 409);
    assertEquals(b2Fail.body.code, 'CAPACITY_EXCEEDED');
    assertEquals(b2Fail.body.availableCapacity, 1);

    // Step 4: User 2 adjusts request to 1 seat -> succeeds!
    reporter.log('  [S4.4] User 2 retries with 1 seat: succeeds! Event is now 100% full');
    const b2Success = await user2.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(b2Success.status, 201);

    // Step 5: User 3 attempts to book 1 seat -> rejected because event is full
    reporter.log('  [S4.5] User 3 attempts to book: rejected 409 (availableCapacity: 0)');
    const b3Fail = await user3.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(b3Fail.status, 409);
    assertEquals(b3Fail.body.availableCapacity, 0);

    // Step 6: User 1 cancels their 2 seats
    reporter.log('  [S4.6] User 1 cancels 2 seats -> releasing 2 seats');
    const cancelRes = await user1.post(`/api/bookings/${b1Id}/cancel`);
    assertEquals(cancelRes.status, 200);

    // Step 7: User 3 retries booking 1 seat -> now succeeds!
    reporter.log('  [S4.7] User 3 retries booking 1 seat: succeeds with newly released capacity');
    const b3Success = await user3.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(b3Success.status, 201);

    // Final attendee count: 1 (User 2) + 1 (User 3) = 2
    const finalEv = await admin.get(`/api/events/${eventId}`);
    assertEquals(finalEv.body.data.attendeeCount, 2);
  });

  // -------------------------------------------------------------
  // SCENARIO 5: Emergency Cancellation & Administrative Console Workflow
  // -------------------------------------------------------------
  await reporter.test('S5: Emergency Event Cancellation & Admin Console Workflow', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();
    const user2 = ApiClient.asUser2();

    // Step 1: Admin publishes outdoor event
    reporter.log('  [S5.1] Admin publishes Outdoor Forest Bathing experience');
    const evRes = await admin.post('/api/events', createValidEventPayload({
      title: 'Forest Bathing & Ancient Trees Walk',
      category: 'workshop'
    }));
    const eventId = evRes.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    // Step 2: Users book seats
    reporter.log('  [S5.2] User 1 and User 2 reserve seats');
    const b1 = await user1.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(b1.status, 201);
    const b1Id = b1.body.data.id;

    // Step 3: Bad weather alert -> Admin sets event status to cancelled
    reporter.log('  [S5.3] Admin issues emergency cancellation via /publish');
    const cancelEvRes = await admin.post(`/api/events/${eventId}/publish`, { action: 'cancel' });
    assertEquals(cancelEvRes.status, 200);
    assertEquals(cancelEvRes.body.data.publicationStatus, 'cancelled');

    // Step 4: New user attempts to book the cancelled event -> blocked with 400
    reporter.log('  [S5.4] New user booking on cancelled event is blocked');
    const newBookRes = await user2.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(newBookRes.status, 400);
    assertEquals(newBookRes.body.code, 'EVENT_NOT_OPEN_FOR_BOOKING');

    // Step 5: Existing user can still view their reservation with notice
    reporter.log('  [S5.5] Existing attendee can view reservation');
    const getRes = await user1.get(`/api/bookings/${b1Id}`);
    assertEquals(getRes.status, 200);

    // Step 6: Admin cannot hard delete event with active bookings
    reporter.log('  [S5.6] Hard delete is rejected because active booking records exist');
    const delRes = await admin.delete(`/api/events/${eventId}`);
    assertEquals(delRes.status, 409);
    assertEquals(delRes.body.code, 'EVENT_HAS_ACTIVE_BOOKINGS');

    // Step 7: Admin archives event cleanly instead
    reporter.log('  [S5.7] Admin safely transitions event to archived');
    const archRes = await admin.post(`/api/events/${eventId}/publish`, { action: 'archive' });
    assertEquals(archRes.status, 200);
    assertEquals(archRes.body.data.publicationStatus, 'archived');
  });
}
