# Mobile plan

Trainova ships today as an installable PWA. This plan describes how to get it
into the app stores without forking the codebase, and what has to be true
before each step.

## Where we are

- **Installable PWA:** `public/manifest.webmanifest`, standalone display,
  maskable icons, Apple web-app meta in `src/app/layout.tsx`.
- **Offline:** logging and progress run entirely on the device.
  `public/sw.js` keeps the app shell loadable with no network.
- **Phone-first layout:** a 5-tab bottom bar, safe-area insets on bars and
  sheets, 44 px touch targets, haptics through `navigator.vibrate` (Android
  only), and a full-screen live workout.
- **Data:** stored in `localStorage`. An account syncs it.

Current limits:

- **iOS storage:** iOS Safari may evict `localStorage` for sites that go
  unused for weeks, unless the app was added to the Home Screen. A guest
  with no account can lose data that way.
- **No push:** rest timers and reminders work only while the app is open.
- **No health data:** no access to HealthKit or Health Connect.
- **Not in the stores:** some users only find apps through the stores.

## Phase 1: harden the PWA (no new platform)

1. **Account nudge:** prompt guests to back up or sign in after the third
   workout. Flag the eviction risk on iOS when the app isn't installed.
2. **Durable storage:** request persistent storage
   (`navigator.storage.persist()`) and show the result in Profile → Your
   data.
3. **Larger local store:** move the store from `localStorage` to IndexedDB
   (Zustand persist with an async storage). The current ~5 MB ceiling is the
   limit for years of sets.
4. **Wake lock:** keep the screen on during a live workout (Wake Lock API,
   where it's supported).
5. **Web push** (iOS 16.4+ for installed apps, and Android) for the rest
   timer finishing and for workout reminders. Needs VAPID keys and a
   `push_subscriptions` table.

Exit criteria: no reported data loss for guests, and push works on an
installed iPhone and an Android phone.

## Phase 2: store builds with Capacitor

Wrap the same web app in Capacitor, rather than rewriting in React Native,
for three reasons:

- **One codebase:** the domain logic, the UI and the tests stay single.
- **Free updates:** web changes reach the app without store review, for
  anything that isn't native code.
- **Fit:** the app is already offline-first and touch-sized.

How:

- **Loading strategy:** decide between a static export and a remote shell.
  The app depends on server routes (`/api/*`), so start with a bundled
  offline shell that calls the hosted API, and avoid a thin
  remote-URL wrapper. Apple rejects pure web wrappers under guideline 4.2,
  and a bundled shell keeps the app usable offline.
- **Auth:** the cookie session needs the API on the same site. Otherwise add
  a token transport for the native app, stored in the Keychain or Keystore
  and never in JavaScript storage.
- **Native plugins:** haptics (iOS has none today), local notifications for
  the rest timer, keep-awake, and the status bar.
- **Accounts:** in-app account deletion already exists, which Apple
  requires.
- **Store listing:** the privacy labels must match `docs/AI.md`: data sent to
  the AI provider only with consent, nothing used for ads.

Exit criteria: TestFlight and an internal Play track pass a two-week workout
diary on real devices.

## Phase 3: native features

- **Health data:** HealthKit / Health Connect write-back of workouts and
  bodyweight, plus a bodyweight read to fill in the body log.
- **Watch:** an Apple Watch / Wear OS companion for set logging and the rest
  timer. This is a separate native project, so take it on only once Phase 2
  retention justifies it.
- **Widgets:** a home-screen widget showing the next workout and the streak.

## Not planned

- **React Native or Flutter rewrite:** it would duplicate the domain logic
  and the test suite with little gain for this kind of app.
- **Paid features:** none until store billing rules and a subscription model
  are decided.
