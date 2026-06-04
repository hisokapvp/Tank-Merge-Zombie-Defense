#!/usr/bin/env node
/**
 * packaging/scripts/build-web-bundle.mjs
 * solo-pipeline-yandex-vk#1 / Phase 1 — native web bundle.
 *
 * Thin, npm-free wrapper around the repo's existing release builder
 * (ci/build_release.mjs). It produces a CLEAN web bundle WITHOUT the Yandex
 * SDK seam into a fixed folder (dist/native/web by default) for consumption
 * by the native wrappers (Electron app:// protocol, mobile WebView).
 *
 * Why a wrapper instead of calling build_release directly:
 *   • Pins the native output target so every wrapper (Electron / mobile)
 *     reads from the same dist/native/web path.
 *   • Forces generic (non-Yandex) mode and --no-zip — the native shells
 *     serve the unzipped folder via a custom protocol, no zip needed.
 *   • Lives under packaging/ which is OUTSIDE the web-bundle whitelist
 *     (ci/build_release.mjs DIRS = src/assets/vendor + root files), so this
 *     tooling never ships inside the game bundle.
 *
 * Uses only Node stdlib (no npm). Run from the repo root or from packaging/:
 *   node packaging/scripts/build-web-bundle.mjs [--out <dir>] [--zip]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// packaging/scripts -> packaging -> repo root
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BUILDER = path.join(REPO_ROOT, 'ci', 'build_release.mjs');
const DEFAULT_OUT = path.join(REPO_ROOT, 'dist', 'native', 'web');

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, zip: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = path.resolve(argv[++i]);
    else if (a === '--zip') args.zip = true;
    else if (a === '--help' || a === '-h') {
      process.stdout.write('Usage: node packaging/scripts/build-web-bundle.mjs [--out <dir>] [--zip]\n');
      process.exit(0);
    } else {
      throw new Error(`Unknown flag: ${a}`);
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  // Generic (NO --yandex) keeps the bundle free of Yandex SDK seam and
  // reject-pattern processing; --no-zip leaves an unzipped folder for the
  // custom app:// protocol to serve directly.
  const builderArgs = [BUILDER, '--out', args.out];
  builderArgs.push(args.zip ? '--zip' : '--no-zip');

  console.log(`[build-web-bundle] native web bundle -> ${args.out}`);
  console.log(`[build-web-bundle] invoking: node ${builderArgs.join(' ')}`);

  const res = spawnSync(process.execPath, builderArgs, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });

  if (res.status !== 0) {
    console.error(`[build-web-bundle] FAILED (exit ${res.status})`);
    process.exit(res.status || 1);
  }

  console.log('[build-web-bundle] done. Native wrappers can now serve');
  console.log(`[build-web-bundle]   ${path.join(args.out, 'index.html')}`);
  console.log('[build-web-bundle] via the app:// custom protocol so that');
  console.log("[build-web-bundle] relative fetch('assets/...') resolves correctly.");
}

main();
