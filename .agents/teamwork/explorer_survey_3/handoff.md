# Handoff Report: Tooling, Build Verification & Environment Survey

**Agent**: `explorer_survey_3`  
**Archetype**: `teamwork_explorer`  
**Target Repository**: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`  
**Timestamp**: 2026-11-05T14:15:00Z  

---

## 1. Observation

### A. Core Package & Framework Versions (`package.json`)
File: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\package.json`
- **Application Name**: `"nirvahaapp"`, version `1.0.0`, main: `"index.js"`
- **Expo SDK**: `"expo": "~54.0.36"` (Expo SDK 54)
- **React**: `"19.1.0"`, **React DOM**: `"19.1.0"`
- **React Native**: `"0.81.5"`
- **TypeScript**: `"~5.9.2"`
- **Router / Navigation**:
  - `"expo-router": "~6.0.24"`
  - `"@react-navigation/native": "^7.1.8"`
  - `"@react-navigation/bottom-tabs": "^7.4.0"`
  - `"@react-navigation/elements": "^2.6.3"`
- **Firebase**:
  - `"firebase": "^12.12.1"` (modular Firebase JS SDK)
  - `"@react-native-firebase/app": "^25.1.0"`
  - `"@react-native-firebase/messaging": "^25.1.0"`
- **Notifications**:
  - `"expo-notifications": "~0.32.17"`
- **Icons**:
  - `"lucide-react-native": "^1.14.0"`
  - `"@expo/vector-icons": "^15.0.3"`
  - `"expo-symbols": "~1.0.8"`
- **UI & Animations**:
  - `"react-native-reanimated": "~4.1.1"`
  - `"react-native-worklets": "0.5.1"`
  - `"react-native-safe-area-context": "~5.6.0"`
  - `"react-native-screens": "~4.16.0"`
  - `"react-native-svg": "15.12.1"`
  - `"react-native-toast-message": "^2.3.3"`
  - `"expo-linear-gradient": "~15.0.8"`
  - `"expo-blur": "~15.0.8"`
  - `"expo-image": "~3.0.11"`
- **Networking**:
  - `axios` is **NOT** present in `dependencies`. Native `fetch` is used in the repository (`api/client.ts`).
- **Scripts**:
  - `"start": "expo start"`
  - `"build": "npx expo export --platform web"`
  - `"vercel-build": "npx expo export --platform web"`
  - `"reset-project": "node ./scripts/reset-project.js"`
  - `"android": "expo run:android"`
  - `"ios": "expo run:ios"`
  - `"web": "expo start --web"`
  - `"lint": "expo lint"`
  - **No test scripts** (no `npm test`, no Jest, Vitest, Detox, or Mocha).

### B. Configuration Files
1. **`tsconfig.json`**:
   - Extends: `"expo/tsconfig.base"`
   - Compiler options: `"strict": true`
   - Paths alias: `"@/*": ["./*"]`
   - Include: `["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]`
2. **`app.config.js`**:
   - Scheme: `"nirvahaapp"` (deep linking scheme)
   - Experiments:
     - `typedRoutes: true` (Expo Router typed routing is enforced)
     - `reactCompiler: true`
   - Android package: `"org.nirvaha.app"`
   - iOS bundle identifier: `"org.nirvaha.app"`
   - Extra properties explicitly expose:
     ```javascript
     extra: {
       eas: { projectId: "fee74e4b-51d9-4c95-a160-c11d63160417" },
       "EXPO_PUBLIC_API_BASE_URL": process.env.EXPO_PUBLIC_API_BASE_URL || "",
       "EXPO_PUBLIC_FIREBASE_API_KEY": process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
       ...
     }
     ```

### C. Environment Configuration
Files:
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\.env`
- `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\.env.example`

Variables present:
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `EXPO_PUBLIC_GROQ_API_KEY`
- `EXPO_PUBLIC_PIAPI_KEY`
- `EXPO_PUBLIC_API_BASE_URL=https://backend-six-lac-91.vercel.app`

Consumption pattern:
In `config/firebase.ts`, environment variables are read via:
```typescript
const expoExtra = Constants.expoConfig?.extra as Record<string, string> | undefined;
apiKey: expoExtra?.EXPO_PUBLIC_FIREBASE_API_KEY ?? process.env.EXPO_PUBLIC_FIREBASE_API_KEY
```
In Expo SDK 54, `process.env.EXPO_PUBLIC_*` is directly inlined into client JS bundles during Metro bundling.

### D. Testing Frameworks & Existing Test Files
- No automated unit test runner (Jest, Vitest, etc.) is configured in `package.json`.
- File search for `*test*` and `*spec*` revealed only manual/scratch test scripts:
  - `scratch\adversarial_test.js`
  - `scratch\adversarial_test.ts`
  - `scratch\test_onboarding.ts`

### E. Verification Command Execution Results

#### 1. `npx expo export --platform web` (Runs project `build` script)
- **Status**: **PASSED (Exit Code 0)**
- **Output**:
  - React Compiler enabled
  - Static rendering enabled
  - Metro bundled `index.js` (3473 modules) in 143s
  - Bundled `dist/_expo/static/js/web/index-08383cd755fbe0d5aae1fb1847a61561.js` (6.29 MB)
  - Successfully exported 44 static routes to `dist` directory.

#### 2. `npx expo export -p android` (Native Android bundling check)
- **Status**: **PASSED (Exit Code 0)**
- **Output**:
  - Metro bundled `index.js` (3753 modules) in 178s
  - Emitted 173 assets
  - Generated Hermes bytecode: `_expo/static/js/android/index-340569c746732c55f58794e00d61fa9f.hbc` (9 MB)
  - Exported to `dist` directory.

#### 3. `npx tsc --noEmit` (TypeScript Typecheck)
- **Status**: **FAILED (Exit Code 1) — 10 pre-existing errors in unrelated existing files**
- **Verbatim Error Output**:
  ```
  app/collection/category/[categoryId].tsx(116,30): error TS2339: Property 'imageUri' does not exist on type 'CollectionItem'.
  app/collection/category/[categoryId].tsx(161,30): error TS2339: Property 'imageUri' does not exist on type 'CollectionItem'.
  app/temple-of-balance/index.tsx(300,34): error TS2345: Argument of type '{ backgroundColor: string; borderColor: string; shadowColor: string; shadowOffset: { width: number; height: number; }; shadowOpacity: number; shadowRadius: number; elevation: number; }' is not assignable to parameter of type '{ flex: number; borderRadius: number; alignItems: "center"; justifyContent: "center"; borderWidth: number; }'.
  app/temple-of-balance/index.tsx(307,34): error TS2345: Argument of type '{ backgroundColor: string; borderColor: string; borderStyle: "dashed"; }' is not assignable to parameter of type '{ flex: number; borderRadius: number; alignItems: "center"; justifyContent: "center"; borderWidth: number; }'.
  app/temple-of-balance/index.tsx(309,34): error TS2345: Argument of type '{ backgroundColor: string; borderColor: string; }' is not assignable to parameter of type '{ flex: number; borderRadius: number; alignItems: "center"; justifyContent: "center"; borderWidth: number; }'.
  components/home/AncientCharacterCard.tsx(24,11): error TS17001: JSX elements cannot have multiple attributes with the same name.
  components/home/TempleOfBalanceCard.tsx(24,11): error TS17001: JSX elements cannot have multiple attributes with the same name.
  components/ui/collapsible.tsx(7,10): error TS2305: Module '"@/constants/theme"' has no exported member 'Colors'.
  config/firebase.ts(9,10): error TS2305: Module '"@firebase/auth"' has no exported member 'getReactNativePersistence'.
  hooks/use-theme-color.ts(6,10): error TS2305: Module '"@/constants/theme"' has no exported member 'Colors'.
  ```

#### 4. `npm run lint` (`npx expo lint`)
- **Status**: **FAILED (Exit Code 1) — 76 problems (13 errors, 63 warnings)**
- **13 Pre-existing Errors Breakdown (`npx eslint . --quiet`)**:
  - `app\coming-soon.tsx` (lines 50, 55, 59): unescaped single/double quotes (`react/no-unescaped-entities`)
  - `app\pages\ContactUs.tsx` (lines 65, 68): unescaped quotes (`react/no-unescaped-entities`)
  - `app\pages\DeletionPolicy.tsx` (lines 314, 316, 388): unescaped quotes (`react/no-unescaped-entities`)
  - `app\space\notifications.tsx` (line 122): unescaped quotes (`react/no-unescaped-entities`)
  - `app\wisdom-selfie\index.tsx` (line 92): unescaped quotes (`react/no-unescaped-entities`)
  - `components\home\AncientCharacterCard.tsx` (line 24): duplicate `style` prop (`react/jsx-no-duplicate-props`)
  - `components\home\TempleOfBalanceCard.tsx` (line 24): duplicate `style` prop (`react/jsx-no-duplicate-props`)

---

## 2. Logic Chain

1. **Build Integrity Baseline**:
   - Both `npx expo export --platform web` and `npx expo export -p android` execute cleanly with exit code 0.
   - This proves that Metro bundler, asset loaders, React Compiler, Babel/Hermes transformers, and native module bindings are functioning without runtime compilation failures.
   - Metro bundling is tolerant of TypeScript type errors during bundling (Metro relies on Babel/SWC transpilation without blocking on `tsc`), which is why the export succeeds even though `tsc` reports 10 errors.

2. **TypeScript & Lint Baseline**:
   - `npx tsc --noEmit` and `npm run lint` fail due to pre-existing code debt:
     - `constants/theme.ts` exports `export const theme = { ... }` rather than the default template `Colors`, causing `collapsible.tsx` and `use-theme-color.ts` to fail.
     - Two home cards have duplicate `style` JSX attributes on line 24.
     - `config/firebase.ts` has an unexported typing from `@firebase/auth`.
     - Miscellaneous quote escaping and type mismatches in existing screens (`temple-of-balance`, `collection`, `coming-soon`).
   - Therefore, any new code written for Events and Bookings must:
     a. Introduce **zero new TypeScript errors** in new files (`types/events.ts`, `types/bookings.ts`, `services/eventsService.ts`, `services/bookingsService.ts`, `app/events/*`, `components/home/EventsRail.tsx`).
     b. Fix the pre-existing errors if orchestrated, OR ensure strict delta verification so new code is 100% type-clean.

3. **HTTP & API Architecture**:
   - Because `axios` is absent from dependencies, services must use standard `fetch`, which is natively supported and already demonstrated in `api/client.ts`.
   - API URLs should be constructed using `process.env.EXPO_PUBLIC_API_BASE_URL` or `Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL`.

4. **Typed Routes & Deep Linking**:
   - `app.config.js` configures `scheme: "nirvahaapp"` and `typedRoutes: true`.
   - All event routes (`app/events/index.tsx`, `app/events/[id]/index.tsx`, `app/events/[id]/register.tsx`, `app/events/[id]/confirmation.tsx`, `app/events/my-bookings.tsx`) must be placed exactly under `app/` so Expo Router generates correct typed routes in `.expo/types`.
   - Deep links will follow `nirvahaapp://events/[id]`.

---

## 3. Caveats

1. **No Automated Unit Test Suite**: There is currently no Jest or Vitest infrastructure set up in `package.json`. Verification for new modules relies on TypeScript type checking (`tsc --noEmit`), Expo export bundling (`npx expo export`), and targeted unit/verification scripts.
2. **Pre-existing Errors vs Regressions**: Automated CI checks expecting zero errors on `tsc` or `lint` will fail unless the baseline pre-existing 10 TS errors and 13 lint errors are either fixed or scoped out of the delta check.
3. **Sandbox Permissions**: The parent workspace is configured at `admin_nirvaha`. Shell executions and tool calls targeting `NIRVAHA\Nirvaha` require elevated sandbox execution (`BypassSandbox: true` in powershell commands).

---

## 4. Conclusion

1. **Toolchain Health**: The build and bundling toolchain is fully healthy and verified on Expo SDK 54 (`npx expo export --platform web` and `npx expo export -p android` both exit 0).
2. **HTTP Client**: Use standard `fetch` with `process.env.EXPO_PUBLIC_API_BASE_URL ?? Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL`.
3. **Routing & Linking**: Follow Expo Router filesystem conventions under `app/events/` adhering to `typedRoutes: true` and deep-linking scheme `nirvahaapp`.
4. **Icons & UI**: Use `lucide-react-native` and `constants/theme.ts` (`theme.colors.*`, `theme.typography.*`).
5. **Quality Gate Guidance**:
   - Primary build verification command: `npx expo export --platform web` (must exit 0).
   - Secondary native bundling check: `npx expo export -p android` (must exit 0).
   - TypeScript verification: Check that new event/booking files have 0 TS errors via `npx tsc --noEmit`.

---

## 5. Verification Method

To independently verify these findings, run the following commands in `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`:

1. **Verify Expo Web Export (Project Build)**:
   ```powershell
   cd "C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha"; npx expo export --platform web
   ```
   *Expected result*: Exits 0, outputs 44 static routes into `dist/`.

2. **Verify Expo Android Native Bundling**:
   ```powershell
   cd "C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha"; npx expo export -p android
   ```
   *Expected result*: Exits 0, outputs Hermes bytecode bundle into `dist/`.

3. **Verify TypeScript Baseline (10 pre-existing errors)**:
   ```powershell
   cd "C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha"; npx tsc --noEmit
   ```
   *Expected result*: Exits 1 with the exact 10 errors noted in Section 1.E.3.

4. **Verify ESLint Baseline (13 errors, 63 warnings)**:
   ```powershell
   cd "C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha"; npx eslint . --quiet
   ```
   *Expected result*: Exits 1 with the exact 13 errors in `coming-soon.tsx`, `ContactUs.tsx`, `DeletionPolicy.tsx`, `notifications.tsx`, `wisdom-selfie`, and 2 home cards.
