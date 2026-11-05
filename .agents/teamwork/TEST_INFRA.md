# E2E Test Infra: Nirvaha Mobile Events & Bookings

## Test Philosophy
- Opaque-box, requirement-driven.
- Automated validation via Expo build exports, TypeScript compiler checks, ESLint checks, and executable verification scripts validating models, services, listing behavior, registration flows, and deep-link routing.

## Feature Inventory & Test Coverage
| # | Feature | Source (Requirement) | Tier 1 (Feature) | Tier 2 (Boundary/Edge) | Tier 3 (Pairwise/Combo) | Tier 4 (Real-World) |
|---|---------|----------------------|:----------------:|:----------------------:|:-----------------------:|:-------------------:|
| 1 | Types & Models | R1 | ✓ | ✓ | ✓ | ✓ |
| 2 | Services & API Client | R1 | ✓ | ✓ | ✓ | ✓ |
| 3 | Events Discovery & Search | R2 | ✓ | ✓ | ✓ | ✓ |
| 4 | Home Screen EventsRail | R2 | ✓ | ✓ | ✓ | ✓ |
| 5 | Event Details & Dynamic Actions | R3 | ✓ | ✓ | ✓ | ✓ |
| 6 | Ineligible Status Handling | R3 | ✓ | ✓ | ✓ | ✓ |
| 7 | Registration Form & Validation | R4 | ✓ | ✓ | ✓ | ✓ |
| 8 | Duplicate Prevention | R4 | ✓ | ✓ | ✓ | ✓ |
| 9 | Booking Confirmation Screen | R4 | ✓ | ✓ | ✓ | ✓ |
| 10 | My Bookings Screen | R5 | ✓ | ✓ | ✓ | ✓ |
| 11 | Push Notification Deep Linking | R6 | ✓ | ✓ | ✓ | ✓ |
| 12 | Visual Design & Theme | R7 | ✓ | ✓ | ✓ | ✓ |

## Test Architecture
- **Build Verification**: `npx expo export --platform web` (ensures clean React Native / Expo web static bundling with 0 errors).
- **Native Android Bundling**: `npx expo export -p android` (ensures Hermes bytecode compilation and asset bundling).
- **TypeScript Verification**: `npx tsc --noEmit` (ensures 0 new TS errors introduced in event/booking files).
- **ESLint Verification**: `npm run lint` (ensures 0 new lint violations).
- **Automated Verification Script**: Standalone executable Node/TypeScript verification harness in `scratch/verify_events_e2e.ts` that exercises:
  - Contract & model validation
  - Service methods with mock & live HTTP endpoints
  - Dynamic listing action decision matrix
  - Form validation logic & duplicate lock state
  - Push notification deep link parser with all scheme variants (`nirvaha://`, `nirvahaapp://`, `/events/[id]`)
