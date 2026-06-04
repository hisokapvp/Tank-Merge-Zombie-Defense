/// <reference types="@capacitor/cli" />
/**
 * packaging/capacitor/capacitor.config.ts
 * solo-pipeline-yandex-vk#2 / Phase 3+4 — shared Capacitor project for
 * Android (Google Play) and iOS (App Store).
 *
 * The game runtime stays pure HTML5 Canvas + Phaser with no npm/build step.
 * This Capacitor project lives under packaging/ (the ONLY npm-allowed area)
 * and wraps the CLEAN native web bundle produced by
 *   packaging/scripts/build-web-bundle.mjs  ->  dist/native/web/
 *
 * webDir is relative to THIS config file (packaging/capacitor/), so it walks
 * up to the repo root: packaging/capacitor -> packaging -> repo-root.
 *
 * The native IAP backend (RevenueCat, unifying Google Play + App Store) is
 * injected into window.__TMZD_NATIVE_BRIDGE__ by packaging/capacitor/native-bridge.js
 * which the build scripts copy + wire into the synced web assets. Game.Platform
 * (src/platform/platform.js) consumes that bridge; the Yandex web path is left
 * untouched.
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tmzd.game',
  appName: 'Tank Merge Zombie Defense',
  // Relative to packaging/capacitor/ -> repo-root/dist/native/web.
  // build-android.mjs / build-ios.mjs regenerate this bundle before cap sync.
  webDir: '../../dist/native/web',
  // Bundled web assets are served from the app's own origin so relative
  // fetch('assets/...') resolves (plain file:// breaks fetch + relative paths,
  // exactly like the Electron app:// protocol in Phase 2).
  server: {
    androidScheme: 'https',
    iosScheme: 'tmzd',
  },
  android: {
    // Release AAB is signed via env/CLI keystore (see build-android.mjs).
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0b0e13',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      // Game is a fullscreen dark canvas; keep the bar overlay-light.
      style: 'DARK',
      backgroundColor: '#0b0e13',
      overlaysWebView: false,
    },
    // @revenuecat/purchases-capacitor reads its API key at runtime from
    // native-bridge.js (env-injected TMZD_REVENUECAT_* keys), not from config,
    // so the key never lands in version control.
  },
};

export default config;
