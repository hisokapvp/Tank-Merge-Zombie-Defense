#!/usr/bin/env node
/**
 * packaging/scripts/build-android.mjs
 * solo-pipeline-yandex-vk#2 / Phase 3 — Android / Google Play (Capacitor).
 *
 * One command to go from the npm-free game source to a signed Android App
 * Bundle (.aab) in dist/native/android/:
 *
 *   1. build the CLEAN web bundle           -> dist/native/web/   (npm-free)
 *   2. ensure the Capacitor android platform exists (npx cap add android)
 *   3. npx cap sync android                 (copy webDir + plugins)
 *   4. inject window.__TMZD_NATIVE_BRIDGE__  into the COPIED android assets
 *      (RevenueCat mobile backend) — dist/native/web stays clean & generic
 *   5. gradle bundleRelease (signed via env keystore)
 *   6. copy the .aab into dist/native/android/
 *
 * npm/@capacitor/* live ONLY in packaging/package.json. Run from anywhere:
 *   node packaging/scripts/build-android.mjs [--skip-tests] [--debug] [--no-build]
 *
 * Env for release signing (never committed):
 *   TMZD_ANDROID_KEYSTORE          absolute path to the .jks/.keystore
 *   TMZD_ANDROID_KEYSTORE_PASSWORD store password
 *   TMZD_ANDROID_KEY_ALIAS         key alias
 *   TMZD_ANDROID_KEY_PASSWORD      key password
 *   TMZD_REVENUECAT_ANDROID_KEY    RevenueCat public SDK key (Google Play)
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PKG_DIR = path.resolve(__dirname, '..');            // packaging/
const CAP_DIR = path.join(PKG_DIR, 'capacitor');          // packaging/capacitor/
const WEB_OUT = path.join(REPO_ROOT, 'dist', 'native', 'web');
const ANDROID_DIR = path.join(CAP_DIR, 'android');
const PUBLIC_DIR = path.join(ANDROID_DIR, 'app', 'src', 'main', 'assets', 'public');
const DIST_ANDROID = path.join(REPO_ROOT, 'dist', 'native', 'android');
const isWin = process.platform === 'win32';

function parseArgs(argv) {
  const a = { skipTests: false, debug: false, noBuild: false };
  for (const x of argv) {
    if (x === '--skip-tests') a.skipTests = true;
    else if (x === '--debug') a.debug = true;
    else if (x === '--no-build') a.noBuild = true;
    else if (x === '--help' || x === '-h') {
      process.stdout.write('Usage: node packaging/scripts/build-android.mjs [--skip-tests] [--debug] [--no-build]\n');
      process.exit(0);
    } else throw new Error(`Unknown flag: ${x}`);
  }
  return a;
}

function run(cmd, args, cwd) {
  console.log(`[build-android] $ ${cmd} ${args.join(' ')}  (cwd=${cwd})`);
  // With shell:true on Windows the command line is re-parsed by cmd.exe, so any
  // path containing spaces (e.g. "C:\Program Files\nodejs\node.exe") must be
  // double-quoted or it splits on the space. Quote cmd/args that need it.
  const q = (s) => (isWin && /[\s&()[\]{}^=;!'+,`~]/.test(s) ? `"${s}"` : s);
  const finalCmd = isWin ? q(cmd) : cmd;
  const finalArgs = isWin ? args.map(q) : args;
  const res = spawnSync(finalCmd, finalArgs, { cwd, stdio: 'inherit', shell: isWin });
  if (res.status !== 0) {
    console.error(`[build-android] FAILED: ${cmd} (exit ${res.status})`);
    process.exit(res.status || 1);
  }
}

function npx(args, cwd) { run(isWin ? 'npx.cmd' : 'npx', args, cwd); }

function buildWebBundle() {
  console.log('[build-android] (1/6) building clean web bundle -> dist/native/web');
  run(process.execPath, [path.join(PKG_DIR, 'scripts', 'build-web-bundle.mjs')], REPO_ROOT);
}

function runTests() {
  console.log('[build-android] running regression tests (bash ci/run_tests.sh)');
  run(isWin ? 'bash' : 'bash', ['ci/run_tests.sh'], REPO_ROOT);
}

function ensureAndroidPlatform() {
  if (fs.existsSync(ANDROID_DIR)) {
    console.log('[build-android] (2/6) android platform present');
    return;
  }
  console.log('[build-android] (2/6) adding android platform (npx cap add android)');
  npx(['cap', 'add', 'android'], CAP_DIR);
}

function syncAndroid() {
  console.log('[build-android] (3/6) npx cap sync android');
  npx(['cap', 'sync', 'android'], CAP_DIR);
}

/**
 * Inject the mobile native bridge into the COPIED android web assets only.
 * dist/native/web stays the clean generic bundle (also used by Electron),
 * so the Yandex web path is never affected.
 */
function injectBridge() {
  console.log('[build-android] (4/6) injecting RevenueCat native bridge into android assets');
  if (!fs.existsSync(PUBLIC_DIR)) {
    console.error(`[build-android] cannot find synced assets at ${PUBLIC_DIR}`);
    console.error('[build-android] run "npx cap sync android" succeeded? aborting injection.');
    process.exit(1);
  }
  // Copy bridge implementation next to index.html.
  fs.copyFileSync(path.join(CAP_DIR, 'native-bridge.js'), path.join(PUBLIC_DIR, 'tmzd-native-bridge.js'));

  // Build the runtime config (product map + RC key from env) as inline JS.
  const productMap = JSON.parse(fs.readFileSync(path.join(CAP_DIR, 'revenuecat-products.json'), 'utf8'));
  const rcKey = process.env.TMZD_REVENUECAT_ANDROID_KEY || '';
  if (!rcKey) {
    console.warn('[build-android] WARNING: TMZD_REVENUECAT_ANDROID_KEY not set — IAP will degrade to no-op.');
  }
  const cfg =
    `window.__TMZD_RC_PRODUCTS__=${JSON.stringify(productMap.products || [])};` +
    `window.__TMZD_RC_KEY__=${JSON.stringify(rcKey)};`;

  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  if (html.indexOf('tmzd-native-bridge.js') === -1) {
    const inject =
      `\n    <script>${cfg}</script>\n` +
      `    <script src="tmzd-native-bridge.js"></script>\n`;
    // Inject BEFORE game.js so the bridge exists when Game.Platform detects env.
    html = html.replace(/(<script\s+src=["']game\.js["'][^>]*>)/i, `${inject}    $1`);
    fs.writeFileSync(indexPath, html, 'utf8');
    console.log('[build-android] bridge + config wired before game.js');
  } else {
    // Re-sync re-copies index.html, but guard for idempotency anyway.
    console.log('[build-android] bridge already present (idempotent)');
  }
}

function buildAab(opts) {
  fs.mkdirSync(DIST_ANDROID, { recursive: true });
  const gradlew = isWin ? 'gradlew.bat' : './gradlew';
  const task = opts.debug ? 'bundleDebug' : 'bundleRelease';
  console.log(`[build-android] (5/6) gradle ${task}`);

  const gradleArgs = [task];
  if (!opts.debug) {
    // Signing config consumed by android/app/build.gradle (-P props).
    const ks = process.env.TMZD_ANDROID_KEYSTORE;
    if (!ks) {
      console.error('[build-android] TMZD_ANDROID_KEYSTORE not set — cannot sign release AAB.');
      console.error('[build-android] set keystore env vars or pass --debug for an unsigned debug build.');
      process.exit(1);
    }
    gradleArgs.push(
      `-Pandroid.injected.signing.store.file=${ks}`,
      `-Pandroid.injected.signing.store.password=${process.env.TMZD_ANDROID_KEYSTORE_PASSWORD || ''}`,
      `-Pandroid.injected.signing.key.alias=${process.env.TMZD_ANDROID_KEY_ALIAS || ''}`,
      `-Pandroid.injected.signing.key.password=${process.env.TMZD_ANDROID_KEY_PASSWORD || ''}`,
    );
  }
  run(gradlew, gradleArgs, ANDROID_DIR);

  console.log('[build-android] (6/6) collecting .aab into dist/native/android');
  const outDir = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'bundle', opts.debug ? 'debug' : 'release');
  if (!fs.existsSync(outDir)) {
    console.warn(`[build-android] expected bundle dir not found: ${outDir}`);
    return;
  }
  for (const f of fs.readdirSync(outDir)) {
    if (f.endsWith('.aab')) {
      fs.copyFileSync(path.join(outDir, f), path.join(DIST_ANDROID, f));
      console.log(`[build-android] -> ${path.join(DIST_ANDROID, f)}`);
    }
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  buildWebBundle();
  if (!opts.skipTests) runTests();
  ensureAndroidPlatform();
  syncAndroid();
  injectBridge();
  if (opts.noBuild) {
    console.log('[build-android] --no-build: skipping gradle. Open packaging/capacitor/android in Android Studio,');
    console.log('[build-android] or run "node packaging/scripts/build-android.mjs" to produce a signed AAB.');
    return;
  }
  buildAab(opts);
  console.log('[build-android] done.');
}

main();
