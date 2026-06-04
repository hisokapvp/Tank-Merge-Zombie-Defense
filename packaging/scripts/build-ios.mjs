#!/usr/bin/env node
/**
 * packaging/scripts/build-ios.mjs
 * solo-pipeline-yandex-vk#2 / Phase 4 — iOS / App Store (Capacitor + cloud macOS).
 *
 * There is no local Mac in this environment, so the actual archive+sign+upload
 * happens on a cloud macOS runner (Codemagic — see packaging/capacitor/codemagic.yaml,
 * or a GitHub Actions macOS runner). This script does the parts that CAN run
 * cross-platform and prepares everything the cloud build consumes:
 *
 *   1. build the CLEAN web bundle           -> dist/native/web/   (npm-free)
 *   2. ensure the Capacitor ios platform exists (npx cap add ios)
 *   3. npx cap sync ios                      (copy webDir + plugins)
 *   4. inject window.__TMZD_NATIVE_BRIDGE__  into the COPIED ios assets
 *      (RevenueCat mobile backend) — dist/native/web stays clean & generic
 *   5. trigger the cloud build (Codemagic API if TMZD_CODEMAGIC_* set,
 *      otherwise print exactly how to kick it off via git tag / dashboard)
 *
 * Steps 1-4 are safe on Windows/Linux; step 5 just calls a REST API or prints
 * guidance. The xcodebuild archive itself MUST run on macOS (cloud).
 *
 *   node packaging/scripts/build-ios.mjs [--skip-tests] [--prepare-only]
 *
 * Env:
 *   TMZD_REVENUECAT_IOS_KEY   RevenueCat public SDK key (App Store)
 *   TMZD_CODEMAGIC_TOKEN      Codemagic API token (optional, to auto-trigger)
 *   TMZD_CODEMAGIC_APP_ID     Codemagic application id (optional)
 *   TMZD_CODEMAGIC_WORKFLOW   workflow id, default "ios-appstore"
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PKG_DIR = path.resolve(__dirname, '..');
const CAP_DIR = path.join(PKG_DIR, 'capacitor');
const IOS_DIR = path.join(CAP_DIR, 'ios');
const PUBLIC_DIR = path.join(IOS_DIR, 'App', 'App', 'public');
const isWin = process.platform === 'win32';

function parseArgs(argv) {
  const a = { skipTests: false, prepareOnly: false };
  for (const x of argv) {
    if (x === '--skip-tests') a.skipTests = true;
    else if (x === '--prepare-only') a.prepareOnly = true;
    else if (x === '--help' || x === '-h') {
      process.stdout.write('Usage: node packaging/scripts/build-ios.mjs [--skip-tests] [--prepare-only]\n');
      process.exit(0);
    } else throw new Error(`Unknown flag: ${x}`);
  }
  return a;
}

function run(cmd, args, cwd) {
  console.log(`[build-ios] $ ${cmd} ${args.join(' ')}  (cwd=${cwd})`);
  // With shell:true on Windows the command line is re-parsed by cmd.exe, so any
  // path containing spaces (e.g. "C:\Program Files\nodejs\node.exe") must be
  // double-quoted or it splits on the space. Quote cmd/args that need it.
  const q = (s) => (isWin && /[\s&()[\]{}^=;!'+,`~]/.test(s) ? `"${s}"` : s);
  const finalCmd = isWin ? q(cmd) : cmd;
  const finalArgs = isWin ? args.map(q) : args;
  const res = spawnSync(finalCmd, finalArgs, { cwd, stdio: 'inherit', shell: isWin });
  if (res.status !== 0) {
    console.error(`[build-ios] FAILED: ${cmd} (exit ${res.status})`);
    process.exit(res.status || 1);
  }
}
function npx(args, cwd) { run(isWin ? 'npx.cmd' : 'npx', args, cwd); }

function buildWebBundle() {
  console.log('[build-ios] (1/5) building clean web bundle -> dist/native/web');
  run(process.execPath, [path.join(PKG_DIR, 'scripts', 'build-web-bundle.mjs')], REPO_ROOT);
}
function runTests() {
  console.log('[build-ios] running regression tests (bash ci/run_tests.sh)');
  run('bash', ['ci/run_tests.sh'], REPO_ROOT);
}
function ensureIosPlatform() {
  if (fs.existsSync(IOS_DIR)) { console.log('[build-ios] (2/5) ios platform present'); return; }
  console.log('[build-ios] (2/5) adding ios platform (npx cap add ios)');
  console.log('[build-ios] NOTE: "npx cap add ios" needs CocoaPods; on a non-Mac it scaffolds the project but pod install runs on the cloud Mac.');
  npx(['cap', 'add', 'ios'], CAP_DIR);
}
function syncIos() {
  console.log('[build-ios] (3/5) npx cap sync ios');
  npx(['cap', 'sync', 'ios'], CAP_DIR);
}
function injectBridge() {
  console.log('[build-ios] (4/5) injecting RevenueCat native bridge into ios assets');
  if (!fs.existsSync(PUBLIC_DIR)) {
    console.warn(`[build-ios] synced assets not found at ${PUBLIC_DIR} (ok if cap add ios scaffolds on cloud).`);
    return;
  }
  fs.copyFileSync(path.join(CAP_DIR, 'native-bridge.js'), path.join(PUBLIC_DIR, 'tmzd-native-bridge.js'));
  const productMap = JSON.parse(fs.readFileSync(path.join(CAP_DIR, 'revenuecat-products.json'), 'utf8'));
  const rcKey = process.env.TMZD_REVENUECAT_IOS_KEY || '';
  if (!rcKey) console.warn('[build-ios] WARNING: TMZD_REVENUECAT_IOS_KEY not set — IAP will degrade to no-op.');
  const cfg =
    `window.__TMZD_RC_PRODUCTS__=${JSON.stringify(productMap.products || [])};` +
    `window.__TMZD_RC_KEY__=${JSON.stringify(rcKey)};`;
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  if (html.indexOf('tmzd-native-bridge.js') === -1) {
    const inject = `\n    <script>${cfg}</script>\n    <script src="tmzd-native-bridge.js"></script>\n`;
    html = html.replace(/(<script\s+src=["']game\.js["'][^>]*>)/i, `${inject}    $1`);
    fs.writeFileSync(indexPath, html, 'utf8');
    console.log('[build-ios] bridge + config wired before game.js');
  } else {
    console.log('[build-ios] bridge already present (idempotent)');
  }
}

function triggerCloudBuild() {
  console.log('[build-ios] (5/5) cloud macOS build (archive + sign + upload to TestFlight)');
  const token = process.env.TMZD_CODEMAGIC_TOKEN;
  const appId = process.env.TMZD_CODEMAGIC_APP_ID;
  const workflow = process.env.TMZD_CODEMAGIC_WORKFLOW || 'ios-appstore';
  if (!token || !appId) {
    console.log('[build-ios] Codemagic env not set — nothing auto-triggered. To run the cloud build:');
    console.log('[build-ios]   • Push a git tag (e.g. ios-v1.0.0); Codemagic watches tags via codemagic.yaml, OR');
    console.log('[build-ios]   • Start the "ios-appstore" workflow from the Codemagic dashboard, OR');
    console.log('[build-ios]   • Set TMZD_CODEMAGIC_TOKEN + TMZD_CODEMAGIC_APP_ID and re-run to auto-trigger.');
    return;
  }
  console.log(`[build-ios] triggering Codemagic workflow "${workflow}" for app ${appId} ...`);
  // Pure-node HTTPS POST (no npm). Cross-platform, only stdlib.
  import('node:https').then((https) => {
    const body = JSON.stringify({ appId, workflowId: workflow, branch: 'main' });
    const req = https.request({
      hostname: 'api.codemagic.io', path: '/builds', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token, 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        console.log(`[build-ios] Codemagic responded ${res.statusCode}: ${data}`);
        if (res.statusCode >= 400) process.exit(1);
      });
    });
    req.on('error', (e) => { console.error('[build-ios] Codemagic trigger failed:', e.message); process.exit(1); });
    req.write(body); req.end();
  });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  buildWebBundle();
  if (!opts.skipTests) runTests();
  ensureIosPlatform();
  syncIos();
  injectBridge();
  if (opts.prepareOnly) {
    console.log('[build-ios] --prepare-only: ios project prepared. Run the cloud macOS build to archive+sign+upload.');
    return;
  }
  triggerCloudBuild();
  console.log('[build-ios] done (cloud build owns archive/sign/upload).');
}

main();
