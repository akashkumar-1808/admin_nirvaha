# Orchestration Plan: Nirvaha Mobile Events & Bookings

## Mission
Deliver the full production-ready Events, Experiences, and Booking features in the Nirvaha mobile application (`C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`) aligned with Team 1 backend API and shared contract `NIRVAHA_EVENTS_BOOKING_CONTRACT.md`.

## Step-by-Step Execution Plan

### Step 0: Parallel Exploratory Survey (Phase 0)
Spawn 3 Explorers in parallel:
1. `explorer_contract`: Probe Team 1 contract `NIRVAHA_EVENTS_BOOKING_CONTRACT.md` (check both mobile and admin repositories for this contract or existing contract files/specifications), endpoints, schemas, authentication conventions, and environment variables.
2. `explorer_mobile_arch`: Probe Nirvaha mobile app structure: existing navigation (`app/(tabs)`, routing), theme (`constants/theme.ts`), push notifications (`services/pushNotifications.ts`), auth state/hooks, existing network clients / Firestore usage.
3. `explorer_tooling_e2e`: Probe mobile build/test toolchain: Expo/Next/React Native config, TypeScript config (`tsconfig.json`), lint scripts, existing tests/types, and verification commands (`npx tsc --noEmit`, `npm run lint`, `npx expo export`).

### Step 1: Synthesize Findings & Create PROJECT.md
Aggregate all findings from the 3 Explorers into `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\PROJECT.md` with:
- Architecture
- Feature Inventory
- Milestones (M1 to M6)
- Interface Contracts
- Code Layout

### Step 2: Milestone Execution Loop
For each milestone:
1. Explorer(s) deep dive on specific milestone requirements & design.
2. Worker implements code, runs build & test verification.
3. Reviewers (2) examine correctness, robustness, theme conformity, interface adherence.
4. Challengers (2) stress test edge cases, error conditions, offline/empty states.
5. Forensic Auditor verifies integrity (no fake payments, no mocked local confirmations, genuine backend calls).
6. Gate check: strict pass criteria before advancing.

### Step 3: Verification & Reporting
Verify full test pass (`npx expo export`, `npx tsc --noEmit`, `npm run lint`), compile final handoff and report to caller parent agent.
