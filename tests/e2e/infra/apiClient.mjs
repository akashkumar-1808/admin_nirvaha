/**
 * Unified Test API Client for Nirvaha E2E Tests
 * Provides typed request dispatch, role-based auth presets, and assertion helpers.
 */

import { dispatchRequest } from './contractRouter.mjs';
import { resetFirebaseMocks, mockDb, mockMessaging } from './mockFirebase.mjs';

export class ApiClient {
  constructor(token = null) {
    this.token = token;
  }

  static anonymous() {
    return new ApiClient(null);
  }

  static asAdmin() {
    return new ApiClient('admin_token');
  }

  static asAdminWhitelist() {
    return new ApiClient('admin_whitelist_token');
  }

  static asUser1() {
    return new ApiClient('regular_user_1_token');
  }

  static asUser2() {
    return new ApiClient('regular_user_2_token');
  }

  static asUnauthorized() {
    return new ApiClient('unauthorized_token');
  }

  static withToken(token) {
    return new ApiClient(token);
  }

  async request(method, url, body = null, extraHeaders = {}) {
    const headers = { ...extraHeaders };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return dispatchRequest({ method, url, headers, body });
  }

  async get(url, headers = {}) {
    return this.request('GET', url, null, headers);
  }

  async post(url, body, headers = {}) {
    return this.request('POST', url, body, headers);
  }

  async put(url, body, headers = {}) {
    return this.request('PUT', url, body, headers);
  }

  async delete(url, headers = {}) {
    return this.request('DELETE', url, null, headers);
  }
}

// Global Test Reset Utility
export function setupTestEnvironment() {
  resetFirebaseMocks();
}

// Standard Event Factory Helper
export function createValidEventPayload(overrides = {}) {
  const now = Date.now();
  const startDate = new Date(now + 86400000 * 5).toISOString(); // 5 days ahead
  const endDate = new Date(now + 86400000 * 5 + 3600000 * 2).toISOString(); // 2 hours duration
  const deadline = new Date(now + 86400000 * 4).toISOString(); // 4 days ahead
  const regOpen = new Date(now - 86400000).toISOString(); // 1 day ago
  const regClose = deadline;

  return {
    title: 'Mindful Sound Healing Journey',
    shortDescription: 'Immerse in deep harmonic resonance and meditative silence.',
    fullDescription: 'Join certified masters for an authentic vibrational sound healing experience utilizing Tibetan singing bowls and gong frequencies.',
    category: 'sound_healing',
    tags: ['meditation', 'sound', 'healing', 'peace'],
    organizer: {
      name: 'Master Bodhi',
      email: 'bodhi@nirvaha.org',
      contact: '+919876543210'
    },
    media: {
      coverImageUrl: 'https://storage.googleapis.com/nirvaha-app.appspot.com/events/sound-cover.jpg',
      galleryImageUrls: []
    },
    schedule: {
      startDate,
      endDate,
      timezone: 'Asia/Kolkata',
      durationMinutes: 120,
      registrationDeadline: deadline
    },
    location: {
      type: 'offline',
      venueName: 'Zen Mandapam, Nirvaha Sanctuary',
      address: 'Rishikesh, Uttarakhand, India'
    },
    listingType: 'free_booking',
    bookingConfig: {
      capacity: 25,
      isUnlimitedCapacity: false,
      maxParticipantsPerBooking: 2,
      registrationOpenDate: regOpen,
      registrationCloseDate: regClose,
      requiredAttendeeFields: ['name', 'email', 'phone'],
      cancellationPolicy: 'Free cancellation up to 24 hours prior to commencement.',
      allowWaitlist: false
    },
    paymentConfig: {
      enabled: false,
      currency: 'INR',
      amount: 0,
      provider: 'none',
      providerStatus: 'unconfigured'
    },
    displayOrder: 1,
    notifyOnPublish: true,
    ...overrides
  };
}

// Assertion Helpers
export function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

export function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}
