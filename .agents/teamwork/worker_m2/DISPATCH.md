# Milestone 2 Task Assignment: Events Discovery & Home Screen Integration

You are `worker_m2` (archetype: `teamwork_worker`).
Working directory: `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\worker_m2`
Target repository: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`

Read:
- `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\PROJECT.md`
- `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\NIRVAHA_EVENTS_BOOKING_CONTRACT.md`
- `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\explorer_survey_2\handoff.md`

## Files You Own Exclusively
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\components\events\StatusBadge.tsx`
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\components\events\CategoryChips.tsx`
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\components\events\EventCard.tsx`
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\app\events\index.tsx`
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\components\home\EventsRail.tsx`
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\app\(tabs)\index.tsx`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Requirements:
1. `components/events/StatusBadge.tsx`:
   - Renders badges for: `featured`, `cancelled`, `archived`, `fully_booked` (Sold Out), `registration_closed` (Closed).
   - Calm, premium Nirvaha aesthetic (gold, muted green, subtle amber/red for cancelled).
2. `components/events/CategoryChips.tsx`:
   - Horizontal scrolling category filter chips: 'all', 'yoga', 'meditation', 'sound_healing', 'wellness_workshops', 'retreats', 'community_experiences'.
   - Active state with gold accent and calm dark green background.
3. `components/events/EventCard.tsx`:
   - Cover image using `expo-image` with gradient overlay.
   - Title, category tag, date & time formatting, location (online vs venue name), price or "Free" badge, and featured gold badge.
   - On press, navigates to `/events/${event.id}` using `router.push('/events/' + event.id as any)`.
4. `app/events/index.tsx`:
   - Full Events Discovery Screen with back button navigation, header, search bar, `CategoryChips`, featured hero/highlight, and upcoming events list.
   - Pull-to-refresh (`RefreshControl`).
   - Explicit UI states: loading spinner, empty listing ("No events found in this category"), no search results, network error banner with "Retry" button.
   - Uses `ScreenContainer` or safe area insets with dynamic bottom padding.
5. `components/home/EventsRail.tsx`:
   - Horizontal rail displaying featured & upcoming events.
   - Header with title "Upcoming Experiences", subtitle "Sacred gatherings & wellness journeys", and "View All" button navigating to `/events`.
   - Card dimensions ~220px x ~160px with elegant dark translucent glass aesthetic matching `CollectionRail.tsx`.
   - Handles loading skeleton and empty state gracefully.
6. Integrate into `app/(tabs)/index.tsx`:
   - Import `EventsRail` from `@/components/home/EventsRail`.
   - Place between `<CompanionRail />` and `<CollectionRail />` without disrupting any existing components or layout.
7. Verification:
   - Run `npx tsc --noEmit --skipLibCheck components/events/* components/home/EventsRail.tsx app/events/index.tsx app/(tabs)/index.tsx` (0 new errors).
   - Run `npx expo export --platform web` (must exit 0 with all routes bundled).
8. Write detailed handoff report to `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\worker_m2\handoff.md`.
9. Send a message to the orchestrator when finished.

## 2026-11-05T15:28:47Z
Proceed with completing Milestone 2 in `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha` incorporating the latest user requirements:
1. Write `components/home/EventsRail.tsx` into Nirvaha repo.
2. Update `app/(tabs)/index.tsx` to import and render `<EventsRail />` between `<CompanionRail />` and `<CollectionRail />`.
3. Harden Firestore Fallback in `services/eventsService.ts` (API primary, Firestore fallback enforces `where('publicationStatus', 'in', ['published', 'featured'])`, normalize data).
4. Align Deep-Link Format in `services/pushNotifications.ts` (`nirvaha://events/[id]` and `nirvahaapp://events/[id]` -> `/events/[id]`, foreground listener).
5. Implement Event Details Screen (`app/events/[id]/index.tsx`) with dynamic actions (advertisement, external_registration, free_booking, paid_booking disabled), status badges, loading/error/retry.
6. Run TypeScript checks, `npx expo export --platform web`, automated verification script, and write `handoff.md`.
