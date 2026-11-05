# Milestone 1 Task Assignment: Security & Robustness Review

You are `reviewer_m1_2` (archetype: `teamwork_reviewer`).
Working directory: `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\reviewer_m1_2`
Target repository: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`

Read:
- `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\PROJECT.md`
- `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\NIRVAHA_EVENTS_BOOKING_CONTRACT.md`
- Worker handoff: `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\worker_m1\handoff.md`

Examine:
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\services\apiClient.ts`
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\services\bookingsService.ts`
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\services\eventsService.ts`
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\types\api.ts`

Tasks:
1. Review Bearer token acquisition from `auth.currentUser?.getIdToken()`.
2. Review 401 token refresh retry logic.
3. Review status code mappings (400, 401, 403, 404, 409, 500) and `BookingApiError` getters.
4. Review 15-second request timeout logic.
5. Verify zero direct Firestore writes for bookings.
6. Deliver verdict: APPROVE or REQUEST_CHANGES.
7. Write your report to `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\reviewer_m1_2\handoff.md`.
8. Message the orchestrator with your verdict.

## 2026-11-05T14:54:37Z
Task received from parent (0e0d4903-629d-41c5-acec-31c45d45899d). Review security, Bearer token injection, 401 token refresh retry, status code mappings, timeout handling, and zero direct Firestore writes.
