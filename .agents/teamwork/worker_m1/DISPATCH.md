# Milestone 1 Task Assignment: Foundation & Backend Services Implementation

You are `worker_m1` (archetype: `teamwork_worker`).
Working directory: `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\worker_m1`
Target repository: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`

Read:
- `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\PROJECT.md`
- `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\NIRVAHA_EVENTS_BOOKING_CONTRACT.md`
- Explorer findings:
  - `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\explorer_m1_1\handoff.md`
  - `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\explorer_m1_2\handoff.md`
  - `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\explorer_m1_3\handoff.md`

## Files You Own Exclusively
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\NIRVAHA_EVENTS_BOOKING_CONTRACT.md`
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\types\events.ts`
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\types\bookings.ts`
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\types\api.ts`
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\services\apiClient.ts`
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\services\eventsService.ts`
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\services\bookingsService.ts`
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\scratch\verify_m1_foundation.ts`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Instructions
1. Copy or write `NIRVAHA_EVENTS_BOOKING_CONTRACT.md` into `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\NIRVAHA_EVENTS_BOOKING_CONTRACT.md` from the canonical contract.
2. Implement `types/events.ts` and `types/bookings.ts` ensuring all models, interfaces, and helper functions (`getComputedEventStatus`, `isEventBookable`) match `PROJECT.md` and contract specifications.
3. Implement `types/api.ts` with typed error classes (`BookingApiError`, `NetworkError`, `TimeoutError`, `UnauthenticatedError`).
4. Implement `services/apiClient.ts` with robust base URL resolution (`process.env.EXPO_PUBLIC_API_BASE_URL` -> `Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL` -> default Vercel URL), 15s timeout via `AbortController`, Bearer token acquisition from `auth.currentUser?.getIdToken()`, and transparent single retry on 401 with force refresh (`getIdToken(true)`).
5. Implement `services/eventsService.ts` with `fetchEvents`, `fetchFeaturedEvents`, `fetchEventById` with query serialization, date normalization, and graceful Firestore client fallback.
6. Implement `services/bookingsService.ts` with `createBooking`, `fetchMyBookings`, `fetchBookingById`, `cancelBooking`. Strictly NO direct Firestore writes for bookings.
7. Implement `scratch/verify_m1_foundation.ts` with the 6 verification suites from `explorer_m1_3\handoff.md`.
8. Execute verification commands:
   - `npx tsx scratch/verify_m1_foundation.ts` (all suites must pass)
   - `npx tsc --noEmit --skipLibCheck types/events.ts types/bookings.ts types/api.ts services/apiClient.ts services/eventsService.ts services/bookingsService.ts scratch/verify_m1_foundation.ts` (0 errors)
   - `npx expo export --platform web` (0 errors)
9. Write your detailed handoff report to `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\worker_m1\handoff.md`.
10. Send a message to the orchestrator with results.
