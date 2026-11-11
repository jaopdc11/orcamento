# Orçamento — Android app

Thin Capacitor shell that opens the live site (`https://orcamento.jaopd.dev`) in a WebView.
Front-end deploys show up in the app with no rebuild; a new APK is only needed when the native
code changes. Distributed as a signed APK only (no Play Store).

## What the native side does

- **Navigation:** the site runs inside the WebView without `server.allowNavigation`, so it never
  gets access to the Capacitor bridge (`NavegacaoPlugin`). Other domains open in the browser.
- **App lock:** fingerprint or device PIN/pattern on cold start and after more than 5 minutes in
  the background (`Trava`). Local only; it does not replace the e-mail code login.
- **Push (FCM):** the native code reads the WebView session cookie for the API and calls
  `POST /push/fcm` with the site `Origin` (`Avisos`). The API ties the token to that session, so
  logging out on the site stops notifications on that device.
- Edge-to-edge insets, back button through WebView history, no backup of app data.

## Setup

1. Firebase: create an Android app with id `dev.jaopd.orcamento` and drop
   `google-services.json` in `android/app/` (git-ignored). Without it the app builds and runs,
   just without push.
2. Server: generate a service-account key in the same Firebase project, copy it to the VPS and set
   `FCM_CONTA_SERVICO=/path/to/key.json` in the API environment.
3. Signing: `keys/` holds the keystore that signs every release (versioned on purpose, so any machine builds an APK that updates the installed one). It is a personal app for two phones; there is no store account to protect.

## Build

```sh
npm install
npm run apk   # android/app/build/outputs/apk/release/app-release.apk
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Always judge smoothness on the release build (baseline profiles via `profileinstaller` only apply
there). Check offline behaviour once on a real device: open the app, then reopen in airplane mode.
