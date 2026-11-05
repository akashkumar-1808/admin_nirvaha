/**
 * Tier 2 - Boundary & Corner Cases Test Suite
 * Covers edge cases, date inversions, deadline bounds, extreme participant counts,
 * unicode/special characters, idempotency limits, and structural constraints.
 */

import { ApiClient, createValidEventPayload, assertEquals, assert, setupTestEnvironment } from './infra/apiClient.mjs';

export async function runTier2Tests(reporter) {
  reporter.suite('Tier 2: Boundary & Corner Cases (16 Edge Case Tests)');

  // -------------------------------------------------------------
  // BOUNDARY 1: Date Inversions (Start Date > End Date)
  // -------------------------------------------------------------
  await reporter.test('B1: Inverted event schedule (startDate > endDate) rejected with 400 INVALID_SCHEDULE', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const now = Date.now();
    const payload = createValidEventPayload({
      schedule: {
        startDate: new Date(now + 86400000 * 5).toISOString(),
        endDate: new Date(now + 86400000 * 3).toISOString(), // 2 days earlier!
        timezone: 'Asia/Kolkata',
        durationMinutes: 60,
        registrationDeadline: new Date(now + 86400000 * 2).toISOString()
      }
    });

    const res = await admin.post('/api/events', payload);
    assertEquals(res.status, 400);
    assertEquals(res.body.code, 'INVALID_SCHEDULE');
  });

  // -------------------------------------------------------------
  // BOUNDARY 2: Inverted Deadline (Deadline > Start Date)
  // -------------------------------------------------------------
  await reporter.test('B2: Registration deadline after start date rejected with 400 INVALID_DEADLINE', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const now = Date.now();
    const payload = createValidEventPayload({
      schedule: {
        startDate: new Date(now + 86400000 * 2).toISOString(),
        endDate: new Date(now + 86400000 * 3).toISOString(),
        timezone: 'Asia/Kolkata',
        durationMinutes: 120,
        registrationDeadline: new Date(now + 86400000 * 4).toISOString() // After event starts!
      }
    });

    const res = await admin.post('/api/events', payload);
    assertEquals(res.status, 400);
    assertEquals(res.body.code, 'INVALID_DEADLINE');
  });

  // -------------------------------------------------------------
  // BOUNDARY 3: Inverted Registration Window (Open > Close)
  // -------------------------------------------------------------
  await reporter.test('B3: Registration open date after close date rejected with 400 INVALID_REGISTRATION_WINDOW', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const now = Date.now();
    const payload = createValidEventPayload({
      bookingConfig: {
        capacity: 15,
        isUnlimitedCapacity: false,
        maxParticipantsPerBooking: 2,
        registrationOpenDate: new Date(now + 86400000 * 3).toISOString(), // After close!
        registrationCloseDate: new Date(now + 86400000 * 1).toISOString(),
        requiredAttendeeFields: ['name'],
        cancellationPolicy: 'None',
        allowWaitlist: false
      }
    });

    const res = await admin.post('/api/events', payload);
    assertEquals(res.status, 400);
    assertEquals(res.body.code, 'INVALID_REGISTRATION_WINDOW');
  });

  // -------------------------------------------------------------
  // BOUNDARY 4: Zero Capacity on Non-Unlimited Event
  // -------------------------------------------------------------
  await reporter.test('B4: Zero capacity on non-unlimited event rejected with 400 INVALID_CAPACITY', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const payload = createValidEventPayload({
      bookingConfig: {
        capacity: 0,
        isUnlimitedCapacity: false,
        maxParticipantsPerBooking: 1,
        registrationOpenDate: new Date(Date.now() - 10000).toISOString(),
        registrationCloseDate: new Date(Date.now() + 86400000).toISOString(),
        requiredAttendeeFields: ['name'],
        cancellationPolicy: 'None',
        allowWaitlist: false
      }
    });

    const res = await admin.post('/api/events', payload);
    assertEquals(res.status, 400);
    assertEquals(res.body.code, 'INVALID_CAPACITY');
  });

  // -------------------------------------------------------------
  // BOUNDARY 5: Negative Capacity
  // -------------------------------------------------------------
  await reporter.test('B5: Negative capacity rejected with 400 INVALID_CAPACITY', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const payload = createValidEventPayload({
      bookingConfig: {
        capacity: -10,
        isUnlimitedCapacity: false,
        maxParticipantsPerBooking: 1,
        registrationOpenDate: new Date(Date.now() - 10000).toISOString(),
        registrationCloseDate: new Date(Date.now() + 86400000).toISOString(),
        requiredAttendeeFields: ['name'],
        cancellationPolicy: 'None',
        allowWaitlist: false
      }
    });

    const res = await admin.post('/api/events', payload);
    assertEquals(res.status, 400);
    assertEquals(res.body.code, 'INVALID_CAPACITY');
  });

  // -------------------------------------------------------------
  // BOUNDARY 6: Negative Participant Count in Booking
  // -------------------------------------------------------------
  await reporter.test('B6: Negative participant count in booking rejected with 400 INVALID_PARTICIPANT_COUNT', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const res = await user.post('/api/bookings', { eventId, participantCount: -3 });
    assertEquals(res.status, 400);
    assertEquals(res.body.code, 'INVALID_PARTICIPANT_COUNT');
  });

  // -------------------------------------------------------------
  // BOUNDARY 7: Non-numeric Participant Count
  // -------------------------------------------------------------
  await reporter.test('B7: Non-number participant count in booking rejected with 400 INVALID_PARTICIPANT_COUNT', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const res = await user.post('/api/bookings', { eventId, participantCount: 'two' });
    assertEquals(res.status, 400);
    assertEquals(res.body.code, 'INVALID_PARTICIPANT_COUNT');
  });

  // -------------------------------------------------------------
  // BOUNDARY 8: Registration Not Open Yet
  // -------------------------------------------------------------
  await reporter.test('B8: Booking before registration opening date rejected with 400 REGISTRATION_NOT_OPEN_YET', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user = ApiClient.asUser1();

    const futureOpen = new Date(Date.now() + 86400000 * 2).toISOString();
    const futureClose = new Date(Date.now() + 86400000 * 4).toISOString();

    const created = await admin.post('/api/events', createValidEventPayload({
      bookingConfig: {
        capacity: 10,
        isUnlimitedCapacity: false,
        maxParticipantsPerBooking: 2,
        registrationOpenDate: futureOpen,
        registrationCloseDate: futureClose,
        requiredAttendeeFields: ['name'],
        cancellationPolicy: 'Standard',
        allowWaitlist: false
      }
    }));
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const res = await user.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(res.status, 400);
    assertEquals(res.body.code, 'REGISTRATION_NOT_OPEN_YET');
  });

  // -------------------------------------------------------------
  // BOUNDARY 9: Registration Closed
  // -------------------------------------------------------------
  await reporter.test('B9: Booking after registration close date rejected with 400 REGISTRATION_CLOSED', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user = ApiClient.asUser1();

    const pastOpen = new Date(Date.now() - 86400000 * 4).toISOString();
    const pastClose = new Date(Date.now() - 86400000 * 2).toISOString();

    const created = await admin.post('/api/events', createValidEventPayload({
      bookingConfig: {
        capacity: 10,
        isUnlimitedCapacity: false,
        maxParticipantsPerBooking: 2,
        registrationOpenDate: pastOpen,
        registrationCloseDate: pastClose,
        requiredAttendeeFields: ['name'],
        cancellationPolicy: 'Standard',
        allowWaitlist: false
      }
    }));
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const res = await user.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(res.status, 400);
    assertEquals(res.body.code, 'REGISTRATION_CLOSED');
  });

  // -------------------------------------------------------------
  // BOUNDARY 10: Registration Deadline Exceeded
  // -------------------------------------------------------------
  await reporter.test('B10: Booking after schedule registration deadline passed rejected with 400 DEADLINE_EXCEEDED', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user = ApiClient.asUser1();

    const pastDeadline = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    const created = await admin.post('/api/events', createValidEventPayload({
      schedule: {
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 86400000 * 2).toISOString(),
        timezone: 'Asia/Kolkata',
        durationMinutes: 120,
        registrationDeadline: pastDeadline
      }
    }));
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const res = await user.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(res.status, 400);
    assertEquals(res.body.code, 'DEADLINE_EXCEEDED');
  });

  // -------------------------------------------------------------
  // BOUNDARY 11: Max Participants Per Booking Limit Boundary
  // -------------------------------------------------------------
  await reporter.test('B11: Booking requesting maxParticipantsPerBooking + 1 rejected with 400 MAX_PARTICIPANTS_EXCEEDED', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload({
      bookingConfig: { capacity: 20, isUnlimitedCapacity: false, maxParticipantsPerBooking: 2 }
    }));
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    // Requesting 3 when max is 2
    const res = await user.post('/api/bookings', { eventId, participantCount: 3 });
    assertEquals(res.status, 400);
    assertEquals(res.body.code, 'MAX_PARTICIPANTS_EXCEEDED');
  });

  // -------------------------------------------------------------
  // BOUNDARY 12: Exactly 1 Seat Remaining
  // -------------------------------------------------------------
  await reporter.test('B12: Exactly 1 seat remaining allows 1 seat booking then blocks subsequent', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user1 = ApiClient.asUser1();
    const user2 = ApiClient.asUser2();

    const created = await admin.post('/api/events', createValidEventPayload({
      bookingConfig: { capacity: 1, isUnlimitedCapacity: false, maxParticipantsPerBooking: 1 }
    }));
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    // User 1 takes the final seat
    const r1 = await user1.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(r1.status, 201);

    // User 2 tries to take a seat
    const r2 = await user2.post('/api/bookings', { eventId, participantCount: 1 });
    assertEquals(r2.status, 409);
    assertEquals(r2.body.availableCapacity, 0);
  });

  // -------------------------------------------------------------
  // BOUNDARY 13: Cancel Already Cancelled Booking
  // -------------------------------------------------------------
  await reporter.test('B13: Cancelling an already cancelled booking rejected with 400 BOOKING_NOT_ACTIVE', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    const b = await user.post('/api/bookings', { eventId, participantCount: 1 });
    const bookingId = b.body.data.id;

    // First cancel succeeds
    const c1 = await user.post(`/api/bookings/${bookingId}/cancel`);
    assertEquals(c1.status, 200);

    // Second cancel fails
    const c2 = await user.post(`/api/bookings/${bookingId}/cancel`);
    assertEquals(c2.status, 400);
    assertEquals(c2.body.code, 'BOOKING_NOT_ACTIVE');
  });

  // -------------------------------------------------------------
  // BOUNDARY 14: Hard Deletion Blocked on Active Bookings
  // -------------------------------------------------------------
  await reporter.test('B14: Hard deletion of event with active confirmed bookings rejected with 409 EVENT_HAS_ACTIVE_BOOKINGS', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const user = ApiClient.asUser1();

    const created = await admin.post('/api/events', createValidEventPayload());
    const eventId = created.body.data.id;
    await admin.post(`/api/events/${eventId}/publish`, { action: 'publish' });

    await user.post('/api/bookings', { eventId, participantCount: 1 });

    // Admin attempts hard delete
    const delRes = await admin.delete(`/api/events/${eventId}`);
    assertEquals(delRes.status, 409);
    assertEquals(delRes.body.code, 'EVENT_HAS_ACTIVE_BOOKINGS');
  });

  // -------------------------------------------------------------
  // BOUNDARY 15: Unicode & Special Characters Integrity
  // -------------------------------------------------------------
  await reporter.test('B15: Unicode Sanskrit devanagari & emojis in title persist with high fidelity', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();
    const complexTitle = 'ॐ शान्ति: Himalayan Nada Yoga & Sound Immersion 🌿🧘';
    const payload = createValidEventPayload({
      title: complexTitle,
      tags: ['संस्कृत', 'йога', 'sound-healing#1', 'inner&outer']
    });

    const created = await admin.post('/api/events', payload);
    assertEquals(created.status, 201);
    assertEquals(created.body.data.title, complexTitle);
    assertEquals(created.body.data.tags[0], 'संस्कृत');
  });

  // -------------------------------------------------------------
  // BOUNDARY 16: Short Description Minimum Length Boundary
  // -------------------------------------------------------------
  await reporter.test('B16: Short description with exactly 10 characters succeeds, 9 characters fails', async () => {
    setupTestEnvironment();
    const admin = ApiClient.asAdmin();

    // 9 chars fails
    const r1 = await admin.post('/api/events', createValidEventPayload({ shortDescription: '123456789' }));
    assertEquals(r1.status, 400);
    assertEquals(r1.body.code, 'INVALID_SHORT_DESCRIPTION');

    // 10 chars succeeds
    const r2 = await admin.post('/api/events', createValidEventPayload({ shortDescription: '1234567890' }));
    assertEquals(r2.status, 201);
  });
}
