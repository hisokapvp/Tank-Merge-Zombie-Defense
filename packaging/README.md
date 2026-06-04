# Native packaging toolchain (`packaging/`)

> solo-pipeline-yandex-vk#1 — native packaging for **Tank Merge Zombie Defense**.

This directory is the **only** place in the repo where `npm` / `package.json` /
a bundler are allowed. It is **outside** the game web bundle: `ci/build_release.mjs`
whitelists `src/ assets/ vendor/` + root files, so nothing under `packaging/`
ever ships to web or Yandex. The game runtime itself stays pure HTML5 Canvas +
Phaser with no build step.

## Layout

```
packaging/
  package.json              # npm scripts + electron/electron-builder/steamworks deps
  scripts/
    build-web-bundle.mjs     # Phase 1: npm-free wrapper over ci/build_release.mjs
  electron/
    main.js                  # Phase 2: Electron shell, app:// protocol, Steam IPC
    preload.js               # Phase 2: injects window.__TMZD_NATIVE_BRIDGE__
    electron-builder.yml     # Phase 2: win/mac/linux targets
  steam/
    app_build.vdf            # Phase 2: steamcmd depot upload template
```

## Phase 0 — platform abstraction (in the game, not here)

`src/platform/platform.js` exposes `Game.Platform`:
- `getEnv()` / `is(name)` — detects `yandex | electron | android | ios | web`.
- `getCapabilities()` — payments / cloudSave / fullscreen / exit / achievements / mobile.
- `getRenderConfig()` — `{ powerPreference, antialias, fpsTarget }`, merged into
  `src/phaser/phaserBootstrap.js` as a non-invasive render settings point.
- `Payments` / `CloudSave` / `Lifecycle` facades that delegate to the active
  backend: Yandex seam on web, `window.__TMZD_NATIVE_BRIDGE__` on native.

The native wrappers must inject `window.__TMZD_NATIVE_BRIDGE__` (see `preload.js`).

## Phase 1 — build the web bundle

```bash
# from repo root (Node only, no npm needed for this step)
node packaging/scripts/build-web-bundle.mjs           # -> dist/native/web/
node packaging/scripts/build-web-bundle.mjs --out X    # custom output dir
```

Produces a clean generic bundle (no Yandex SDK seam, unzipped) that the native
shells serve via the `app://` custom protocol so relative `fetch('assets/...')`
resolves correctly (plain `file://` breaks fetch + relative paths).

## Phase 2 — desktop (Electron + Steam)

```bash
cd packaging
npm install            # electron, electron-builder, steamworks.js
npm start              # build web bundle + run the Electron shell
npm run build:desktop  # build web bundle + electron-builder (current OS)
npm run build:win      # Windows nsis + portable
npm run build:mac      # macOS dmg
npm run build:linux    # Linux AppImage
```

Output: `dist/native/desktop/`.

### Steam integration scope

- **Achievements** — `bridge.achievements.unlock(id)` maps 1:1 to existing game
  achievement ids via `ISteamUserStats`.
- **Cloud saves** — `bridge.cloudSave.read/write` back `Game.Platform.CloudSave`
  with Steam Cloud (`ISteamRemoteStorage`).
- **Payments** — **DLC ownership only** (`bridge.payments.ownsDlc`). Consumable
  micro-transaction bundles are intentionally **not** included: `ISteamMicroTxn`
  requires a trusted backend, so only premium/DLC ownership ships in this phase.

Set the Steam App ID via `steam_appid.txt` next to the binary or the
`TMZD_STEAM_APPID` env var. The shell runs fine without the SDK present
(Steam features degrade gracefully and report `steamStatus`).

### Upload to Steam

1. Build the desktop target (`npm run build:win`).
2. Edit `steam/app_build.vdf` — set real `AppID` / Depot ID / `ContentRoot`.
3. Upload:
   ```
   steamcmd +login <builder_account> +run_app_build \
     "<abs>/packaging/steam/app_build.vdf" +quit
   ```

## Phase 3 — Android / Google Play (Capacitor + RevenueCat)

```
packaging/
  capacitor/
    capacitor.config.ts        # appId com.tmzd.game, webDir ../../dist/native/web
    revenuecat-products.json   # shop bundle id -> RevenueCat product id map
    native-bridge.js           # injects window.__TMZD_NATIVE_BRIDGE__ (mobile)
    codemagic.yaml             # Phase 4: cloud macOS build for iOS
  scripts/
    build-android.mjs          # web bundle -> cap sync -> inject bridge -> signed .aab
    build-ios.mjs              # web bundle -> cap sync -> inject bridge -> cloud build
```

```bash
cd packaging && npm install        # adds @capacitor/* + @revenuecat/purchases-capacitor
# from repo root:
node packaging/scripts/build-android.mjs              # signed AAB -> dist/native/android/
node packaging/scripts/build-android.mjs --debug      # unsigned debug AAB
node packaging/scripts/build-android.mjs --no-build    # prepare project, open in Android Studio
```

Signing + RevenueCat env (never committed): `TMZD_ANDROID_KEYSTORE`,
`TMZD_ANDROID_KEYSTORE_PASSWORD`, `TMZD_ANDROID_KEY_ALIAS`,
`TMZD_ANDROID_KEY_PASSWORD`, `TMZD_REVENUECAT_ANDROID_KEY`.

The bridge is injected **only** into the copied Capacitor assets, so
`dist/native/web/` stays the clean generic bundle and the Yandex web path is
never touched. Mobile gets **full consumable IAP** through RevenueCat (Google
Play + App Store unified), unlike the Steam DLC-only scope.

## Phase 4 — iOS / App Store (Capacitor + cloud macOS)

No local Mac: the archive/sign/upload runs on a Codemagic cloud macOS runner
(`packaging/capacitor/codemagic.yaml`). The cross-platform prep runs anywhere:

```bash
node packaging/scripts/build-ios.mjs --prepare-only    # web bundle + cap sync ios + bridge
node packaging/scripts/build-ios.mjs                   # prep + trigger cloud build (if env set)
```

Env: `TMZD_REVENUECAT_IOS_KEY`, and optionally `TMZD_CODEMAGIC_TOKEN` /
`TMZD_CODEMAGIC_APP_ID` to auto-trigger. Otherwise push a `ios-v*` git tag.

## Phase 5 — one-command release CLI

`ops/package/release.mjs` bumps the version, runs tests, builds the web bundle
and the per-platform artifact:

```bash
node ops/package/release.mjs web      --yandex        # web/Yandex bundle
node ops/package/release.mjs steam    --upload        # desktop + steamcmd upload
node ops/package/release.mjs android  --debug         # Android AAB
node ops/package/release.mjs ios      --prepare-only  # iOS cloud prep
node ops/package/release.mjs all                      # everything, in order
node ops/package/release.mjs web --bump 20260601-rc1  # explicit cache-bust token
```

## Полная инструкция

Подробное русскоязычное руководство (стоимость аккаунтов, prerequisites,
секреты, первый запуск на каждой платформе, монетизация и troubleshooting):
[`docs/PACKAGING.md`](../docs/PACKAGING.md).
