# Original User Request

## Initial Request — 2026-11-05T13:36:00Z

Implement the complete Events, Experiences and Booking experience inside the existing Nirvaha mobile application in parallel with Team 1 (admin panel and backend) for production.

Working directory: C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha
Integrity mode: development

## Requirements

### R1. Mobile Foundation & Backend Integration
- Coordinate with Team 1 and obtain `NIRVAHA_EVENTS_BOOKING_CONTRACT.md` confirming EventDocument, BookingDocument, listing types, event/booking statuses, API endpoints, authentication requirements, error response format, and notification deep-link format. Do not independently change these definitions.
- Create `types/events.ts`, `types/bookings.ts`, `services/eventsService.ts`, and `services/bookingsService.ts`.
- Fetch published events, event details, featured events, and user's bookings. Use Firestore for published-event reads only if permitted by agreed security rules.
- Require live backend endpoints from Team 1 before completing integration. Submit bookings, capacity enforcement, and privileged booking changes strictly through Team 1's authenticated server API using an environment-based configuration for the API base URL. Never write bookings directly to Firestore from the mobile application.
- Handle loading, error, empty, and cancellation states consistently.

### R2. Events Discovery & Home Screen Integration
- Build `app/events/index.tsx` containing featured experiences, upcoming events, category filters (yoga, meditation, sound healing, wellness workshops, retreats, community experiences), and search.
- Event cards must display cover image, title, category, date and time, venue or online format, price (if applicable), and featured badge (if configured), using the calm, premium Nirvaha aesthetic.
- Build `components/home/EventsRail.tsx` and integrate a featured/upcoming events section into `app/(tabs)/index.tsx` using existing home-screen layout conventions without disrupting current features.

### R3. Event Details & Dynamic Listing Behaviour
- Build `app/events/[id]/index.tsx` displaying cover image, event title, full description, organizer/instructor, date and time, duration, venue/address or online details, pricing, availability, registration deadline, and dynamic primary action.
- Dynamically determine the primary action based on event configuration:
  - Advertisement: display event information, no booking action, optional configured CTA opening the supplied destination.
  - External registration: display Register, open the configured external URL without claiming in-app registration.
  - Free booking: display Book Free or Register, open in-app registration form, validate required info, submit to Team 1's authenticated API, and display confirmation.
  - Paid booking: display pricing and Book Now only when an approved payment integration is genuinely available; keep paid booking unavailable until Team 1 confirms an approved payment provider and secure backend verification; no fake payment screens or client-marked paid bookings.
- Handle event states gracefully: Published, Cancelled, Fully booked, Registration closed, Archived, and Unavailable. Never allow booking submission when an event is not eligible for booking.

### R4. Registration Flow & Booking Confirmation
- Build `app/events/[id]/register.tsx` supporting configured registration fields (full name, email, phone, notes), form validation, clear labels, loading state, duplicate submission prevention, and submission error handling.
- Build `app/events/[id]/confirmation.tsx` displaying success confirmation, server-generated booking reference, event title, date and time, venue or online details, booking status, relevant next steps, and navigation back to the event or My Bookings. Never generate a fake confirmation locally or expose private participant information.

### R5. My Bookings & Account Integration
- Build `app/events/my-bookings.tsx` with an accessible entry point integrated into the existing profile or account experience.
- Allow authenticated users to view their own booking records: event details, booking reference, booking date, booking status, payment status (where relevant), joining instructions, and cancellation status. Ensure users only access their own records.

### R6. Push Notifications & Deep Linking
- Reuse existing `services/pushNotifications.ts` without replacing the notification system or creating duplicate handlers.
- Route event notifications to `/events/[id]` using a stable event ID agreed with Team 1.
- Fetch latest event information after opening, supporting app already open, in background, completely closed, and handling cancelled/archived events or invalid IDs gracefully.

### R7. Visual Design & Robust State Handling
- Adhere to the Nirvaha theme in `constants/theme.ts` (deep forest green, warm ivory, restrained gold accents, typography, safe-area handling, bottom navigation spacing).
- Provide explicit UI handling across all screens for: loading, empty event listings, no search results, network failure, retry, event unavailable, event cancelled, fully booked, registration closed, invalid registration, duplicate booking attempt, booking submission failure, and payment pending/failure. Never leave users with a blank screen.

## Verification Resources
- Run existing project checks and build verification scripts:
  - TypeScript / typecheck: `npx tsc --noEmit`
  - Linting: `npm run lint` (or project linter script)
  - Application build / export verification: `npx expo export` (or available build verification scripts)

## Acceptance Criteria

### Discovery & Home Experience
- [ ] Events discovery screen (`app/events/index.tsx`) renders published events with functional category filters and search.
- [ ] Home screen (`app/(tabs)/index.tsx`) includes `EventsRail` displaying featured/upcoming events without disrupting existing home features.

### Dynamic Actions & Event States
- [ ] Event details screen renders the correct primary action dynamically for Advertisement, External registration, Free booking, and Paid booking (unavailable until verified).
- [ ] Ineligible event states (Cancelled, Fully booked, Registration closed, Archived, Unavailable) prevent booking submissions and display appropriate status messages.

### Booking Registration & Server Submission
- [ ] In-app registration validates required fields and submits bookings exclusively through Team 1's authenticated server endpoint.
- [ ] Mobile client does not write booking documents directly to Cloud Firestore.
- [ ] Successful registration retrieves and displays a server-generated booking reference.
- [ ] Form prevents duplicate submissions while a request is in flight.

### My Bookings & Deep Linking
- [ ] `app/events/my-bookings.tsx` displays only the authenticated user's bookings with accurate reference, status, and joining details.
- [ ] Push notification deep links to `/events/[id]` open and load event details correctly from foreground, background, and cold launch states.

### Quality, Consistency & Build
- [ ] All new and modified screens provide explicit loading, empty, and network error/retry states.
- [ ] Design adheres to `constants/theme.ts` colors, typography, and safe area constraints.
- [ ] Project passes build verification (`npx expo export`) and typecheck/lint checks without breaking existing authentication or navigation architecture.


## Follow-up — 2026-11-05T14:36:30Z

User instruction:
"The survey and specification phase is complete. I want the team to move into actual implementation immediately.

Please stop dispatching additional exploratory agents unless a concrete technical blocker requires investigation.

Prioritize Milestone 1 implementation:
1. Create and implement events.ts and bookings.ts.
2. Implement eventsService.ts and bookingsService.ts.
3. Integrate with the existing backend contract from Team 1.
4. Implement authentication, request handling, error handling and appropriate loading states.
5. Run TypeScript checks and Expo export.
6. Report actual files modified, test results and unresolved issues.

Important constraints:
- Do not invent API endpoints or response structures.
- Do not duplicate backend business logic.
- Do not allow the mobile client to independently enforce booking capacity.
- Do not break existing Nirvaha screens, authentication, navigation or push notifications.
- Do not introduce mock data as a substitute for backend integration.
- Paid bookings must remain unavailable until a verified payment integration exists.

After Milestone 1 passes verification, proceed directly to event discovery screens.

I expect working code and test evidence, not another round of planning updates."
