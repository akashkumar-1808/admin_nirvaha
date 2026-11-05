import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to transpile and load TS modules in CommonJS environment
function loadTsModule(relativePath, mockRequires = {}) {
  const filePath = path.resolve(rootDir, relativePath);
  const code = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });

  const m = { exports: {} };
  const customRequire = (id) => {
    if (mockRequires[id]) {
      return mockRequires[id];
    }
    if (id.startsWith('@/')) {
      const mapped = id.replace('@/', './');
      return loadTsModule(mapped + (mapped.endsWith('.ts') ? '' : '.ts'), mockRequires);
    }
    return require(id);
  };

  const fn = new Function('exports', 'module', 'require', 'process', '__dirname', '__filename', transpiled.outputText);
  fn(m.exports, m, customRequire, process, path.dirname(filePath), filePath);
  return m.exports;
}

// Minimal Test Runner
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m ${message}`);
  } else {
    failedTests++;
    console.log(`  \x1b[31m✖ FAIL\x1b[0m ${message}`);
    failures.push(message);
  }
}

function suite(name) {
  console.log(`\n\x1b[1m\x1b[36m=== ${name} ===\x1b[0m\n`);
}

async function runEmpiricalStressTests() {
  console.log(`\x1b[1m\x1b[35mStarting Empirical Stress Test Harness for Milestone 1...\x1b[0m`);
  console.log(`Root Directory: ${rootDir}\n`);

  // =========================================================================
  // SUITE 1: Firebase Admin Exports (services/firebase/admin.ts)
  // =========================================================================
  suite('1. Firebase Admin Exports Parity & Initialization');

  const adminMod = loadTsModule('services/firebase/admin.ts');

  assert('adminDb' in adminMod, 'adminDb is exported from services/firebase/admin.ts');
  assert('adminFirestore' in adminMod, 'adminFirestore is exported from services/firebase/admin.ts');
  assert(adminMod.adminDb === adminMod.adminFirestore, 'adminDb and adminFirestore point to identical singleton reference');
  assert('adminApp' in adminMod, 'adminApp is exported');
  assert('adminAuth' in adminMod, 'adminAuth is exported');
  assert('adminMessaging' in adminMod, 'adminMessaging is exported');
  assert(typeof adminMod.isFirebaseAdminConfigured === 'function', 'isFirebaseAdminConfigured is a function');

  // Verify behavior when env vars are missing or mock
  const isConfigured = adminMod.isFirebaseAdminConfigured();
  assert(typeof isConfigured === 'boolean', `isFirebaseAdminConfigured() returns boolean (${isConfigured})`);
  if (!isConfigured) {
    assert(adminMod.adminDb === null, 'adminDb is safely null when credentials unconfigured');
    assert(adminMod.adminFirestore === null, 'adminFirestore is safely null when credentials unconfigured');
  }

  // Verify mock injection parity
  const mockFakeFirestore = { collection: () => ({ doc: () => ({}) }) };
  const mockFakeApp = { name: '[DEFAULT]' };
  const mockAdminSdk = {
    getApps: () => [mockFakeApp],
    initializeApp: () => mockFakeApp,
    getApp: () => mockFakeApp,
    cert: () => ({}),
    getFirestore: () => mockFakeFirestore,
    getAuth: () => ({}),
    getMessaging: () => ({}),
  };

  const configuredAdminMod = loadTsModule('services/firebase/admin.ts', {
    'firebase-admin/app': mockAdminSdk,
    'firebase-admin/auth': mockAdminSdk,
    'firebase-admin/firestore': mockAdminSdk,
    'firebase-admin/messaging': mockAdminSdk,
  });

  assert(configuredAdminMod.adminDb !== undefined, 'configured adminDb is defined');
  assert(configuredAdminMod.adminFirestore !== undefined, 'configured adminFirestore is defined');
  assert(configuredAdminMod.adminDb === configuredAdminMod.adminFirestore, 'configured adminDb === adminFirestore under initialized App');

  // =========================================================================
  // SUITE 2: lib/validations/events.ts Stress Testing
  // =========================================================================
  suite('2. Event Validation Stress & Adversarial Payloads');

  const eventsVal = loadTsModule('lib/validations/events.ts');
  const { validateCreateEventInput, validateUpdateEventInput, validatePublishEventInput } = eventsVal;

  // 2.1 Non-object and malformed inputs
  assert(!validateCreateEventInput(null).isValid, 'Rejects null input');
  assert(!validateCreateEventInput(undefined).isValid, 'Rejects undefined input');
  assert(!validateCreateEventInput([]).isValid, 'Rejects array input');
  assert(!validateCreateEventInput("string").isValid, 'Rejects string primitive input');
  assert(!validateCreateEventInput(12345).isValid, 'Rejects number primitive input');

  // Helper valid base event
  const baseValidEvent = {
    title: 'Mindfulness & Sound Healing Workshop',
    shortDescription: 'Experience transformative healing and sound therapy in an ancient Himalayan garden.',
    fullDescription: 'Comprehensive meditation and sonic healing immersion.',
    category: 'meditation',
    tags: ['meditation', 'sound-healing', 'zen'],
    organizer: { name: 'Swami Anand', email: 'anand@nirvaha.org' },
    media: { coverImageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773' },
    schedule: {
      startDate: new Date(Date.now() + 86400000).toISOString(),
      endDate: new Date(Date.now() + 172800000).toISOString(),
      timezone: 'Asia/Kolkata',
      registrationDeadline: new Date(Date.now() + 43200000).toISOString(),
    },
    location: {
      type: 'offline',
      venueName: 'Himalayan Sanctuary',
      address: 'Temple Road, Rishikesh',
    },
    listingType: 'free_booking',
    bookingConfig: {
      capacity: 30,
      isUnlimitedCapacity: false,
      maxParticipantsPerBooking: 4,
      registrationOpenDate: new Date(Date.now() - 3600000).toISOString(),
      registrationCloseDate: new Date(Date.now() + 43200000).toISOString(),
    },
    paymentConfig: {
      enabled: false,
      currency: 'INR',
      amount: 0,
      provider: 'none',
      providerStatus: 'unconfigured',
    },
    displayOrder: 1,
    notifyOnPublish: true,
  };

  const validRes = validateCreateEventInput(baseValidEvent);
  assert(validRes.isValid && validRes.errors.length === 0, 'Clean baseline event validates successfully');

  // 2.2 Title stress test (boundaries, XSS, Unicode)
  assert(!validateCreateEventInput({ ...baseValidEvent, title: 'AB' }).isValid, 'Rejects title shorter than 3 characters');
  assert(!validateCreateEventInput({ ...baseValidEvent, title: '   ' }).isValid, 'Rejects whitespace-only title');
  assert(!validateCreateEventInput({ ...baseValidEvent, title: 'A'.repeat(121) }).isValid, 'Rejects title exceeding 120 characters');
  assert(validateCreateEventInput({ ...baseValidEvent, title: 'A'.repeat(120) }).isValid, 'Accepts title of exactly 120 characters');
  assert(validateCreateEventInput({ ...baseValidEvent, title: 'Zen' }).isValid, 'Accepts title of exactly 3 characters');

  // XSS injection in title
  const xssTitle = '<script>alert("XSS")</script> Sound Journey';
  const xssRes = validateCreateEventInput({ ...baseValidEvent, title: xssTitle });
  assert(xssRes.isValid, 'Accepts title with HTML tags without server crash');
  assert(xssRes.sanitized.title === xssTitle.trim(), 'Title is safely trimmed and preserved');

  // Unicode Sanskrit & Emojis
  const unicodeTitle = 'ॐ योग & ध्यानम् - Divine Experience 🧘✨';
  const unicodeRes = validateCreateEventInput({ ...baseValidEvent, title: unicodeTitle });
  assert(unicodeRes.isValid, 'Accepts Sanskrit Unicode and Emojis in title');
  assert(unicodeRes.sanitized.title === unicodeTitle, 'Preserves Unicode fidelity');

  // 2.3 Short Description boundaries
  assert(!validateCreateEventInput({ ...baseValidEvent, shortDescription: '123456789' }).isValid, 'Rejects short description < 10 characters');
  assert(validateCreateEventInput({ ...baseValidEvent, shortDescription: '1234567890' }).isValid, 'Accepts short description of exactly 10 characters');
  assert(validateCreateEventInput({ ...baseValidEvent, shortDescription: 'X'.repeat(250) }).isValid, 'Accepts short description of exactly 250 characters');
  assert(!validateCreateEventInput({ ...baseValidEvent, shortDescription: 'X'.repeat(251) }).isValid, 'Rejects short description > 250 characters');

  // 2.4 Schedule & Date Invariants
  assert(!validateCreateEventInput({
    ...baseValidEvent,
    schedule: { ...baseValidEvent.schedule, startDate: 'invalid-date' },
  }).isValid, 'Rejects malformed start date');

  assert(!validateCreateEventInput({
    ...baseValidEvent,
    schedule: { ...baseValidEvent.schedule, endDate: 'not-an-iso-string' },
  }).isValid, 'Rejects malformed end date');

  // Inverted schedule: endDate < startDate
  const invertedDates = validateCreateEventInput({
    ...baseValidEvent,
    schedule: {
      ...baseValidEvent.schedule,
      startDate: '2026-12-02T10:00:00Z',
      endDate: '2026-12-01T10:00:00Z',
    },
  });
  assert(!invertedDates.isValid, 'Rejects inverted schedule (endDate < startDate)');
  assert(invertedDates.errors.some(e => e.includes('Event end date must be on or after start date')), 'Contains exact schedule chronology error message');

  // Registration deadline after start date
  const lateDeadline = validateCreateEventInput({
    ...baseValidEvent,
    schedule: {
      ...baseValidEvent.schedule,
      startDate: '2026-12-01T10:00:00Z',
      endDate: '2026-12-02T10:00:00Z',
      registrationDeadline: '2026-12-03T10:00:00Z',
    },
  });
  assert(!lateDeadline.isValid, 'Rejects registration deadline occurring after event start date');
  assert(lateDeadline.errors.some(e => e.includes('Registration deadline must be before or equal to event start date')), 'Contains exact deadline error message');

  // 2.5 Capacity & Booking Boundaries
  const negativeCap = validateCreateEventInput({
    ...baseValidEvent,
    bookingConfig: { ...baseValidEvent.bookingConfig, capacity: -10, isUnlimitedCapacity: false },
  });
  assert(!negativeCap.isValid, 'Rejects negative capacity');
  assert(negativeCap.errors.some(e => e.includes('Capacity must be a positive number greater than 0')), 'Contains exact capacity error message');

  const zeroCap = validateCreateEventInput({
    ...baseValidEvent,
    bookingConfig: { ...baseValidEvent.bookingConfig, capacity: 0, isUnlimitedCapacity: false },
  });
  assert(!zeroCap.isValid, 'Rejects 0 capacity when isUnlimitedCapacity is false');

  const maxParticipantsExcess = validateCreateEventInput({
    ...baseValidEvent,
    bookingConfig: { ...baseValidEvent.bookingConfig, capacity: 10, maxParticipantsPerBooking: 15, isUnlimitedCapacity: false },
  });
  assert(!maxParticipantsExcess.isValid, 'Rejects maxParticipantsPerBooking > total capacity');

  const invertedRegDates = validateCreateEventInput({
    ...baseValidEvent,
    bookingConfig: {
      ...baseValidEvent.bookingConfig,
      registrationOpenDate: '2026-12-05T00:00:00Z',
      registrationCloseDate: '2026-12-01T00:00:00Z',
    },
  });
  assert(!invertedRegDates.isValid, 'Rejects registrationCloseDate < registrationOpenDate');

  // Unlimited capacity accepts 0 capacity
  const unlimitedCap = validateCreateEventInput({
    ...baseValidEvent,
    bookingConfig: { ...baseValidEvent.bookingConfig, capacity: 0, isUnlimitedCapacity: true, maxParticipantsPerBooking: 10 },
  });
  assert(unlimitedCap.isValid, 'Unlimited capacity allows capacity: 0');

  // 2.6 Location constraints
  const badOffline = validateCreateEventInput({
    ...baseValidEvent,
    location: { type: 'offline', venueName: '', address: '' },
  });
  assert(!badOffline.isValid, 'Rejects offline event without venue and without address');

  const badOnline = validateCreateEventInput({
    ...baseValidEvent,
    location: { type: 'online', meetingUrl: '', accessInstructions: '' },
  });
  assert(!badOnline.isValid, 'Rejects online event without meetingUrl and without accessInstructions');

  const invalidOnlineUrl = validateCreateEventInput({
    ...baseValidEvent,
    location: { type: 'online', meetingUrl: 'ftp://insecure-ftp', accessInstructions: 'Join' },
  });
  assert(!invalidOnlineUrl.isValid, 'Rejects non-HTTP(S) meetingUrl');

  // 2.7 CRITICAL PAYMENT INVARIANT (validatePublishEventInput)
  suite('2.7 Critical Payment Invariant on Event Publication');

  // Attempt to publish paid booking with unconfigured provider
  const paidPublishBlocked1 = validatePublishEventInput(
    { action: 'publish' },
    { ...baseValidEvent, listingType: 'paid_booking', paymentConfig: { enabled: true, providerStatus: 'unconfigured' } }
  );
  assert(!paidPublishBlocked1.isValid, 'Publishing paid booking with unconfigured provider is blocked');
  assert(
    paidPublishBlocked1.errors.includes('Publication of paid bookings is blocked until an approved payment provider is configured'),
    'Returns exact payment invariant error message on unconfigured publish'
  );

  // Attempt to feature paid booking with unconfigured provider
  const paidFeatureBlocked = validatePublishEventInput(
    { action: 'feature' },
    { ...baseValidEvent, listingType: 'paid_booking', paymentConfig: { enabled: true, providerStatus: 'unconfigured' } }
  );
  assert(!paidFeatureBlocked.isValid, 'Featuring paid booking with unconfigured provider is blocked');
  assert(
    paidFeatureBlocked.errors.includes('Publication of paid bookings is blocked until an approved payment provider is configured'),
    'Returns exact payment invariant error message on unconfigured feature'
  );

  // Attempt to publish paid booking with sandbox / inactive provider
  const paidSandboxBlocked = validatePublishEventInput(
    { action: 'publish' },
    { ...baseValidEvent, listingType: 'paid_booking', paymentConfig: { enabled: true, providerStatus: 'sandbox' } }
  );
  assert(!paidSandboxBlocked.isValid, 'Publishing paid booking with sandbox provider is blocked');
  assert(
    paidSandboxBlocked.errors.includes('Publication of paid bookings is blocked until an approved payment provider is configured'),
    'Returns exact payment invariant error message on sandbox provider'
  );

  // Attempt to publish paid booking with active provider but enabled: false
  const paidDisabledBlocked = validatePublishEventInput(
    { action: 'publish' },
    { ...baseValidEvent, listingType: 'paid_booking', paymentConfig: { enabled: false, providerStatus: 'active' } }
  );
  assert(!paidDisabledBlocked.isValid, 'Publishing paid booking with enabled=false is blocked');

  // Publish paid booking with active provider and enabled: true -> SUCCESS
  const paidPublishSuccess = validatePublishEventInput(
    { action: 'publish' },
    { ...baseValidEvent, listingType: 'paid_booking', paymentConfig: { enabled: true, providerStatus: 'active' } }
  );
  assert(paidPublishSuccess.isValid, 'Publishing paid booking with active provider succeeds');

  // Publish paid booking with live provider and enabled: true -> SUCCESS
  const paidLiveSuccess = validatePublishEventInput(
    { action: 'publish' },
    { ...baseValidEvent, listingType: 'paid_booking', paymentConfig: { enabled: true, providerStatus: 'live' } }
  );
  assert(paidLiveSuccess.isValid, 'Publishing paid booking with live provider succeeds');

  // Free booking publishes without payment provider
  const freePublishSuccess = validatePublishEventInput(
    { action: 'publish' },
    { ...baseValidEvent, listingType: 'free_booking', paymentConfig: { enabled: false, providerStatus: 'unconfigured' } }
  );
  assert(freePublishSuccess.isValid, 'Publishing free booking does not require payment provider');

  // Lifecycle transitions that do not require active payment: unpublish, cancel, archive
  assert(validatePublishEventInput({ action: 'unpublish' }, { ...baseValidEvent, listingType: 'paid_booking', paymentConfig: { providerStatus: 'unconfigured' } }).isValid, 'Unpublish paid booking allowed even if unconfigured');
  assert(validatePublishEventInput({ action: 'cancel' }, { ...baseValidEvent, listingType: 'paid_booking', paymentConfig: { providerStatus: 'unconfigured' } }).isValid, 'Cancel paid booking allowed even if unconfigured');
  assert(validatePublishEventInput({ action: 'archive' }, { ...baseValidEvent, listingType: 'paid_booking', paymentConfig: { providerStatus: 'unconfigured' } }).isValid, 'Archive paid booking allowed even if unconfigured');

  // Cannot publish event with end date in the past
  const pastEventBlocked = validatePublishEventInput(
    { action: 'publish' },
    { ...baseValidEvent, schedule: { ...baseValidEvent.schedule, endDate: '2020-01-01T00:00:00Z' } }
  );
  assert(!pastEventBlocked.isValid, 'Rejects publication of event with past end date');
  assert(pastEventBlocked.errors.includes('Cannot publish an event whose end date is in the past'), 'Exact past end date message returned');


  // =========================================================================
  // SUITE 3: lib/validations/bookings.ts Stress Testing
  // =========================================================================
  suite('3. Booking Validation Stress & Invariants');

  const bookingsVal = loadTsModule('lib/validations/bookings.ts');
  const { validateCreateBookingInput, validateCancelBookingInput } = bookingsVal;

  const validBookingPayload = {
    eventId: 'evt_12345',
    participantCount: 2,
    userEmail: 'devotee@nirvaha.org',
    userName: 'Kavita Sharma',
    userPhone: '+91 9876543210',
    attendeeDetails: [
      { fullName: 'Kavita Sharma', email: 'kavita@nirvaha.org', phone: '+91 9876543210' },
      { fullName: 'Rohit Sharma', email: 'rohit@nirvaha.org', phone: '+91 9876543211' },
    ],
  };

  const validBookingContext = {
    publicationStatus: 'published',
    listingType: 'free_booking',
    capacity: 20,
    attendeeCount: 5,
    maxParticipantsPerBooking: 4,
    isUnlimitedCapacity: false,
    requiredAttendeeFields: ['fullName', 'email', 'phone'],
  };

  const bookingRes = validateCreateBookingInput(validBookingPayload, validBookingContext);
  assert(bookingRes.isValid && bookingRes.errors.length === 0, 'Clean baseline booking validates successfully');

  // 3.1 Non-object / malformed inputs
  assert(!validateCreateBookingInput(null).isValid, 'Rejects null booking payload');
  assert(!validateCreateBookingInput("string").isValid, 'Rejects string booking payload');
  assert(!validateCreateBookingInput([]).isValid, 'Rejects array booking payload');

  // 3.2 Participant Count Boundaries
  assert(!validateCreateBookingInput({ ...validBookingPayload, participantCount: 0 }).isValid, 'Rejects participantCount: 0');
  assert(!validateCreateBookingInput({ ...validBookingPayload, participantCount: -1 }).isValid, 'Rejects negative participantCount');
  assert(!validateCreateBookingInput({ ...validBookingPayload, participantCount: 2.5 }).isValid, 'Rejects fractional participantCount');
  assert(!validateCreateBookingInput({ ...validBookingPayload, participantCount: NaN }).isValid, 'Rejects NaN participantCount');

  // 3.3 Email & Name validation
  assert(!validateCreateBookingInput({ ...validBookingPayload, userEmail: 'invalid-email' }).isValid, 'Rejects malformed userEmail');
  assert(!validateCreateBookingInput({ ...validBookingPayload, userEmail: 'user@' }).isValid, 'Rejects incomplete email');
  assert(!validateCreateBookingInput({ ...validBookingPayload, userEmail: '@domain.com' }).isValid, 'Rejects missing local part email');
  assert(!validateCreateBookingInput({ ...validBookingPayload, userName: 'A' }).isValid, 'Rejects single character userName');
  assert(!validateCreateBookingInput({ ...validBookingPayload, userName: '   ' }).isValid, 'Rejects whitespace userName');

  // Email normalization: uppercase to lowercase
  const upperEmailRes = validateCreateBookingInput({ ...validBookingPayload, userEmail: 'KAVITA@NIRVAHA.ORG' });
  assert(upperEmailRes.isValid, 'Accepts uppercase email');
  assert(upperEmailRes.sanitized.userEmail === 'kavita@nirvaha.org', 'Normalizes email to lowercase');

  // 3.4 Phone validation
  assert(!validateCreateBookingInput({ ...validBookingPayload, userPhone: '123' }).isValid, 'Rejects phone < 7 digits');
  assert(validateCreateBookingInput({ ...validBookingPayload, userPhone: '1234567' }).isValid, 'Accepts 7 digit phone');

  // 3.5 Array Length Invariant: attendeeDetails.length === participantCount
  const mismatch1 = validateCreateBookingInput({
    ...validBookingPayload,
    participantCount: 2,
    attendeeDetails: [{ fullName: 'Solo Attendee' }], // only 1
  });
  assert(!mismatch1.isValid, 'Rejects attendeeDetails.length (1) < participantCount (2)');
  assert(
    mismatch1.errors.some(e => e.includes('Attendee details array length (1) must match participant count (2)')),
    'Contains exact attendee length mismatch error'
  );

  const mismatch2 = validateCreateBookingInput({
    ...validBookingPayload,
    participantCount: 1,
    attendeeDetails: [
      { fullName: 'Attendee 1' },
      { fullName: 'Attendee 2' },
      { fullName: 'Attendee 3' },
    ],
  });
  assert(!mismatch2.isValid, 'Rejects attendeeDetails.length (3) > participantCount (1)');
  assert(
    mismatch2.errors.some(e => e.includes('Attendee details array length (3) must match participant count (1)')),
    'Contains exact attendee length mismatch error'
  );

  // Missing attendee full name
  const missingName = validateCreateBookingInput({
    ...validBookingPayload,
    attendeeDetails: [
      { fullName: 'Kavita Sharma', email: 'k@test.com' },
      { fullName: '', email: 'r@test.com' },
    ],
  });
  assert(!missingName.isValid, 'Rejects attendee with empty full name');
  assert(missingName.errors.some(e => e.includes('Attendee #2 full name is required')), 'Points to specific attendee index');

  // 3.6 Event Contextual Checks
  // Unpublished / Draft event
  const draftBooking = validateCreateBookingInput(validBookingPayload, { ...validBookingContext, publicationStatus: 'draft' });
  assert(!draftBooking.isValid, 'Rejects booking on draft event');
  assert(draftBooking.errors.some(e => e.includes('Event is not open for bookings')), 'Identifies event not open for booking');

  // Unsupported listing type (advertisement)
  const adBooking = validateCreateBookingInput(validBookingPayload, { ...validBookingContext, listingType: 'advertisement' });
  assert(!adBooking.isValid, 'Rejects direct booking on advertisement listing');

  // Capacity Exceeded
  const capacityOver = validateCreateBookingInput(validBookingPayload, {
    ...validBookingContext,
    capacity: 10,
    attendeeCount: 9, // only 1 seat left
  });
  assert(!capacityOver.isValid, 'Rejects booking when requested seats exceed remaining capacity');
  assert(
    capacityOver.errors.some(e => e.includes('Requested participants exceed available capacity. Seats remaining: 1')),
    'Includes exact available capacity in error message'
  );

  // Max participants per booking exceeded
  const maxPerBookingOver = validateCreateBookingInput(validBookingPayload, {
    ...validBookingContext,
    maxParticipantsPerBooking: 1, // trying to book 2
  });
  assert(!maxPerBookingOver.isValid, 'Rejects booking when participantCount > maxParticipantsPerBooking');

  // Registration window passed
  const regClosed = validateCreateBookingInput(validBookingPayload, {
    ...validBookingContext,
    registrationCloseDate: new Date(Date.now() - 3600000).toISOString(),
  });
  assert(!regClosed.isValid, 'Rejects booking when registration has closed');

  // Registration window not yet open
  const regNotOpen = validateCreateBookingInput(validBookingPayload, {
    ...validBookingContext,
    registrationOpenDate: new Date(Date.now() + 3600000).toISOString(),
  });
  assert(!regNotOpen.isValid, 'Rejects booking when registration has not opened yet');

  // 3.7 Cancellation Input Validation
  assert(validateCancelBookingInput({}).isValid, 'Empty cancellation body defaults safely');
  assert(validateCancelBookingInput({ reason: 'Family emergency' }).isValid, 'Valid cancellation reason accepted');
  assert(!validateCancelBookingInput({ reason: 'X'.repeat(501) }).isValid, 'Rejects cancellation reason > 500 characters');
  assert(validateCancelBookingInput({ reason: 'X'.repeat(500) }).isValid, 'Accepts cancellation reason of 500 characters');
  assert(!validateCancelBookingInput({ bookingId: '' }).isValid, 'Rejects empty bookingId string');


  // =========================================================================
  // SUITE 4: lib/auth.ts Stress Testing
  // =========================================================================
  suite('4. Server-Side Authentication & Authorization Helpers');

  // We test both directly and with a mocked adminAuth
  let mockTokenStore = {};
  const mockAdminAuthInstance = {
    verifyIdToken: async (token) => {
      if (token === 'EXPIRED_TOKEN') {
        const err = new Error('Firebase ID token has expired');
        err.code = 'auth/id-token-expired';
        throw err;
      }
      if (token === 'MALFORMED_TOKEN') {
        const err = new Error('Decoding Firebase ID token failed');
        err.code = 'auth/argument-error';
        throw err;
      }
      if (mockTokenStore[token]) {
        return mockTokenStore[token];
      }
      throw new Error('Invalid token');
    },
  };

  const authMod = loadTsModule('lib/auth.ts', {
    '@/services/firebase/admin': {
      adminAuth: mockAdminAuthInstance,
    },
  });

  const { extractBearerToken, isAuthorizedAdminEmail, checkIsAdmin, verifyUserRequest, verifyAdminRequest } = authMod;

  // 4.1 extractBearerToken stress tests
  const makeReq = (headerVal) => ({
    headers: {
      get: (h) => {
        if (h.toLowerCase() === 'authorization') return headerVal;
        return null;
      },
    },
  });

  assert(extractBearerToken(makeReq(null)) === null, 'extractBearerToken handles null header');
  assert(extractBearerToken(makeReq(undefined)) === null, 'extractBearerToken handles undefined header');
  assert(extractBearerToken(makeReq('')) === null, 'extractBearerToken handles empty string');
  assert(extractBearerToken(makeReq('Basic dXNlcjpwYXNz')) === null, 'extractBearerToken rejects Basic auth header');
  assert(extractBearerToken(makeReq('Bearer')) === null, 'extractBearerToken rejects Bearer with no space or token');
  assert(extractBearerToken(makeReq('Bearer    ')) === null, 'extractBearerToken rejects whitespace token');
  assert(extractBearerToken(makeReq('Bearer valid_token_123')) === 'valid_token_123', 'extractBearerToken extracts standard Bearer token');
  assert(extractBearerToken(makeReq('Bearer   padded_token   ')) === 'padded_token', 'extractBearerToken strips surrounding whitespace from token');

  // Case-insensitive header lookup
  const lowerReq = {
    headers: {
      get: (h) => (h === 'authorization' ? 'Bearer lowercase_header_token' : null),
    },
  };
  assert(extractBearerToken(lowerReq) === 'lowercase_header_token', 'extractBearerToken performs case-insensitive header lookup');

  // 4.2 isAuthorizedAdminEmail tests
  process.env.AUTHORIZED_ADMIN_EMAILS = 'admin@nirvaha.org, superadmin@nirvaha.com,  spaced@nirvaha.org  ';

  assert(!isAuthorizedAdminEmail(null), 'isAuthorizedAdminEmail rejects null');
  assert(!isAuthorizedAdminEmail(undefined), 'isAuthorizedAdminEmail rejects undefined');
  assert(!isAuthorizedAdminEmail(''), 'isAuthorizedAdminEmail rejects empty string');
  assert(isAuthorizedAdminEmail('admin@nirvaha.org'), 'Matches exact admin email');
  assert(isAuthorizedAdminEmail('ADMIN@NIRVAHA.ORG'), 'Matches case-insensitively');
  assert(isAuthorizedAdminEmail('spaced@nirvaha.org'), 'Matches email with trimmed whitespace from env list');
  assert(!isAuthorizedAdminEmail('notadmin@nirvaha.org'), 'Rejects non-whitelisted email');
  assert(!isAuthorizedAdminEmail('admin@nirvaha.org.attacker.com'), 'Prevents domain suffix injection attack');
  assert(!isAuthorizedAdminEmail('attacker_admin@nirvaha.org'), 'Prevents prefix injection attack');

  // 4.3 checkIsAdmin custom claims & whitelist
  assert(checkIsAdmin({ admin: true }), 'Grants admin on custom claim admin === true');
  assert(!checkIsAdmin({ admin: 'true' }), 'Strictly rejects string admin === "true"');
  assert(!checkIsAdmin({ admin: 1 }), 'Strictly rejects number admin === 1');
  assert(!checkIsAdmin({ admin: null }), 'Rejects null claim');
  assert(checkIsAdmin({ email: 'superadmin@nirvaha.com' }), 'Grants admin on whitelisted email even without custom claim');
  assert(!checkIsAdmin({ email: 'regular_user@gmail.com' }), 'Rejects non-whitelisted user without custom claim');

  // 4.4 verifyUserRequest & verifyAdminRequest
  mockTokenStore['valid_user_token'] = {
    uid: 'user_regular_123',
    email: 'user@gmail.com',
  };

  mockTokenStore['valid_admin_claim_token'] = {
    uid: 'admin_user_456',
    email: 'user@gmail.com',
    admin: true,
  };

  mockTokenStore['valid_admin_email_token'] = {
    uid: 'admin_user_789',
    email: 'admin@nirvaha.org',
  };

  mockTokenStore['token_without_uid'] = {
    email: 'nouid@nirvaha.org',
  };

  // Missing header
  const noHeaderReq = makeReq(null);
  const userNoHeader = await verifyUserRequest(noHeaderReq);
  assert(!userNoHeader.authorized && userNoHeader.status === 401, 'verifyUserRequest returns 401 on missing Authorization header');

  // Expired token
  const expiredReq = makeReq('Bearer EXPIRED_TOKEN');
  const userExpired = await verifyUserRequest(expiredReq);
  assert(!userExpired.authorized && userExpired.status === 401, 'verifyUserRequest returns 401 on expired token');

  // Malformed token
  const malformedReq = makeReq('Bearer MALFORMED_TOKEN');
  const userMalformed = await verifyUserRequest(malformedReq);
  assert(!userMalformed.authorized && userMalformed.status === 401, 'verifyUserRequest returns 401 on malformed token');

  // Token without UID
  const noUidReq = makeReq('Bearer token_without_uid');
  const userNoUid = await verifyUserRequest(noUidReq);
  assert(!userNoUid.authorized && userNoUid.status === 401, 'verifyUserRequest returns 401 when token payload lacks UID');

  // Regular user request
  const regularReq = makeReq('Bearer valid_user_token');
  const userRegular = await verifyUserRequest(regularReq);
  assert(userRegular.authorized && userRegular.status === 200, 'verifyUserRequest authenticates regular user successfully');
  assert(userRegular.uid === 'user_regular_123', 'verifyUserRequest extracts correct UID');
  assert(userRegular.isAdmin === false, 'Regular user is identified with isAdmin = false');

  // Regular user attempting admin action
  const adminDenial = await verifyAdminRequest(regularReq);
  assert(!adminDenial.authorized && adminDenial.status === 403, 'verifyAdminRequest strictly denies regular user with 403 FORBIDDEN');
  assert(adminDenial.error === 'You are not authorized to perform this admin action', 'Returns standard 403 unauthorized error message');

  // Admin user via custom claim
  const adminClaimReq = makeReq('Bearer valid_admin_claim_token');
  const adminClaimRes = await verifyAdminRequest(adminClaimReq);
  assert(adminClaimRes.authorized && adminClaimRes.status === 200 && adminClaimRes.isAdmin === true, 'verifyAdminRequest authorizes admin with custom claim');

  // Admin user via email whitelist
  const adminEmailReq = makeReq('Bearer valid_admin_email_token');
  const adminEmailRes = await verifyAdminRequest(adminEmailReq);
  assert(adminEmailRes.authorized && adminEmailRes.status === 200 && adminEmailRes.isAdmin === true, 'verifyAdminRequest authorizes admin with whitelisted email');

  // Unconfigured Firebase Admin SDK returns 500
  const unconfiguredAuthMod = loadTsModule('lib/auth.ts', {
    '@/services/firebase/admin': {
      adminAuth: null,
    },
  });
  const unconfiguredRes = await unconfiguredAuthMod.verifyUserRequest(regularReq);
  assert(!unconfiguredRes.authorized && unconfiguredRes.status === 500, 'Returns 500 when Firebase Admin SDK is uninitialized');


  // =========================================================================
  // SUITE 5: Navigation Sidebar Verification (components/layout/sidebar.tsx)
  // =========================================================================
  suite('5. Sidebar Navigation Structure Verification');

  const sidebarContent = fs.readFileSync(path.resolve(rootDir, 'components/layout/sidebar.tsx'), 'utf8');
  assert(sidebarContent.includes("name: 'Events', href: '/events'"), 'Sidebar includes Events module navigation link');
  assert(sidebarContent.includes("name: 'Bookings', href: '/bookings'"), 'Sidebar includes Bookings module navigation link');
  assert(sidebarContent.includes('Calendar') && sidebarContent.includes('Ticket'), 'Sidebar imports Lucide Calendar and Ticket icons');
  assert(sidebarContent.includes("normalizedPath.startsWith(`${item.href}/`)"), 'Sidebar supports nested sub-path active route highlighting');


  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log(`\n\x1b[1m====================================================\x1b[0m`);
  console.log(`\x1b[1m         M1 EMPIRICAL CHALLENGE SUITE SUMMARY        \x1b[0m`);
  console.log(`\x1b[1m====================================================\x1b[0m\n`);

  console.log(`Total Assertions Run: ${totalTests}`);
  console.log(`Passed:               \x1b[32m${passedTests}\x1b[0m`);
  console.log(`Failed:               ${failedTests === 0 ? '\x1b[32m0\x1b[0m' : '\x1b[31m' + failedTests + '\x1b[0m'}\n`);

  if (failures.length > 0) {
    console.log(`\x1b[31mFailures detected (${failures.length}):\x1b[0m`);
    failures.forEach((f, i) => console.log(`  ${i + 1}) ${f}`));
    process.exit(1);
  } else {
    console.log(`\x1b[1m\x1b[32m🎉 ALL EMPIRICAL CHALLENGE TESTS PASSED CLEANLY (100% SUCCESS)\x1b[0m\n`);
    process.exit(0);
  }
}

runEmpiricalStressTests().catch(err => {
  console.error('\n\x1b[31m\x1b[1mFATAL ERROR IN STRESS HARNESS:\x1b[0m', err);
  process.exit(1);
});
