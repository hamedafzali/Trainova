# Trainova for iOS and Android

The native Trainova app, built with Expo (SDK 58) and React Native. It shares
the web app's domain logic and store: Metro compiles `../src` directly, so
workout rules, progression, PRs, sync and the coach are one codebase.

- `src/app/` — screens (Expo Router). Five tabs plus workout, template,
  program, exercise, history, coach, welcome and onboarding.
- `src/ui/` — the native kit and theme (light and dark, Trainova lime).
- `src/features/` — larger pieces: live set logging, rest timer and alerts,
  exercise browser, the 3D guide view, sync.
- `src/platform/` — native stand-ins for browser-only web modules (token auth
  in the keychain, library cache, haptics). `metro.config.js` swaps them in.
- `src/guide/` — the 3D movement guide. `scripts/build-guide.mjs` bundles
  `pixelwizards-gym-motion` into one offline HTML page for a WebView; it runs
  on `postinstall`.

## Run it

```bash
cd mobile
pnpm install
npx expo start          # then press i (iOS simulator) or a (Android emulator)
```

The app talks to `https://trainova.eu.cc` by default. Point it at another
server with `EXPO_PUBLIC_API_URL`, for example in `.env.local`:

```bash
EXPO_PUBLIC_API_URL=https://staging.example.com
```

The server must include the native-session change from this branch
(`x-trainova-client: native` returns the session token in `x-session-token`).

Guest mode works without any server: data stays on the phone.

Before committing:

```bash
npx tsc --noEmit
npx expo lint
```

Expo Go is fine for quick checks. A development build (see below) matches
the release app exactly, and is what to test notifications and sign-in on.

## Builds with EAS

EAS builds and signs in the cloud, so you don't need Xcode or Android Studio.
Run every command from `mobile/`.

1. Log in and link the project. `init` writes `extra.eas.projectId` to
   `app.json`; commit that change.

   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

2. Build. Each profile is defined in `eas.json`:

   | Profile | What you get |
   | --- | --- |
   | `development` | Dev client for phones (internal install) |
   | `development-simulator` | Dev client for the iOS Simulator |
   | `preview` | Release build for testers: an APK on Android, ad-hoc on iOS |
   | `production` | Store build, with the build number bumped automatically |

   ```bash
   npx eas-cli@latest build --profile preview --platform all
   npx eas-cli@latest build --profile production --platform all
   ```

   The first iOS build asks for your Apple account and creates the
   certificates and provisioning profile. Ad-hoc iOS builds need each tester's
   device registered first (`npx eas-cli@latest device:create`).

3. Submit:

   ```bash
   npx eas-cli@latest submit --platform ios --latest
   npx eas-cli@latest submit --platform android --latest
   ```

## Store checklist

Identifiers: bundle ID and package name are `eu.trainova.app` (in
`app.json`). Change them before the first store upload if you want different
ones; they can't be changed afterwards.

**Apple (App Store Connect)**

- Paid Apple Developer Program membership.
- Create the app record with bundle ID `eu.trainova.app`. `eas submit` can
  also create it for you.
- App privacy: the account email, plus workout data synced to the server for
  signed-in users. AI coaching sends training data to the AI provider only
  after the user agrees in the app.
- Account deletion is built in (Profile → Delete account), as Apple requires
  for apps that create accounts.
- Export compliance is already answered in `app.json`
  (`usesNonExemptEncryption: false`).
- Screenshots: 6.9" and 6.5" iPhone. The app is iPhone-only
  (`supportsTablet: false`).

**Google (Play Console)**

- Developer account, then create the app with package `eu.trainova.app`.
- Upload the first `.aab` by hand in the Play Console. Google requires this
  before the API can upload. After that, `eas submit` needs a Google service
  account JSON key. EAS walks you through it, and the key belongs in EAS, not
  in this repo.
- Fill in Data safety to match the Apple privacy answers above.
- New personal developer accounts must run a closed test (12 testers for 14
  days) before production access.

## What stays on the web

These work in the web app and aren't in the native app yet:

- admin, trainer tools and the trainer inbox;
- calendar, the volume heatmap and the body map;
- setting a new password (the app requests the reset email, and the link in
  it opens the website);
- creating custom exercises, and the AI swap and exercise-coach sheets;
- the shareable PNG workout recap;
- backup export/import, and the privacy and coach-link settings.

AI consent can be given in the app (Coach screen). Turning it back off is
done on the web (Profile → Privacy).
