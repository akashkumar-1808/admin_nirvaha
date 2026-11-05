# Milestone 1 Task Assignment: API Robustness, Error Handling & Security

You are `explorer_m1_2` (archetype: `teamwork_explorer`).
Working directory: `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\explorer_m1_2`
Read:
- `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\PROJECT.md`
- `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\NIRVAHA_EVENTS_BOOKING_CONTRACT.md`

Target codebase: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`

Analyze:
1. Examine backend API error handling, response schemas, and status codes (400, 401, 403, 404, 409, 500) defined in `NIRVAHA_EVENTS_BOOKING_CONTRACT.md`.
2. Formulate helper error types and response parsers for `services/bookingsService.ts` and `services/eventsService.ts` (e.g. custom error classes `BookingApiError`, `NetworkError`).
3. Ensure token refresh / retry logic: what happens if token expires or `auth.currentUser` is null.
4. Verify environmental URL resolution: fallback chain between `process.env.EXPO_PUBLIC_API_BASE_URL` and `Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL`.
5. Write your findings and recommended implementation snippets to `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\explorer_m1_2\handoff.md`.
6. Send a message to the orchestrator when finished.
