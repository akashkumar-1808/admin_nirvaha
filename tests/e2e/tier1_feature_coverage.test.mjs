/**
 * Tier 1 - Feature Coverage Test Suite
 * Minimum 5 rigorous test cases per core feature across all 10 core features:
 * 1. Event Creation
 * 2. Event Listing & Filtering
 * 3. Event Retrieval & Updates
 * 4. Publication Transitions
 * 5. Booking Creation
 * 6. Booking Cancellation
 * 7. Admin Authorization Rejection
 * 8. Non-Admin Data Isolation
 * 9. Capacity Bounds & Overbooking Prevention
 * 10. Payment Blocking Safeguard
 */

import { ApiClient, createValidEventPayload, assertEquals, assert, setupTestEnvironment } from './infra/apiClient.mjs';
import { mockDb, mockMessaging } from './infra/mockFirebase.mjs';

export async function runTier1Tests(reporter) {
  reporter.suite('Tier 1: Feature Coverage (50 Test Cases across 10 Core Features)');

  // -------------------------------------------------------------
  // FEATURE 1: Event Creation (POST /api/events)
  // -------------------------------------------------------------
  await reporter.test('F1.1: Admin successfully creates valid free booking event in draft status', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const payload = createValidEventPayload({ title: 'Sunrise Meditation Circle' });
    const res = await admin.post('/api/events', payload);

    assertEquals(res.status, 201, 'Expected HTTP 201 Created');
    assert(res.body.success, 'Expected success === true');
    assertEquals(res.body.data.title, 'Sunrise Meditation Circle');
    assertEquals(res.body.data.publicationStatus, 'draft');
    assertEquals(res.body.data.attendeeCount, 0);
    assertEquals(res.body.data.confirmedBookingsCount, 0);
  });

  await reporter.test('F1.2: Admin successfully creates offline event with venue details', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const payload = createValidEventPayload({
      location: {
        type: 'offline',
        venueName: 'Ganga Ghat Amphitheater',
        address: 'Tapovan, Rishikesh'
      }
    });
    const res = await admin.post('/api/events', payload);
    assertEquals(res.status, 201);
    assertEquals(res.body.data.location.type, 'offline');
    assertEquals(res.body.data.location.venueName, 'Ganga Ghat Amphitheater');
  });

  await reporter.test('F1.3: Admin successfully creates online event with meeting instructions', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const payload = createValidEventPayload({
      location: {
        type: 'online',
        meetingUrl: 'https://zoom.us/j/nirvaha-sound-01',
        accessInstructions: 'Join 5 minutes before with headphones.'
      }
    });
    const res = await admin.post('/api/events', payload);
    assertEquals(res.status, 201);
    assertEquals(res.body.data.location.type, 'online');
    assertEquals(res.body.data.location.meetingUrl, 'https://zoom.us/j/nirvaha-sound-01');
  });

  await reporter.test('F1.4: Reject event creation when title is shorter than 3 characters', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const payload = createValidEventPayload({ title: 'Om' });
    const res = await admin.post('/api/events', payload);
    assertEquals(res.status, 400);
    assertEquals(res.body.code, 'INVALID_TITLE');
  });

  await reporter.test('F1.5: Reject event creation when category is not supported', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const payload = createValidEventPayload({ category: 'rock_concert' });
    const res = await admin.post('/api/events', payload);
    assertEquals(res.status, 400);
    assertEquals(res.body.code, 'INVALID_CATEGORY');
  });

  // -------------------------------------------------------------
  // FEATURE 2: Event Listing & Query Filters (GET /api/events)
  // -------------------------------------------------------------
  await reporter.test('F2.1: Anonymous user receives only published and featured listings', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const anon = ApiClient.anonymous();

    // Create 1 draft, 1 published, 1 featured
    const p1 = createValidEventPayload({ title: 'Draft Event', publicationStatus: 'draft' });
    const p2 = createValidEventPayload({ title: 'Live Event', publicationStatus: 'published' });
    const p3 = createValidEventPayload({ title: 'Hero Event', publicationStatus: 'featured' });

    await admin.post('/api/events', p1);
    const r2 = await admin.post('/api/events', p2);
    const r3 = await admin.post('/api/events', p3);
    await admin.post(`/api/events/${r2.body.data.id}/publish`, { action: 'publish' });
    await admin.post(`/api/events/${r3.body.data.id}/publish`, { action: 'feature' });

    const res = await anon.get('/api/events');
    assertEquals(res.status, 200);
    assertEquals(res.body.data.length, 2, 'Should only return 2 published/featured items');
    assert(res.body.data.every(e => e.publicationStatus === 'published' || e.publicationStatus === 'featured'));
  });

  await reporter.test('F2.2: Admin receives all events including draft when requested', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    await admin.post('/api/events', createValidEventPayload({ title: 'Draft 1' }));
    await admin.post('/api/events', createValidEventPayload({ title: 'Draft 2' }));

    const res = await admin.get('/api/events?status=all');
    assertEquals(res.status, 200);
    assertEquals(res.body.data.length, 2);
  });

  await reporter.test('F2.3: Filter events by category returns only matching category', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const r1 = await admin.post('/api/events', createValidEventPayload({ title: 'Yoga Asana', category: 'yoga' }));
    const r2 = await admin.post('/api/events', createValidEventPayload({ title: 'Sound Bath', category: 'sound_healing' }));
    await admin.post(`/api/events/${r1.body.data.id}/publish`, { action: 'publish' });
    await admin.post(`/api/events/${r2.body.data.id}/publish`, { action: 'publish' });

    const anon = ApiClient.anonymous();
    const res = await anon.get('/api/events?category=yoga');
    assertEquals(res.status, 200);
    assertEquals(res.body.data.length, 1);
    assertEquals(res.body.data[0].category, 'yoga');
  });

  await reporter.test('F2.4: Filter events by listingType returns only matching type', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const r1 = await admin.post('/api/events', createValidEventPayload({ title: 'Free Circle', listingType: 'free_booking' }));
    const r2 = await admin.post('/api/events', createValidEventPayload({ title: 'Notice Only', listingType: 'advertisement' }));
    await admin.post(`/api/events/${r1.body.data.id}/publish`, { action: 'publish' });
    await admin.post(`/api/events/${r2.body.data.id}/publish`, { action: 'publish' });

    const anon = ApiClient.anonymous();
    const res = await anon.get('/api/events?listingType=advertisement');
    assertEquals(res.status, 200);
    assertEquals(res.body.data.length, 1);
    assertEquals(res.body.data[0].listingType, 'advertisement');
  });

  await reporter.test('F2.5: Search by keyword matches title case-insensitively', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const r1 = await admin.post('/api/events', createValidEventPayload({ title: 'Himalayan Pranayama Retreat' }));
    await admin.post(`/api/events/${r1.body.data.id}/publish`, { action: 'publish' });

    const anon = ApiClient.anonymous();
    const res = await anon.get('/api/events?search=pranayama');
    assertEquals(res.status, 200);
    assertEquals(res.body.data.length, 1);
    assertEquals(res.body.data[0].title, 'Himalayan Pranayama Retreat');
  });

  // -------------------------------------------------------------
  // FEATURE 3: Event Retrieval & Updates (GET & PUT /api/events/[id])
  // -------------------------------------------------------------
  await reporter.test('F3.1: Admin retrieves draft event by ID successfully', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const created = await admin.post('/api/events', createValidEventPayload({ title: 'Draft Specimen' }));
    const id = created.body.data.id;

    const res = await admin.get(`/api/events/${id}`);
    assertEquals(res.status, 200);
    assertEquals(res.body.data.id, id);
    assertEquals(res.body.data.publicationStatus, 'draft');
  });

  await reporter.test('F3.2: Non-admin requesting draft event receives 404 (hidden from public)', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const created = await admin.post('/api/events', createValidEventPayload({ title: 'Secret Draft' }));
    const id = created.body.data.id;

    const anon = ApiClient.anonymous();
    const res = await anon.get(`/api/events/${id}`);
    assertEquals(res.status, 404, 'Public user should not see draft event');
  });

  await reporter.test('F3.3: Admin updates event title and description successfully', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const created = await admin.post('/api/events', createValidEventPayload({ title: 'Old Title' }));
    const id = created.body.data.id;

    const updateRes = await admin.put(`/api/events/${id}`, {
      title: 'Updated Sacred Sound Meditation',
      shortDescription: 'Updated description for community meditation.'
    });
    assertEquals(updateRes.status, 200);
    assertEquals(updateRes.body.data.title, 'Updated Sacred Sound Meditation');
  });

  await reporter.test('F3.4: Admin update does not corrupt immutable counters', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const created = await admin.post('/api/events', createValidEventPayload({ title: 'Counter Protection' }));
    const id = created.body.data.id;

    // Attempt to illegally overwrite attendeeCount via PUT
    const updateRes = await admin.put(`/api/events/${id}`, {
      title: 'Counter Protected Updated',
      attendeeCount: 999
    });
    assertEquals(updateRes.status, 200);
    assertEquals(updateRes.body.data.attendeeCount, 0, 'attendeeCount must remain 0');
  });

  await reporter.test('F3.5: Non-existent event ID returns 404 EVENT_NOT_FOUND', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const res = await admin.get('/api/events/evt_non_existent_999');
    assertEquals(res.status, 404);
    assertEquals(res.body.code, 'EVENT_NOT_FOUND');
  });

  // -------------------------------------------------------------
  // FEATURE 4: Publication Transitions & Guards (POST /api/events/[id]/publish)
  // -------------------------------------------------------------
  await reporter.test('F4.1: Transition draft -> published sets publicationStatus to published', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const created = await admin.post('/api/events', createValidEventPayload());
    const id = created.body.data.id;

    const res = await admin.post(`/api/events/${id}/publish`, { action: 'publish' });
    assertEquals(res.status, 200);
    assertEquals(res.body.data.publicationStatus, 'published');
  });

  await reporter.test('F4.2: Transition published -> unpublish returns status to draft', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const created = await admin.post('/api/events', createValidEventPayload());
    const id = created.body.data.id;
    await admin.post(`/api/events/${id}/publish`, { action: 'publish' });

    const unpubRes = await admin.post(`/api/events/${id}/publish`, { action: 'unpublish' });
    assertEquals(unpubRes.status, 200);
    assertEquals(unpubRes.body.data.publicationStatus, 'draft');
  });

  await reporter.test('F4.3: Transition published -> feature sets status to featured', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const created = await admin.post('/api/events', createValidEventPayload());
    const id = created.body.data.id;

    const featRes = await admin.post(`/api/events/${id}/publish`, { action: 'feature' });
    assertEquals(featRes.status, 200);
    assertEquals(featRes.body.data.publicationStatus, 'featured');
  });

  await reporter.test('F4.4: Transition event to cancelled sets status to cancelled', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const created = await admin.post('/api/events', createValidEventPayload());
    const id = created.body.data.id;
    await admin.post(`/api/events/${id}/publish`, { action: 'publish' });

    const cancelRes = await admin.post(`/api/events/${id}/publish`, { action: 'cancel' });
    assertEquals(cancelRes.status, 200);
    assertEquals(cancelRes.body.data.publicationStatus, 'cancelled');
  });

  await reporter.test('F4.5: Transition event to archive sets status to archived', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const created = await admin.post('/api/events', createValidEventPayload());
    const id = created.body.data.id;

    const archiveRes = await admin.post(`/api/events/${id}/publish`, { action: 'archive' });
    assertEquals(archiveRes.status, 200);
    assertEquals(archiveRes.body.data.publicationStatus, 'archived');
  });

  // -------------------------------------------------------------
  // FEATURE 5: Booking Creation & Capacity Commit (POST /api/bookings)
  // -------------------------------------------------------------
  await reporter.test('F5.1: Authenticated user creates confirmed booking with 1 seat', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const bookRes = await user1.post('/api/bookings', {
      eventId,
      participantCount: 1,
      attendeeDetails: [{ fullName: 'Priya Sharma', email: 'priya@example.com' }]
    });

    assertEquals(bookRes.status, 201);
    assertEquals(bookRes.body.data.status, 'confirmed');
    assertEquals(bookRes.body.data.participantCount, 1);
    assertEquals(bookRes.body.data.userId, 'usr_seeker_101');
  });

  await reporter.test('F5.2: Booking returns unique bookingReference with NIR-EVT prefix', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const bookRes = await user1.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(bookRes.status, 201);
    const ref = bookRes.body.data.bookingReference;
    assert(ref && ref.startsWith('NIR-EVT-'), `Reference must start with NIR-EVT-, got: ${ref}`);
  });

  await reporter.test('F5.3: Booking atomically increments event attendeeCount and confirmedBookingsCount', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    await user1.post('/api/bookings', { eventId, participantCount: 1 });

    const eventCheck = await admin.get(`/api/events/${eventId}`);
    assertEquals(eventCheck.body.data.attendeeCount, 1);
    assertEquals(eventCheck.body.data.confirmedBookingsCount, 1);
  });

  await reporter.test('F5.4: Multi-seat booking increments attendeeCount by requested seat count', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload({
      bookingConfig: { capacity: 20, isUnlimitedCapacity: false, maxParticipantsPerBooking: 3 }
    }));
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    await user1.post('/api/bookings', {
      eventId,
      participantCount: 3,
      attendeeDetails: [
        { fullName: 'Priya' },
        { fullName: 'Rahul' },
        { fullName: 'Ananya' }
      ]
    });

    const eventCheck = await admin.get(`/api/events/${eventId}`);
    assertEquals(eventCheck.body.data.attendeeCount, 3);
    assertEquals(eventCheck.body.data.confirmedBookingsCount, 1);
  });

  await reporter.test('F5.5: Booking rejected on unpublished/draft event with 400', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const eventId = created.body.data.id; // kept in draft

    const bookRes = await user1.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(bookRes.status, 400);
    assertEquals(bookRes.body.code, 'EVENT_NOT_OPEN_FOR_BOOKING');
  });

  // -------------------------------------------------------------
  // FEATURE 6: Booking Cancellation & Capacity Restoration (POST /api/bookings/[id]/cancel)
  // -------------------------------------------------------------
  await reporter.test('F6.1: Owner user successfully cancels their confirmed booking', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const bookRes = await user1.post('/api/bookings', { eventId, participantCount: 1 });
    const bookingId = bookRes.body.data.id;

    const cancelRes = await user1.post(`/api/bookings/${bookingId}/cancel`, { reason: 'Personal reason' });
    assertEquals(cancelRes.status, 200);
    assertEquals(cancelRes.body.data.status, 'cancelled');
    assertEquals(cancelRes.body.data.cancelledBy, 'user');
  });

  await reporter.test('F6.2: Cancellation records timestamp and reason correctly', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const bookRes = await user1.post('/api/bookings', { eventId, participantCount: 1 });
    const bookingId = bookRes.body.data.id;

    const cancelRes = await user1.post(`/api/bookings/${bookingId}/cancel`, { reason: 'Schedule clash' });
    assert(cancelRes.body.data.cancelledAt, 'Should have cancelledAt timestamp');
    assertEquals(cancelRes.body.data.cancellationReason, 'Schedule clash');
  });

  await reporter.test('F6.3: Cancellation atomically decrements event attendeeCount by booked participant count', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload({
      bookingConfig: { capacity: 10, isUnlimitedCapacity: false, maxParticipantsPerBooking: 2 }
    }));
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const bookRes = await user1.post('/api/bookings', { eventId, participantCount: 2 });
    const bookingId = bookRes.body.data.id;

    // Verify count is 2
    let ev = await admin.get(`/api/events/${eventId}`);
    assertEquals(ev.body.data.attendeeCount, 2);

    // Cancel
    await user1.post(`/api/bookings/${bookingId}/cancel`);

    // Verify count restored to 0
    ev = await admin.get(`/api/events/${eventId}`);
    assertEquals(ev.body.data.attendeeCount, 0);
  });

  await reporter.test('F6.4: Cancellation atomically decrements confirmedBookingsCount by 1', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const bookRes = await user1.post('/api/bookings', { eventId, participantCount: 1 });
    const bookingId = bookRes.body.data.id;

    await user1.post(`/api/bookings/${bookingId}/cancel`);

    const ev = await admin.get(`/api/events/${eventId}`);
    assertEquals(ev.body.data.confirmedBookingsCount, 0);
  });

  await reporter.test('F6.5: Admin can cancel any booking on behalf of user with cancelledBy=admin', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const bookRes = await user1.post('/api/bookings', { eventId, participantCount: 1 });
    const bookingId = bookRes.body.data.id;

    const cancelRes = await admin.post(`/api/bookings/${bookingId}/cancel`, { reason: 'Admin emergency cancel' });
    assertEquals(cancelRes.status, 200);
    assertEquals(cancelRes.body.data.cancelledBy, 'admin');
  });

  // -------------------------------------------------------------
  // FEATURE 7: Admin Authorization Rejection (401/403)
  // -------------------------------------------------------------
  await reporter.test('F7.1: Unauthenticated request to POST /api/events rejected with 401 UNAUTHORIZED', async () => {
    setupTestEnvironment();
    const anon = ApiClient.anonymous();
    const res = await anon.post('/api/events', createValidEventPayload());
    assertEquals(res.status, 401);
    assertEquals(res.body.code, 'UNAUTHORIZED');
  });

  await reporter.test('F7.2: Regular user request to POST /api/events rejected with 403 FORBIDDEN', async () => {
    setupTestEnvironment();
    const user1 = ApiClient.asUser1();
    const res = await user1.post('/api/events', createValidEventPayload());
    assertEquals(res.status, 403);
    assertEquals(res.body.code, 'FORBIDDEN');
  });

  await reporter.test('F7.3: Regular user request to PUT /api/events/[id] rejected with 403 FORBIDDEN', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const id = created.body.data.id;

    const res = await user1.put(`/api/events/${id}`, { title: 'Hacked Title' });
    assertEquals(res.status, 403);
    assertEquals(res.body.code, 'FORBIDDEN');
  });

  await reporter.test('F7.4: Regular user request to DELETE /api/events/[id] rejected with 403 FORBIDDEN', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const id = created.body.data.id;

    const res = await user1.delete(`/api/events/${id}`);
    assertEquals(res.status, 403);
    assertEquals(res.body.code, 'FORBIDDEN');
  });

  await reporter.test('F7.5: Regular user request to publish endpoint rejected with 403 FORBIDDEN', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const id = created.body.data.id;

    const res = await user1.post(`/api/events/${id}/publish`, { action: 'publish' });
    assertEquals(res.status, 403);
    assertEquals(res.body.code, 'FORBIDDEN');
  });

  // -------------------------------------------------------------
  // FEATURE 8: Non-Admin Data Isolation
  // -------------------------------------------------------------
  await reporter.test('F8.1: GET /api/bookings for regular user returns only their own bookings', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();
    const user2 = ApiClient.asUser2();

    const created = await admin.post('/api/events', createValidEventPayload({
      bookingConfig: { capacity: 10, isUnlimitedCapacity: false, maxParticipantsPerBooking: 2 }
    }));
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    // User 1 books, User 2 books
    await user1.post('/api/bookings', { eventId, participantCount: 1 });
    await user2.post('/api/bookings', { eventId, participantCount: 1 });

    const u1Bookings = await user1.get('/api/bookings');
    assertEquals(u1Bookings.status, 200);
    assertEquals(u1Bookings.body.data.length, 1);
    assertEquals(u1Bookings.body.data[0].userId, 'usr_seeker_101');
  });

  await reporter.test('F8.2: User A cannot retrieve User B booking via GET /api/bookings/[id] (403 FORBIDDEN)', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();
    const user2 = ApiClient.asUser2();

    const created = await admin.post('/api/events', createValidEventPayload());
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    // User 2 books
    const b2 = await user2.post('/api/bookings', { eventId, participantCount: 1 });
    const bookingId = b2.body.data.id;

    // User 1 tries to view User 2's booking
    const res = await user1.get(`/api/bookings/${bookingId}`);
    assertEquals(res.status, 403);
    assertEquals(res.body.code, 'FORBIDDEN');
  });

  await reporter.test('F8.3: User A cannot cancel User B booking (403 FORBIDDEN)', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();
    const user2 = ApiClient.asUser2();

    const created = await admin.post('/api/events', createValidEventPayload());
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    // User 2 books
    const b2 = await user2.post('/api/bookings', { eventId, participantCount: 1 });
    const bookingId = b2.body.data.id;

    // User 1 tries to cancel User 2's booking
    const res = await user1.post(`/api/bookings/${bookingId}/cancel`);
    assertEquals(res.status, 403);
    assertEquals(res.body.code, 'FORBIDDEN');
  });

  await reporter.test('F8.4: Admin GET /api/bookings returns bookings from all users', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();
    const user2 = ApiClient.asUser2();

    const created = await admin.post('/api/events', createValidEventPayload({
      bookingConfig: { capacity: 10, isUnlimitedCapacity: false, maxParticipantsPerBooking: 2 }
    }));
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    await user1.post('/api/bookings', { eventId, participantCount: 1 });
    await user2.post('/api/bookings', { eventId, participantCount: 1 });

    const adminBookings = await admin.get('/api/bookings');
    assertEquals(adminBookings.status, 200);
    assertEquals(adminBookings.body.data.length, 2);
  });

  await reporter.test('F8.5: Admin can view any user individual booking record via GET /api/bookings/[id]', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const b1 = await user1.post('/api/bookings', { eventId, participantCount: 1 });
    const bookingId = b1.body.data.id;

    const res = await admin.get(`/api/bookings/${bookingId}`);
    assertEquals(res.status, 200);
    assertEquals(res.body.data.id, bookingId);
    assertEquals(res.body.data.userId, 'usr_seeker_101');
  });

  // -------------------------------------------------------------
  // FEATURE 9: Capacity Bounds & Overbooking Prevention
  // -------------------------------------------------------------
  await reporter.test('F9.1: Booking requesting exact remaining capacity succeeds', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload({
      bookingConfig: { capacity: 2, isUnlimitedCapacity: false, maxParticipantsPerBooking: 2 }
    }));
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const res = await user1.post('/api/bookings', { eventId, participantCount: 2 });
    assertEquals(res.status, 201);
  });

  await reporter.test('F9.2: Booking requesting seats exceeding capacity rejected with 409 CAPACITY_EXCEEDED', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();
    const user2 = ApiClient.asUser2();

    const created = await admin.post('/api/events', createValidEventPayload({
      bookingConfig: { capacity: 1, isUnlimitedCapacity: false, maxParticipantsPerBooking: 1 }
    }));
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    // User 1 takes the 1 seat
    await user1.post('/api/bookings', { eventId, participantCount: 1 });

    // User 2 attempts to book when full
    const res = await user2.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(res.status, 409);
    assertEquals(res.body.code, 'CAPACITY_EXCEEDED');
  });

  await reporter.test('F9.3: Capacity exceeded error response includes availableCapacity number', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload({
      bookingConfig: { capacity: 3, isUnlimitedCapacity: false, maxParticipantsPerBooking: 5 }
    }));
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    // User 1 requests 4 seats when only 3 exist
    const res = await user1.post('/api/bookings', { eventId, participantCount: 4 });
    assertEquals(res.status, 409);
    assertEquals(res.body.availableCapacity, 3);
  });

  await reporter.test('F9.4: Unlimited capacity event accepts bookings beyond default thresholds', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload({
      bookingConfig: { capacity: 0, isUnlimitedCapacity: true, maxParticipantsPerBooking: 5 }
    }));
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const res = await user1.post('/api/bookings', { eventId, participantCount: 5 });
    assertEquals(res.status, 201);
  });

  await reporter.test('F9.5: Booking requesting 0 participants rejected with 400 INVALID_PARTICIPANT_COUNT', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const res = await user1.post('/api/bookings', { eventId, participantCount: 0 });
    assertEquals(res.status, 400);
    assertEquals(res.body.code, 'INVALID_PARTICIPANT_COUNT');
  });

  // -------------------------------------------------------------
  // FEATURE 10: Payment Blocking Safeguard
  // -------------------------------------------------------------
  await reporter.test('F10.1: Newly created event defaults to paymentConfig.enabled = false & providerStatus = unconfigured', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const res = await admin.post('/api/events', createValidEventPayload());
    assertEquals(res.status, 201);
    assertEquals(res.body.data.paymentConfig.enabled, false);
    assertEquals(res.body.data.paymentConfig.providerStatus, 'unconfigured');
  });

  await reporter.test('F10.2: Publishing paid_booking with unconfigured payment provider strictly blocked with 400', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const payload = createValidEventPayload({
      listingType: 'paid_booking',
      paymentConfig: {
        enabled: true,
        currency: 'INR',
        amount: 1500,
        provider: 'none',
        providerStatus: 'unconfigured' // Not live!
      }
    });

    const created = await admin.post('/api/events', payload);
    const eventId = created.body.data.id;

    // Attempt to publish
    const pubRes = await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });
    assertEquals(pubRes.status, 400);
  });

  await reporter.test('F10.3: Blocked paid publication returns PAYMENT_PROVIDER_UNCONFIGURED code and clear message', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const payload = createValidEventPayload({
      listingType: 'paid_booking',
      paymentConfig: {
        enabled: true,
        currency: 'INR',
        amount: 2000,
        provider: 'razorpay',
        providerStatus: 'test_mode' // test_mode is not 'live'
      }
    });

    const created = await admin.post('/api/events', payload);
    const eventId = created.body.data.id;

    const pubRes = await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });
    assertEquals(pubRes.status, 400);
    assertEquals(pubRes.body.code, 'PAYMENT_PROVIDER_UNCONFIGURED');
    assert(pubRes.body.error.includes('without an active, verified payment provider'));
  });

  await reporter.test('F10.4: Featuring paid_booking with unconfigured provider also strictly blocked with 400', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const payload = createValidEventPayload({
      listingType: 'paid_booking',
      paymentConfig: {
        enabled: true,
        currency: 'INR',
        amount: 500,
        provider: 'none',
        providerStatus: 'unconfigured'
      }
    });

    const created = await admin.post('/api/events', payload);
    const eventId = created.body.data.id;

    const featRes = await admin.post(`/api/events/${eventId}/publish`, { action: 'feature' });
    assertEquals(featRes.status, 400);
    assertEquals(featRes.body.code, 'PAYMENT_PROVIDER_UNCONFIGURED');
  });

  await reporter.test('F10.5: When payment provider is live and enabled, publishing paid_booking succeeds with 200', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const payload = createValidEventPayload({
      listingType: 'paid_booking',
      paymentConfig: {
        enabled: true,
        currency: 'INR',
        amount: 1200,
        provider: 'razorpay',
        providerStatus: 'live' // Configured!
      }
    });

    const created = await admin.post('/api/events', payload);
    const eventId = created.body.data.id;

    const pubRes = await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });
    assertEquals(pubRes.status, 200);
    assertEquals(pubRes.body.data.publicationStatus, 'published');
  });
}
