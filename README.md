# Reporter App

A native mobile app (iOS/Android) for field salespersons to record daily
travel, customer visits, and feedback. Built with Expo + React Native
(Expo Router, React Native Paper), backed by Google Sheets through a Google
Apps Script Web App.

## Features

- **Settings** — salesperson name, employee ID, mobile number, saved on the
  device and auto-filled on every report.
- **Master data** — Customer and Stay Location lists, synced to Google
  Sheets, cached locally for offline use in the visit form's autocomplete
  fields.
- **Daily Visit Report** — dynamic list of visits per day; departure/arrival
  distance is captured automatically from GPS (via `expo-location` +
  `geolib`), not typed in.
- **Voice-to-text** — a mic button on the Key Feedback field points you to
  the phone keyboard's own dictation button (see [Voice input](#voice-input)
  below); the field is always fully editable by typing too.
- **Offline-first** — all data lives on-device first (AsyncStorage via a
  Zustand store). Reports submitted while offline are queued as "pending
  sync" and retried automatically once the backend is reachable.
- **Reports** — search by date/salesperson/customer, view a customer's visit
  history, export results to Excel (`.xlsx`, shared via the OS share sheet).
- **Dashboard** — visits today, distance today, customers visited,
  follow-ups required, plus weekly/monthly summary charts.

## Getting started

```bash
npm install
npx expo start
```

Press `i` for the iOS Simulator, `a` for an Android emulator, or scan the QR
code with Expo Go on a physical device.

The app works fully offline out of the box (data stays on-device). To sync
with Google Sheets, follow [google-apps-script/SETUP.md](./google-apps-script/SETUP.md)
and set `EXPO_PUBLIC_APPS_SCRIPT_URL` in `.env.local` (see `.env.example`),
then restart with `npx expo start -c`.

## Voice input

There's no in-app speech-to-text: the community module that provides it
needs a native module that only exists in a custom dev build, and even a
guarded reference to it crashes in Expo Go (React Native's global error
handler intercepts the missing-native-module error before JS-level
try/catch can run). Instead, tapping the mic icon on the Key Feedback field
shows a hint to use the phone keyboard's own dictation button, which works
everywhere — Expo Go, a dev build, iOS, or Android — with no extra setup.

## Project structure

```
src/app/             Screens (Expo Router: tabs = Dashboard, New Visit, Reports, Masters, Settings)
src/components/       Shared UI (VisitRowCard, VoiceTextField, AutocompleteField, MasterList)
src/lib/              Zustand store, Apps Script client, GPS/distance, dashboard math, Excel export
google-apps-script/   Code.gs (the Sheets backend) + setup instructions
```

## Notes

- Distance is only calculated once both a departure and arrival GPS point
  have been captured for a visit row; manual entry is intentionally not
  offered, per the GPS-tracking requirement.
- One report is kept per salesperson per day (matching the paper form this
  app replaces) — reopening a date loads that day's visits for editing until
  it's marked submitted.
- This project intentionally has no `ios/`/`android/` native folders
  checked in (they're gitignored); running `npx expo run:ios` or
  `run:android` generates them on demand for a dev build.
