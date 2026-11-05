# Handoff Report: Nirvaha Mobile Architecture & Existing Systems Survey

**Agent**: `explorer_survey_2` (archetype: `teamwork_explorer`)  
**Working Directory**: `c:\Users\sai pallavi\OneDrive\Desktop\AKASH\admin_nirvaha\.agents\teamwork\explorer_survey_2`  
**Target Codebase**: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha`  
**Timestamp**: 2026-11-05T14:15:00Z  
**Type**: Hard Handoff (Mobile Architecture Survey Complete)

---

## 1. Observation

Direct observations from the mobile codebase across themes, push notifications, navigation, authentication, and services:

### 1.1 Theme & Design Tokens (`constants/theme.ts`)
- **File**: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\constants\theme.ts` (Lines 1–21)
- Verbatim code content:
  ```typescript
  export const theme = {
    colors: {
      background: '#f8f6f0', // Warm beige background
      backgroundGradientEnd: '#e6ede8', // Light greenish gradient end
      foreground: '#2A3B32', // Dark text
      mutedForeground: '#5A6E63', // Subdued text
      primary: '#2D5A4C', // Healing green for buttons
      primaryForeground: '#FFFFFF',
      healingGreen: '#2D5A4C',
      healingGreenLight: '#A3BDB1',
      gold: '#D4AF37', // Gold for particles/glow
      border: '#C0CEC6',
      error: '#EF4444',
    },
    typography: {
      display: 'PlayfairDisplay_400Regular',
      body: 'Inter_400Regular',
      bodyMedium: 'Inter_500Medium',
    },
  };
  ```
- **Dual Surface Aesthetic Observed**:
  - Main app surfaces (`app/(tabs)/index.tsx`, `app/profile.tsx`, `app/(tabs)/_layout.tsx`) use a dark theme container with background `#0A0A0A` and high-contrast cards (`rgba(255, 255, 255, 0.03)` to `rgba(255, 255, 255, 0.08)` borders, gold badge accents `rgba(235, 185, 80, 0.95)` / `#D4AF37`).
  - Auth, Onboarding, and dialog sheets use the warm beige palette (`#f8f6f0` background, `#EEF1EB` glass cards, `#2A3B32` text, `#5A6E63` muted labels).
  - Fonts loaded in root `_layout.tsx`: `PlayfairDisplay_400Regular` (editorial serif for titles) and `Inter_400Regular` / `Inter_500Medium` (clean modern sans for body/actions).

### 1.2 Layout & Safe Area System (`components/ui/ScreenContainer.tsx`)
- **File**: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\components\ui\ScreenContainer.tsx` (Lines 1–157)
- Layout tokens defined:
  ```typescript
  export const LAYOUT_TOKENS = {
    BOTTOM_NAV_HEIGHT: 60,
    BOTTOM_NAV_MARGIN: 20,
    CONTENT_PADDING: 16,
    GAP_PADDING: 20,
  };
  ```
- Safe area calculation:
  - Uses `useSafeAreaInsets()` from `react-native-safe-area-context`.
  - Dynamic bottom padding for screens with bottom tabs (`hasBottomTab={true}`):
    ```typescript
    const navBottomOffset = Math.max(LAYOUT_TOKENS.BOTTOM_NAV_MARGIN, insets.bottom + 4);
    const tabPadding = hasBottomTab 
      ? (navBottomOffset + LAYOUT_TOKENS.BOTTOM_NAV_HEIGHT + LAYOUT_TOKENS.GAP_PADDING) 
      : 0;
    const baseBottomInset = (!hasBottomTab && edges.includes('bottom')) ? insets.bottom : 0;
    const totalBottomPadding = baseBottomInset + tabPadding;
    ```
  - Floating bottom navigation position in `components/navigation/BottomNav.tsx`:
    `bottom: Math.max(LAYOUT_TOKENS.BOTTOM_NAV_MARGIN, insets.bottom + 4)`
    Guarantees floating above Android 3-button navigation and iOS gesture home bars without clipping.

### 1.3 Push Notifications & Deep Link Routing (`services/pushNotifications.ts`)
- **File**: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\services\pushNotifications.ts` (Lines 1–160)
- Lifecycle initialization:
  - Invoked once in `app/_layout.tsx` (Lines 29–36):
    ```typescript
    useEffect(() => {
      const unsubscribe = initializePushNotifications(router);
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }, [router]);
    ```
  - Configures foreground presentation handler via `Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) })`.
  - Android notification channel created: `'nirvaha_general_broadcast'` with `importance: MAX`, `lightColor: '#FF231F7C'`. Matches backend channel ID in `admin_nirvaha/app/api/notifications/send/route.ts` line 83.
  - Subscribes device to `'all_users'` topic: `await messaging().subscribeToTopic('all_users')`.
  - Existing deep link logic in `handleDeepLink`:
    ```typescript
    const handleDeepLink = (remoteMessage: any) => {
      const deepLink = remoteMessage?.data?.deepLink;
      if (deepLink) {
        let targetRoute = '';
        if (deepLink.startsWith('nirvaha://')) {
          const routeName = deepLink.replace('nirvaha://', '');
          if (routeName === 'music') targetRoute = '/collection';
          else if (routeName === 'sleep') targetRoute = '/(tabs)/wellness';
          else if (routeName === 'ai' || routeName === 'companions') targetRoute = '/chat';
          else targetRoute = `/${routeName}`;
        } else {
          targetRoute = deepLink;
        }
        if (targetRoute) router.push(targetRoute as any);
      }
    };
    ```
  - Existing listeners:
    - Foreground FCM receive: `messaging().onMessage` (schedules local notification with `Notifications.scheduleNotificationAsync`).
    - Background notification click: `messaging().onNotificationOpenedApp(remoteMessage => handleDeepLink(remoteMessage))`.
    - Cold launch notification click: `messaging().getInitialNotification().then(remoteMessage => handleDeepLink(remoteMessage))`.
- **Architectural Gaps Discovered in Notification Handling**:
  1. *Foreground Click Gap*: In foreground, `messaging().onMessage` triggers `Notifications.scheduleNotificationAsync`. When the user taps this banner, the OS hands the event to Expo Notifications, NOT `@react-native-firebase/messaging`. Because `Notifications.addNotificationResponseReceivedListener` is missing, foreground banner taps currently do not route!
  2. *Scheme Mismatch*: `app.config.js` configures `scheme: "nirvahaapp"`, while `pushNotifications.ts` only strips `nirvaha://`. Deep links using `nirvahaapp://events/[id]` or relative paths `/events/[id]` must be normalized cleanly.

### 1.4 Navigation Hierarchy (`app/`)
- Root Layout (`app/_layout.tsx`):
  - Wraps tree in `GestureHandlerRootView`, `SafeAreaProvider`, `AuthProvider`, and `ConsentGate`.
  - Global route guard in `RootLayoutNav`:
    ```typescript
    const firstSegment = segments[0] as string | undefined;
    const inAuthGroup = firstSegment === 'pages';
    const isIndex = !firstSegment || firstSegment === 'index';
    if (!user && !inAuthGroup && !isIndex) {
      router.replace('/pages/Auth');
    }
    ```
    *Rule*: Any route outside `pages` and `index` strictly requires user authentication.
  - Stack Screens currently defined: `index`, `(tabs)`, `pages`, `sound-healing`, `space`, `wisdom-selfie`, `ancient-character-quiz`, `temple-of-balance`.
- Tab Structure (`app/(tabs)/_layout.tsx`):
  - Uses `<Slot />` with floating `BottomNav`.
  - Nav items: Home (`/(tabs)`), Chat (`/chat`), Collection (`/collection`), Profile (`/profile`).
- Home Screen (`app/(tabs)/index.tsx`):
  - Composed of vertical scrolling sections wrapped in `ScreenContainer`:
    `GreetingHeader` -> `EmotionChips` -> `HeroCarousel` -> `CompanionRail` -> `CollectionRail` -> `SoundRail` -> `CompactTilesGrid` -> `AncientPlacesCard` -> `AncientCharacterCard` -> `TempleOfBalanceCard` -> `SmartActions`.
  - Section standard: Each rail component handles its own animated entrance (`Animated.View entering={FadeInDown}`), section header (`title`, `subtitle`, `View All` button with `ChevronRight`), and horizontal `ScrollView` (`showsHorizontalScrollIndicator={false}`, `contentContainerStyle: { paddingHorizontal: 20, gap: 12 }`).
- Profile / Account Screen (`app/profile.tsx` & `components/profile/SettingsSection.tsx`):
  - `ProfileScreen` renders `ProfileHeader`, `JourneyCard`, `PersonalStats`, `SettingsSection`, and `BottomNav`.
  - `SettingsSection.tsx` contains `quickActions` and `menuList` (`Contact Us`, `Deletion Policy`).
  - This is the exact, natural location for the "My Bookings" menu link (`onPress={() => router.push('/events/my-bookings')}`).

### 1.5 Authentication & User State (`contexts/AuthContext.tsx` & `config/firebase.ts`)
- **File**: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\contexts\AuthContext.tsx` (Lines 1–90)
- Core context signature:
  ```typescript
  interface AuthContextType {
    user: User | null;
    profileName: string | null;
    isLoading: boolean;
    updateProfileState: (newName: string) => Promise<void>;
  }
  ```
- Firebase client initialization in `config/firebase.ts`:
  - Uses `firebase/app`, `firebase/auth` with `getReactNativePersistence(AsyncStorage)`, and `firebase/firestore`.
  - Exports `{ auth, db }`.
- Auth token acquisition for API calls:
  - `user.uid` provides the current authenticated user's ID.
  - `user.email` provides user email.
  - `await user.getIdToken()` or `await auth.currentUser?.getIdToken()` retrieves a valid Firebase JWT ID token.
  - Token is passed to backend HTTP endpoints via `Authorization: Bearer ${token}`.
  - Server-side verification is performed by Firebase Admin SDK (`adminAuth.verifyIdToken(token)`).

### 1.6 API & Backend Configuration (`.env`, `app.config.js`)
- **File**: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\.env`
  - `EXPO_PUBLIC_API_BASE_URL=https://backend-six-lac-91.vercel.app`
  - Firebase config: API key, auth domain, project ID (`nirvaha-8a8e4`), storage bucket, messaging sender ID (`883506827772`), app ID.
- **File**: `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\app.config.js`
  - Injects `EXPO_PUBLIC_API_BASE_URL` into `extra` and runtime environment.
  - `experiments: { typedRoutes: true, reactCompiler: true }`.

---

## 2. Logic Chain

1. **Aesthetic Consistency**: Nirvaha uses an established dark aesthetic (`#0A0A0A`) for content exploration surfaces (Home, Rails, Profile, Media) with warm beige (`#f8f6f0`) and gold accents (`#D4AF37`) for cards, badges, and modal dialogs. Events discovery and event details must respect this dual surface paradigm.
2. **Safe Area & Bottom Insets**: Because Nirvaha features a floating bottom navigation pill (`BottomNav.tsx`) with dynamic bottom margin `Math.max(20, insets.bottom + 4)` and height 60, all tab-level and standalone scrollable screens must use `ScreenContainer` or compute `paddingBottom` using `LAYOUT_TOKENS` to ensure cards and primary action buttons are never obscured.
3. **Data Access Architecture & Integrity**:
   - `EventDocument` discovery reads can query `GET /api/events` or Firestore `collection(db, 'events')` directly (if security rules permit read of `published` events).
   - In-app booking creation (`POST /api/bookings`) and booking cancellation (`POST /api/bookings/[id]/cancel`) MUST NEVER be executed directly against Firestore from the mobile client. They must submit to Team 1's backend server endpoints with `Authorization: Bearer <id_token>` to guarantee atomic transactional capacity enforcement, duplicate booking prevention, and server-generated booking references (`NIR-EVT-YYYY-XXXXXX`).
4. **Listing Type Action Logic**:
   - `advertisement`: Display full details, schedule, location. Primary CTA is omitted or configured as an external URL opener (e.g. sponsor link).
   - `external_registration`: Primary CTA is "Register Externally", opening `Linking.openURL(event.location.meetingUrl || event.bookingConfig.externalUrl)` via browser. No in-app booking record is created.
   - `free_booking`: Primary CTA is "Book Free" / "Register". Opens in-app form at `/events/[id]/register`, validates fields, submits to `POST /api/bookings`, navigates to `/events/[id]/confirmation` upon 201 Created.
   - `paid_booking`: Strictly non-functional for booking. Must display pricing details but render the primary button in a disabled state ("Booking Currently Unavailable") until Team 1 confirms live payment gateway credentials. No mock payment screens.
5. **Notification & Deep Link Synthesis**:
   - Notifications dispatched by Team 1's admin route (`app/api/notifications/send/route.ts`) attach `data: { deepLink: "nirvaha://events/[id]" }`.
   - `services/pushNotifications.ts` must be extended non-disruptively to:
     - Normalize deep links supporting `nirvaha://`, `nirvahaapp://`, and relative `/events/[id]`.
     - Add `Notifications.addNotificationResponseReceivedListener` so foreground notification banner clicks trigger navigation.
     - Support cold boot, background resume, and foreground reception without duplicate listeners.

---

## 3. Caveats

1. **Direct Firestore Reads vs API Endpoints**: While Team 1's backend provides `GET /api/events`, network resilience can also utilize Firestore direct reads for published events if Firestore client rules permit `allow read: if resource.data.publicationStatus in ['published', 'featured'];`. However, `services/eventsService.ts` should prefer the backend API base URL with fallback to Firestore.
2. **Payment Integration Staged Out**: Payment processing is strictly blocked per specifications. The mobile app must treat `listingType === 'paid_booking'` as disabled and must not simulate successful payment.
3. **TypeScript Route Typing**: Expo Router uses `typedRoutes: true`. All `router.push()` calls to newly introduced routes (`/events`, `/events/[id]`, `/events/[id]/register`, `/events/[id]/confirmation`, `/events/my-bookings`) should be properly typed or cast (`as any`) until Expo Router generates route type definitions during build.

---

## 4. Conclusion & Mobile Architecture Blueprint

### 4.1 Required File Structure for Events & Bookings

```
C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\
├── types/
│   ├── events.ts              # EventDocument, EventCategory, EventListingType, EventPublicationStatus
│   └── bookings.ts            # BookingDocument, BookingStatus, AttendeeDetail, PaymentStatus
├── services/
│   ├── eventsService.ts       # fetchEvents, fetchEventById, fetchFeaturedEvents (using API / Firestore)
│   ├── bookingsService.ts     # createBooking, fetchMyBookings, cancelBooking (authenticated fetch)
│   └── pushNotifications.ts   # Enhanced deep link normalization + foreground response listener
├── components/
│   ├── home/
│   │   └── EventsRail.tsx     # Horizontal rail for Home screen (app/(tabs)/index.tsx)
│   ├── events/
│   │   ├── EventCard.tsx      # Card for discovery list & rail
│   │   ├── CategoryChips.tsx  # Horizontal filter chips (Yoga, Meditation, Sound Healing, etc.)
│   │   └── StatusBadge.tsx    # Published, Sold Out, Closed, Cancelled status badges
│   └── profile/
│       └── SettingsSection.tsx# Updated with "My Bookings" navigation entry
└── app/
    ├── (tabs)/
    │   └── index.tsx          # Insert EventsRail between HeroCarousel / CollectionRail
    └── events/
        ├── index.tsx          # Discovery: search, category filters, featured list
        ├── my-bookings.tsx    # User's bookings list with status, reference, joining details
        └── [id]/
            ├── index.tsx      # Event details screen with dynamic primary CTA
            ├── register.tsx   # In-app registration form with validation & duplicate prevention
            └── confirmation.tsx # Booking success confirmation with server booking reference
```

### 4.2 Exact Integration Points

1. **`services/pushNotifications.ts` Enhancement**:
   - Enhance `handleDeepLink`:
     ```typescript
     export function parseDeepLink(rawLink: string): string {
       if (!rawLink) return '';
       let route = rawLink.trim();
       if (route.startsWith('nirvaha://')) route = route.replace('nirvaha://', '/');
       else if (route.startsWith('nirvahaapp://')) route = route.replace('nirvahaapp://', '/');
       if (!route.startsWith('/')) route = `/${route}`;
       
       // Handle legacy aliases
       if (route === '/music') return '/collection';
       if (route === '/sleep') return '/(tabs)/wellness';
       if (route === '/ai' || route === '/companions') return '/chat';
       return route;
     }
     ```
   - Add Expo response listener in `initializePushNotifications`:
     ```typescript
     const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
       const deepLink = response.notification.request.content.data?.deepLink;
       if (deepLink) {
         const target = parseDeepLink(deepLink);
         if (target) router.push(target as any);
       }
     });
     // Clean up in return: responseSubscription.remove();
     ```

2. **`components/home/EventsRail.tsx` in `app/(tabs)/index.tsx`**:
   - Insert right after `<HeroCarousel />` and `<CompanionRail />` before `<CollectionRail />`.
   - Adhere strictly to the styling in `components/home/CollectionRail.tsx`:
     - Section Title: `PlayfairDisplay_400Regular`, font size 18, color `#FFFFFF`.
     - Subtitle: `Inter_400Regular`, font size 12, color `rgba(255,255,255,0.6)`.
     - View All Button: Gold border and text (`theme.colors.gold`), navigating to `/events`.
     - Card width: ~220px, height: ~160px with `expo-image` cover, gradient overlay, category tag, date/time pill, and title.

3. **`components/profile/SettingsSection.tsx`**:
   - Add "My Bookings" row to `menuList` directly before "Contact Us":
     ```tsx
     <Pressable 
       style={styles.menuItem}
       onPress={() => router.push('/events/my-bookings' as any)}
     >
       <View style={styles.menuItemLeft}>
         <Calendar size={16} color="rgba(255,255,255,0.6)" />
         <Text style={styles.menuItemText}>My Bookings</Text>
       </View>
       <ChevronRight size={14} color="rgba(255,255,255,0.3)" />
     </Pressable>
     ```

4. **Authentication & Token Passing in `services/bookingsService.ts`**:
   - Import `auth` from `../config/firebase`.
   - Before each HTTP request:
     ```typescript
     const user = auth.currentUser;
     if (!user) throw new Error('Authentication required. Please sign in.');
     const token = await user.getIdToken();
     const headers = {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${token}`,
     };
     ```
   - Target endpoints:
     - `POST ${API_BASE_URL}/api/bookings`
     - `GET ${API_BASE_URL}/api/bookings?userId=${user.uid}`
     - `GET ${API_BASE_URL}/api/bookings/${bookingId}`
     - `POST ${API_BASE_URL}/api/bookings/${bookingId}/cancel`

---

## 5. Verification Method

To verify these architectural findings independently:
1. **Theme Verification**: Inspect `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\constants\theme.ts` lines 1–21 to confirm color palette and typography keys.
2. **Layout Insets Verification**: Inspect `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\components\ui\ScreenContainer.tsx` lines 50–90 to confirm `LAYOUT_TOKENS` and dynamic bottom padding calculation.
3. **Notification Verification**: Inspect `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\services\pushNotifications.ts` lines 95–160 to confirm FCM topic subscription, deep link parsing, and listener registration.
4. **Auth Token Verification**: Inspect `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\contexts\AuthContext.tsx` and test `auth.currentUser?.getIdToken()` against Firebase client SDK.
5. **Route Guard Verification**: Inspect `C:\Users\sai pallavi\OneDrive\Desktop\AKASH\NIRVAHA\Nirvaha\app\_layout.tsx` lines 38–51 to confirm that routes outside `pages` and `index` automatically redirect unauthenticated users to `/pages/Auth`.
