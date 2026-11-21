/**
 * Milestone 2 Verification Harness: Events Discovery, Details & Integration
 * Tests status matrix, bookability safeguards, deep-link normalization,
 * data normalization, and category search logic.
 */

import { parseDeepLink } from './aligned_pushNotifications';
import { normalizeEventDocument } from './hardened_eventsService';

// Recreate status logic for verification
function getComputedEventStatus(event: any): string {
  if (event.publicationStatus === 'cancelled') return 'cancelled';
  if (event.publicationStatus === 'archived') return 'archived';

  if (event.bookingConfig?.capacity && event.bookingConfig.capacity > 0) {
    if ((event.attendeeCount || 0) >= event.bookingConfig.capacity) {
      return 'fully_booked';
    }
  }

  if (event.schedule?.registrationDeadline) {
    const deadline = new Date(event.schedule.registrationDeadline).getTime();
    if (!isNaN(deadline) && Date.now() > deadline) {
      return 'registration_closed';
    }
  }

  if (event.isFeatured || event.publicationStatus === 'featured') {
    return 'featured';
  }

  return event.publicationStatus || 'published';
}

function isEventBookable(event: any): boolean {
  if (event.listingType !== 'free_booking') return false;
  const status = getComputedEventStatus(event);
  return status === 'published' || status === 'featured';
}

// Test Suite Runner
let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

console.log('=== SUITE 1: Deep Link Normalization Tests ===');
assert(parseDeepLink('nirvaha://events/evt-101') === '/events/evt-101', 'Normalizes nirvaha:// scheme');
assert(parseDeepLink('nirvahaapp://events/evt-202') === '/events/evt-202', 'Normalizes nirvahaapp:// scheme');
assert(parseDeepLink('/events/evt-303') === '/events/evt-303', 'Preserves direct route path');
assert(parseDeepLink('nirvaha://music') === '/collection', 'Maps legacy music route to /collection');
assert(parseDeepLink('nirvaha://sleep') === '/(tabs)/wellness', 'Maps legacy sleep route to wellness');
assert(parseDeepLink('nirvaha://companions') === '/chat', 'Maps legacy companions route to chat');
assert(parseDeepLink('') === null, 'Returns null for empty input');
assert(parseDeepLink(undefined) === null, 'Returns null for undefined input');

console.log('\n=== SUITE 2: Status Matrix & Computed Status Tests ===');
const baseEvent = {
  id: 'evt-test',
  title: 'Morning Yoga Flow',
  category: 'yoga',
  listingType: 'free_booking',
  publicationStatus: 'published',
  attendeeCount: 5,
  bookingConfig: { capacity: 20 },
  schedule: {
    startDate: new Date(Date.now() + 86400000).toISOString(),
    registrationDeadline: new Date(Date.now() + 3600000).toISOString(),
  },
};

assert(getComputedEventStatus(baseEvent) === 'published', 'Normal published event has status "published"');
assert(isEventBookable(baseEvent) === true, 'Normal published free event is bookable');

const featuredEvent = { ...baseEvent, isFeatured: true };
assert(getComputedEventStatus(featuredEvent) === 'featured', 'Featured event has status "featured"');
assert(isEventBookable(featuredEvent) === true, 'Featured event is bookable');

const soldOutEvent = { ...baseEvent, attendeeCount: 20 };
assert(getComputedEventStatus(soldOutEvent) === 'fully_booked', 'Capacity reached computes "fully_booked"');
assert(isEventBookable(soldOutEvent) === false, 'Sold out event is NOT bookable');

const closedEvent = {
  ...baseEvent,
  schedule: { ...baseEvent.schedule, registrationDeadline: new Date(Date.now() - 3600000).toISOString() },
};
assert(getComputedEventStatus(closedEvent) === 'registration_closed', 'Past deadline computes "registration_closed"');
assert(isEventBookable(closedEvent) === false, 'Closed registration event is NOT bookable');

const cancelledEvent = { ...baseEvent, publicationStatus: 'cancelled' };
assert(getComputedEventStatus(cancelledEvent) === 'cancelled', 'Cancelled event computes "cancelled"');
assert(isEventBookable(cancelledEvent) === false, 'Cancelled event is NOT bookable');

const archivedEvent = { ...baseEvent, publicationStatus: 'archived' };
assert(getComputedEventStatus(archivedEvent) === 'archived', 'Archived event computes "archived"');
assert(isEventBookable(archivedEvent) === false, 'Archived event is NOT bookable');

console.log('\n=== SUITE 3: Paid & Non-Free Safeguard Tests ===');
const paidEvent = { ...baseEvent, listingType: 'paid_booking' };
assert(isEventBookable(paidEvent) === false, 'Paid booking is strictly NOT bookable in client');

const adEvent = { ...baseEvent, listingType: 'advertisement' };
assert(isEventBookable(adEvent) === false, 'Advertisement is NOT bookable in client');

const extEvent = { ...baseEvent, listingType: 'external_registration' };
assert(isEventBookable(extEvent) === false, 'External registration is NOT bookable in client');

console.log('\n=== SUITE 4: Data Normalization Robustness Tests ===');
const rawFirestoreDoc = {
  title: 'Sound Healing Circle',
  schedule: {
    startDate: { seconds: 1762350000, nanoseconds: 0 },
    registrationDeadline: '2026-11-10T12:00:00.000Z',
  },
  attendeeCount: '12', // string number
};
const normalized = normalizeEventDocument(rawFirestoreDoc, 'doc-123');
assert(normalized.id === 'doc-123', 'Document ID preserved or assigned');
assert(typeof normalized.schedule.startDate === 'string', 'Firestore Timestamp normalized to string');
assert(typeof normalized.attendeeCount === 'number' && normalized.attendeeCount === 12, 'Attendee count parsed to number');
assert(normalized.media.coverImageUrl.length > 0, 'Safe default image URL provided');

console.log('\n=== SUITE 5: Dataset Filtering & Search Verification ===');
const sampleDataset = [
  normalizeEventDocument({ id: '1', title: 'Kundalini Yoga Morning', category: 'yoga' }),
  normalizeEventDocument({ id: '2', title: 'Tibetan Singing Bowl Meditation', category: 'sound_healing' }),
  normalizeEventDocument({ id: '3', title: 'Breathwork & Mindfulness', category: 'meditation' }),
  normalizeEventDocument({ id: '4', title: 'Ayurvedic Wellness Retreat', category: 'retreats' }),
];

const yogaResults = sampleDataset.filter((e) => e.category === 'yoga');
assert(yogaResults.length === 1 && yogaResults[0].id === '1', 'Category filtering matches exact category');

const searchResults = sampleDataset.filter((e) =>
  e.title.toLowerCase().includes('meditation') || e.category.toLowerCase().includes('meditation')
);
assert(searchResults.length === 2, 'Search query correctly matches title across categories');

const emptyResults = sampleDataset.filter((e) => e.title.toLowerCase().includes('nonexistent_journey_xyz'));
assert(emptyResults.length === 0, 'Non-matching query gracefully yields 0 results');

console.log(`\n========================================`);
console.log(`Total Passed: ${passed} | Total Failed: ${failed}`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL VERIFICATION SUITES PASSED CLEANLY (100%)');
  process.exit(0);
}
